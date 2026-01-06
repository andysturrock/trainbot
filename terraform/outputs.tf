output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  value = google_container_cluster.primary.endpoint
}

output "secret_id" {
  value = google_secret_manager_secret.slack_secrets.secret_id
}
