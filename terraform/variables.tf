variable "gcp_project_id" {
  description = "The GCP project ID."
  type        = string
}

variable "gcp_region" {
  description = "The GCP region to deploy to."
  type        = string
  default     = "europe-west2"
}

variable "cluster_name" {
  description = "The name of the GKE cluster."
  type        = string
  default     = "trainbot"
}

variable "secret_name" {
  description = "The name of the secret in Secret Manager."
  type        = string
  default     = "trainbot-slack-secrets"
}

variable "secrets" {
  description = "The secrets to store in Secret Manager."
  type        = map(string)
  sensitive   = true
}
