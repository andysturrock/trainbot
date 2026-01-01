resource "flux_bootstrap_git" "this" {
  depends_on = [google_container_cluster.primary]

  embedded_manifests = true
  path               = "flux/clusters/production"
}
