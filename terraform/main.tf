terraform {
  backend "gcs" {}
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.17.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.18.0"
    }
    flux = {
      source  = "fluxcd/flux"
      version = "~> 1.2"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
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

data "google_client_config" "default" {}

provider "kubernetes" {
  host  = "https://${google_container_cluster.primary.control_plane_endpoints_config[0].dns_endpoint_config[0].endpoint}"
  token = data.google_client_config.default.access_token
}

provider "flux" {
  kubernetes = {
    host  = "https://${google_container_cluster.primary.control_plane_endpoints_config[0].dns_endpoint_config[0].endpoint}"
    token = data.google_client_config.default.access_token
  }
  git = {
    url = "https://github.com/${var.github_owner}/${var.github_repository}.git"
    http = {
      username = "git" # This can be anything for PAT authentication
      password = var.github_token
    }
  }
}

provider "github" {
  owner = var.github_owner
  token = var.github_token
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
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifact_registry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "docker_repo" {
  provider      = google-beta
  location      = var.gcp_region
  repository_id = "trainbot-repo"
  description   = "Docker repository for trainbot images"
  format        = "DOCKER"
  depends_on = [
    google_project_service.artifact_registry
  ]
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

  lifecycle {
    ignore_changes = [
      secondary_ip_range,
    ]
  }
}

resource "google_compute_router" "router" {
  name    = "trainbot-router"
  network = google_compute_network.vpc_network.id
  region  = google_compute_subnetwork.gke_subnet.region
}

resource "google_compute_router_nat" "nat" {
  name                               = "trainbot-nat-gateway"
  router                             = google_compute_router.router.name
  region                             = google_compute_router.router.region
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  nat_ip_allocate_option             = "AUTO_ONLY"
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


resource "google_project_iam_member" "artifact_registry_reader" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gce_default_sa_artifact_registry_reader" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

resource "google_service_account_iam_member" "workload_identity_user" {
  service_account_id = google_service_account.gke_nodes.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.gcp_project_id}.svc.id.goog[default/trainbot-ksa]"
}

resource "google_firestore_database" "database" {
  project         = var.gcp_project_id
  name            = "${var.gcp_project_id}-firestore-db"
  location_id     = var.gcp_region
  type            = "FIRESTORE_NATIVE"
  deletion_policy = "DELETE"
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
  provider            = google-beta
  name                = "${var.cluster_name}-cluster"
  location            = var.gcp_region
  network             = google_compute_network.vpc_network.name
  subnetwork          = google_compute_subnetwork.gke_subnet.name
  initial_node_count  = 1
  deletion_protection = false
  enable_autopilot    = true

  workload_identity_config {
    workload_pool = "${var.gcp_project_id}.svc.id.goog"
  }

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
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@container-engine-robot.iam.gserviceaccount.com"
}

resource "google_kms_crypto_key_iam_member" "compute_system_key_user" {
  crypto_key_id = data.google_kms_crypto_key.gke_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@compute-system.iam.gserviceaccount.com"
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

resource "google_compute_global_address" "ingress_ip" {
  name = "trainbot-ingress-ip"
}

output "ingress_ip_address" {
  value = google_compute_global_address.ingress_ip.address
}
resource "kubernetes_config_map" "flux_vars" {
  metadata {
    name      = "flux-vars"
    namespace = "default"
  }

  data = {
    GCP_PROJECT_ID            = var.gcp_project_id
    GCP_SERVICE_ACCOUNT_EMAIL = google_service_account.gke_nodes.email
    FIRESTORE_DATABASE_ID     = "${var.gcp_project_id}-firestore-db"
    SLACK_TEAM_ID             = var.slack_team_id
    SLACK_ENTERPRISE_ID       = var.slack_enterprise_id
    SLACK_CHANNEL_ID          = var.slack_channel_id
    STATION_CRS               = var.station_crs
    NATIONAL_RAIL_API_URL     = var.rail_api_url
    POLL_INTERVAL_MS          = var.poll_interval_ms
    LOG_LEVEL                 = var.log_level
    SECRET_NAME               = var.secret_name
  }
}

resource "google_logging_project_exclusion" "gke_platform_noise" {
  name        = "gke-platform-noise"
  description = "Exclude internal GKE platform noise (ingress probes, fluentbit, and anonymous image pulls)"
  filter      = <<EOT
    (resource.type="gce_backend_service" AND textPayload:"k8s-ingress-svc-acct-permission-check-probe") OR
    (resource.type="k8s_container" AND resource.labels.namespace_name="kube-system" AND (
      (resource.labels.container_name="fluentbit-gke" AND severity="ERROR" AND (textPayload:"Failed to parse operation" OR jsonPayload.message:"Failed to parse operation")) OR
      (resource.labels.container_name:("container-watcher" OR "core-metrics-exporter" OR "netd"))
    )) OR
    (logName:"logs/cloudaudit.googleapis.com%2Fdata_access" AND protoPayload.serviceName="artifactregistry.googleapis.com" AND (
      (protoPayload.status.code=2 AND protoPayload.authenticationInfo.principalEmail:("anonymous" OR "unknown")) OR
      (protoPayload.methodName="Docker-GetManifest" AND protoPayload.status.code=2)
    ))
  EOT
}
