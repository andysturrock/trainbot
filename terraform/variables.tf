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

variable "github_owner" {
  description = "The GitHub owner (user or organization)."
  type        = string
}

variable "github_token" {
  description = "GitHub Personal Access Token for Flux"
  type        = string
  sensitive   = true
}

variable "slack_team_id" {
  description = "Slack Team ID"
  type        = string
}

variable "slack_channel_id" {
  description = "Slack Channel ID"
  type        = string
}

variable "github_repository" {
  description = "The GitHub repository name."
  type        = string
  default     = "trainbot"
}
