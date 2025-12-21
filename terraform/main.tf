terraform {
  backend "gcs" {}
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.14.1"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.14.1"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}
provider "google-beta" {
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

data "google_kms_key_ring" "gke_keyring" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = "${var.gcp_project_id}-default-cmek-key-ring"
}

data "google_kms_crypto_key" "gke_key" {
  name     = "default-cmek-key"
  key_ring = data.google_kms_key_ring.gke_keyring.id
}

resource "google_container_cluster" "primary" {
  provider                 = google-beta
  name                     = "${var.cluster_name}-cluster"
  location                 = var.gcp_region
  network                  = google_compute_network.vpc_network.name
  subnetwork               = google_compute_subnetwork.gke_subnet.name
  initial_node_count       = 1
  deletion_protection      = false
  enable_autopilot         = true
  control_plane_endpoints_config {
    dns_endpoint_config {
      allow_external_traffic = true
    }
  }
  cluster_autoscaling {
    auto_provisioning_defaults {
      boot_disk_kms_key = data.google_kms_crypto_key.gke_key.id
    }
  }

  master_authorized_networks_config {}
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = true
  }
  database_encryption {
    state    = "ENCRYPTED"
    key_name = data.google_kms_crypto_key.gke_key.id
  }
  depends_on = [
    google_kms_crypto_key_iam_member.gke_key_user,
    google_kms_crypto_key_iam_member.compute_system_key_user
  ]
}

data "google_project" "project" {}

resource "google_kms_crypto_key_iam_member" "gke_key_user" {
  crypto_key_id = data.google_kms_crypto_key.gke_key.id
  role            = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member          = "serviceAccount:service-${data.google_project.project.number}@container-engine-robot.iam.gserviceaccount.com"
}

resource "google_kms_crypto_key_iam_member" "compute_system_key_user" {
  crypto_key_id = data.google_kms_crypto_key.gke_key.id
  role            = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member          = "serviceAccount:service-${data.google_project.project.number}@compute-system.iam.gserviceaccount.com"
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

