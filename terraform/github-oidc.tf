resource "google_iam_workload_identity_pool" "github_pool" {
  provider                  = google-beta
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  provider                           = google-beta
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"
  description                        = "OIDC identity provider for GitHub Actions"
  
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Service Account for GitHub Actions
resource "google_service_account" "github_actions" {
  account_id   = "github-actions-sa"
  display_name = "Service Account for GitHub Actions"
}

# Allow GitHub Actions (from this specific repo) to impersonate the service account
resource "google_service_account_iam_member" "github_actions_impersonation" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/${var.github_owner}/${var.github_repository}"
}

# Grant necessary permissions to the GitHub Actions Service Account
# Terraform State Access
resource "google_storage_bucket_iam_member" "tf_state_access" {
  # Note: The bucket should be passed as a variable or data source ideally, 
  # but for now usage, we'll assume the user grants this manually or we add a variable.
  # Since the bucket name is in the backend config (not accessible here), 
  # we will skip this specific binding here and advise user to grant it or import the bucket.
  # Instead, we grant project-level roles often needed for CI/CD.
  count  = 0 
  bucket = "placeholder" # We don't know the bucket name in code
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_editor" {
  project = var.gcp_project_id
  role    = "roles/editor"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_secret_admin" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_container_admin" {
  project = var.gcp_project_id
  role    = "roles/container.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_artifact_registry_admin" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github_provider.name
}

output "github_actions_service_account" {
  value = google_service_account.github_actions.email
}
