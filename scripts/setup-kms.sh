#!/bin/bash

# This script creates a KMS KeyRing and CryptoKey for GKE CMEK if they don't exist.
# It's intended for use in projects where these resources aren't managed by a project factory.

set -e

PROJECT_ID=$(gcloud config get-value project)
REGION="europe-west2" # Default region, can be overridden
KEYRING_NAME="${PROJECT_ID}-default-cmek-key-ring"
KEY_NAME="default-cmek-key"

# Enable Cloud KMS API
echo "Enabling Cloud KMS API..."
gcloud services enable cloudkms.googleapis.com

# Check if KeyRing exists
if gcloud kms keyrings describe "$KEYRING_NAME" --location "$REGION" &>/dev/null; then
  echo "KeyRing $KEYRING_NAME already exists in $REGION."
else
  echo "Creating KeyRing $KEYRING_NAME in $REGION..."
  gcloud kms keyrings create "$KEYRING_NAME" --location "$REGION"
fi

# Check if CryptoKey exists
if gcloud kms keys describe "$KEY_NAME" --keyring "$KEYRING_NAME" --location "$REGION" &>/dev/null; then
  echo "CryptoKey $KEY_NAME already exists in $KEYRING_NAME."
else
  echo "Creating CryptoKey $KEY_NAME in $KEYRING_NAME..."
  gcloud kms keys create "$KEY_NAME" \
    --keyring "$KEYRING_NAME" \
    --location "$REGION" \
    --purpose "encryption" \
    --protection-level "software"
fi

echo "KMS setup complete."
echo "Key ID: projects/$PROJECT_ID/locations/$REGION/keyRings/$KEYRING_NAME/cryptoKeys/$KEY_NAME"
