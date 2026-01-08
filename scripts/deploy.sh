#!/bin/bash

# This script automates the build and deployment of the trainbot application.
#
# It builds the Docker image, pushes it to Google Artifact Registry,
# and then deploys the application to Kubernetes using Helm.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- WARNING ---
# This script is for MANUAL deployments only.
# The primary deployment method for this project is GitOps via FluxCD.
# Push your code to 'main' and let Flux handle the deployment!
# -----------------

# --- Configuration ---
# You can change these variables
IMAGE_NAME="trainbot"
IMAGE_TAG="latest"
ARTIFACT_REGISTRY_REPO="trainbot-repo"
HELM_RELEASE_NAME="trainbot"
CLUSTER_NAME="trainbot-cluster"
GSA_NAME="trainbot-gke-nodes" # From terraform/main.tf

# Get the absolute path of the script's directory
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# Assume the project root is the parent directory of the script's directory
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")

HELM_CHART_PATH="$PROJECT_ROOT/helm/trainbot"

# Load env vars from .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

if [[ -z "$GCP_PROJECT_ID" || -z "$GCP_REGION" ]]; then
    echo "Error: GCP_PROJECT_ID and GCP_REGION must be set in your .env file or as environment variables."
    exit 1
fi

# Construct the Artifact Registry hostname, full image name, and GSA email
REGISTRY_HOSTNAME="$GCP_REGION-docker.pkg.dev"
FULL_IMAGE_NAME="$REGISTRY_HOSTNAME/$GCP_PROJECT_ID/$ARTIFACT_REGISTRY_REPO/$IMAGE_NAME:$IMAGE_TAG"
GSA_EMAIL="$GSA_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"


# --- Main execution ---

echo "--------------------------------------------------"
echo "Deploying from project root: $PROJECT_ROOT"
echo "Target image: $FULL_IMAGE_NAME"
echo "Using GCP Service Account: $GSA_EMAIL"
echo "--------------------------------------------------"

# 1. Authenticate Docker with Artifact Registry
# Uses Application Default Credentials to configure Docker.
echo "STEP 1: Authenticating Docker with Artifact Registry..."
gcloud auth configure-docker "$REGISTRY_HOSTNAME" --quiet

# 2. Build the Docker image
echo
echo "STEP 2: Building Docker image..."
docker build -t "$FULL_IMAGE_NAME" "$PROJECT_ROOT"

# 3. Push the Docker image to Artifact Registry
echo
echo "STEP 3: Pushing Docker image to Artifact Registry..."
docker push "$FULL_IMAGE_NAME"

# 4. Configure kubectl
echo
echo "STEP 4: Configuring kubectl to connect to the GKE cluster..."
gcloud container clusters get-credentials "$CLUSTER_NAME" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --dns-endpoint --quiet

# 5. Deploy with Helm
# Uses 'helm upgrade --install' to be idempotent.
# Dynamically sets the image project ID, tag, and GSA email.
echo
echo "STEP 5: Deploying application with Helm..."
helm upgrade --install "$HELM_RELEASE_NAME" "$HELM_CHART_PATH" \
  --set image.projectId="$GCP_PROJECT_ID" \
  --set image.tag="$IMAGE_TAG" \
  --set serviceAccount.gcpServiceAccountEmail="$GSA_EMAIL" \
  --set env.NODE_ENV="${NODE_ENV:-production}" \
  --set env.SECRET_NAME="${SECRET_NAME:-trainbot-slack-secrets}" \
  --set env.LOG_LEVEL="${LOG_LEVEL:-info}" \
  --set env.GCP_PROJECT_ID="$GCP_PROJECT_ID" \
  --set env.FIRESTORE_DATABASE_ID="${GCP_PROJECT_ID}-firestore-db" \
  --set env.NATIONAL_RAIL_API_URL="$NATIONAL_RAIL_API_URL" \
  --set env.SLACK_TEAM_ID="$SLACK_TEAM_ID" \
  --set env.SLACK_ENTERPRISE_ID="$SLACK_ENTERPRISE_ID" \
  --set env.STATION_CRS="$STATION_CRS" \
  --set env.SLACK_CHANNEL_ID="$SLACK_CHANNEL_ID" \
  --set env.POLL_INTERVAL_MS="$POLL_INTERVAL_MS"

echo
echo "--------------------------------------------------"
echo "Deployment script finished successfully."
echo "--------------------------------------------------"
