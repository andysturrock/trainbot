terraform {
  backend "gcs" {}
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "5.36.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.23.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

resource "google_project_service" "firestore" {
  service = "firestore.googleapis.com"
}

resource "google_project_service" "container" {
  service = "container.googleapis.com"
}

resource "google_project_service" "secretmanager" {
  service = "secretmanager.googleapis.com"
}

resource "google_project_service" "compute" {
  service = "compute.googleapis.com"
}

data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://container.googleapis.com/v1/projects/${var.gcp_project_id}/locations/${var.gcp_region}/clusters/${google_container_cluster.primary.name}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.primary.master_auth.0.cluster_ca_certificate)
}

resource "google_compute_network" "vpc_network" {
  name                    = "trainbot-vpc"
  auto_create_subnetworks = true
}

resource "google_service_account" "gke_nodes" {
  account_id   = "${var.cluster_name}-gke-nodes"
  display_name = "Service Account for GKE nodes"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "datastore_user" {
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_firestore_database" "database" {
  project    = var.gcp_project_id
  name       = "(default)"
  location_id = var.gcp_region
  type        = "FIRESTORE_NATIVE"
}

resource "google_container_cluster" "primary" {
  name     = "${var.cluster_name}-cluster"
  location = var.gcp_region
  network  = google_compute_network.vpc_network.name

  enable_autopilot = true
}

resource "google_compute_firewall" "gke_health_checks" {
  name    = "${var.cluster_name}-gke-health-checks"
  network = google_compute_network.vpc_network.name
  allow {
    protocol = "tcp"
    ports    = ["3000"]
  }
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
}

resource "google_secret_manager_secret" "slack_secrets" {
  secret_id = var.secret_name
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "slack_secrets_version" {
  secret      = google_secret_manager_secret.slack_secrets.id
  secret_data = jsonencode(var.secrets)
}

resource "kubernetes_deployment" "trainbot" {
  metadata {
    name = "trainbot"
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "trainbot"
      }
    }

    template {
      metadata {
        labels = {
          app = "trainbot"
        }
      }

      spec {
        container {
          image = "gcr.io/${var.gcp_project_id}/${var.cluster_name}:latest"
          name  = "trainbot"

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name  = "GCP_PROJECT_ID"
            value = var.gcp_project_id
          }

          env {
            name  = "SECRET_NAME"
            value = var.secret_name
          }

          port {
            container_port = 3000
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "trainbot" {
  metadata {
    name = "trainbot"
  }
  spec {
    selector = {
      app = kubernetes_deployment.trainbot.spec.0.template.0.metadata.0.labels.app
    }
    port {
      port        = 80
      target_port = 3000
    }
    type = "LoadBalancer"
  }
}
