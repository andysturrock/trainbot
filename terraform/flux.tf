resource "flux_bootstrap_git" "this" {
  depends_on = [google_container_cluster.primary]

  embedded_manifests = true
  path               = "flux/clusters/production"
  components_extra   = ["image-reflector-controller", "image-automation-controller"]
}

resource "google_service_account" "flux_reflector" {
  account_id   = "flux-reflector"
  display_name = "Flux Image Reflector Controller"
}

resource "google_project_iam_member" "flux_reflector_ar_reader" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.flux_reflector.email}"
}

resource "google_service_account_iam_member" "flux_reflector_wi" {
  service_account_id = google_service_account.flux_reflector.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.gcp_project_id}.svc.id.goog[flux-system/image-reflector-controller]"
}

resource "kubernetes_annotations" "flux_reflector_sa" {
  api_version = "v1"
  kind        = "ServiceAccount"
  metadata {
    name      = "image-reflector-controller"
    namespace = "flux-system"
  }
  annotations = {
    "iam.gke.io/gcp-service-account" = google_service_account.flux_reflector.email
  }
  depends_on = [flux_bootstrap_git.this]
}
