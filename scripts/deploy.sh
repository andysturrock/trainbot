#!/bin/bash

# This script automates the build and deployment of the trainbot application.
#
# It builds the Docker image, pushes it to Google Artifact Registry,
# and then deploys the application to Kubernetes using Helm.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# You can change these variables
IMAGE_NAME="trainbot"
IMAGE_TAG="latest"
ARTIFACT_REGISTRY_REPO="trainbot-repo"
HELM_RELEASE_NAME="trainbot"

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

# Construct the Artifact Registry hostname and the full image name
REGISTRY_HOSTNAME="$GCP_REGION-docker.pkg.dev"
FULL_IMAGE_NAME="$REGISTRY_HOSTNAME/$GCP_PROJECT_ID/$ARTIFACT_REGISTRY_REPO/$IMAGE_NAME:$IMAGE_TAG"

# --- Main execution ---

echo "--------------------------------------------------"
echo "Deploying from project root: $PROJECT_ROOT"
echo "Target image: $FULL_IMAGE_NAME"
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

# 4. Deploy with Helm
# Uses 'helm upgrade --install' to be idempotent.
# Dynamically sets the image repository and tag to match the image just built.
echo
echo "STEP 4: Deploying application with Helm..."
helm upgrade --install "$HELM_RELEASE_NAME" "$HELM_CHART_PATH" \
  --set image.repository="$REGISTRY_HOSTNAME/$GCP_PROJECT_ID/$ARTIFACT_REGISTRY_REPO/$IMAGE_NAME" \
  --set image.tag="$IMAGE_TAG"

echo
echo "--------------------------------------------------"
echo "Deployment script finished successfully."
echo "--------------------------------------------------"

