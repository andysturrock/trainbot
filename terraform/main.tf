terraform {
  backend "gcs" {}
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "~> 5.0"
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
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "container" {
  service            = "container.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "compute" {
  service                    = "compute.googleapis.com"
  disable_dependent_services = true
  disable_on_destroy         = false
}

provider "kubernetes" {
  host = "https://${google_container_cluster.primary.control_plane_endpoints_config[0].dns_endpoint_config[0].endpoint}"
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "gke-gcloud-auth-plugin"
  }
}

resource "google_compute_network" "vpc_network" {
  name                    = "trainbot-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "gke_subnet" {
  name                     = "gke-subnet"
  ip_cidr_range            = "10.0.0.0/20"
  network                  = google_compute_network.vpc_network.id
  private_ip_google_access = true
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.4.0.0/14"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.0.32.0/22"
  }
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
  project     = var.gcp_project_id
  name        = "${var.gcp_project_id}-firestore-db"
  location_id = var.gcp_region
  type        = "FIRESTORE_NATIVE"
}

resource "google_container_cluster" "primary" {
  name                     = "${var.cluster_name}-cluster"
  location                 = var.gcp_region
  network                  = google_compute_network.vpc_network.name
  subnetwork               = google_compute_subnetwork.gke_subnet.name
  initial_node_count       = 1
  remove_default_node_pool = true

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = true

    master_ipv4_cidr_block = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "Allow all"
    }
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = google_compute_subnetwork.gke_subnet.secondary_ip_range[0].range_name
    services_secondary_range_name = google_compute_subnetwork.gke_subnet.secondary_ip_range[1].range_name
  }
}

resource "google_container_node_pool" "primary_nodes" {
  name       = "default-pool"
  cluster    = google_container_cluster.primary.id
  node_count = 1
  node_config {
    machine_type    = "e2-medium"
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
  }
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
    user_managed {
      replicas {
        location = var.gcp_region
      }
    }
  }
  depends_on = [google_project_service.secretmanager]
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
