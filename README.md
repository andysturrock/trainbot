# Trainbot

A Slack bot that polls the UK National Rail API for incidents at a given station and posts them to a Slack channel.

## Features

- **Two Modes of Operation:**
  - **Single Station Mode:** Monitors a single station and posts any incidents to a specified Slack channel.
  - **Multi-Station Mode:** Allows users to select multiple stations to monitor from the App's Home tab. Any incidents are posted to the user's "Messages" tab in Slack.
- **Built with Modern Technologies:** The application is built with TypeScript and runs in a Docker container.
- **Infrastructure as Code:** The entire infrastructure is managed with Terraform, making it easy to deploy and manage.
- **Deploys to Google Cloud:** The application is designed to be deployed to a GKE cluster in Google Cloud Platform.
- **Local Development Environment:** Includes a Docker Compose setup for a consistent and easy-to-use local development environment with a Firestore emulator.

## Running Locally (with Docker)

This is the recommended way to run the application locally. It uses Docker Compose to run the application and a local Firestore emulator.

You will need to have Docker and the Docker Compose V2 plugin installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/andysturrock/trainbot.git
    cd trainbot
    ```

2.  **Configure environment variables:**
    Create a `.env` file by copying the `.env.example` file:
    ```bash
    cp .env.example .env
    ```
    Fill in the required values in the `.env` file (e.g., your Slack tokens).

3.  **Run the application:**
    ```bash
    docker compose up --build
    ```
    The application will be running on `http://localhost:3000`, and the Firestore emulator will be available on `localhost:8080`.

## Running Locally (with Node.js)

To run the application locally without Docker, you will need to have Node.js, npm, and the `gcloud` CLI installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/andysturrock/trainbot.git
    cd trainbot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3. **Install and start the Firestore emulator:**
    ```bash
    gcloud components install beta
    gcloud beta emulators firestore start --host-port=localhost:8080
    ```

4.  **Configure environment variables:**
    Create a `.env` file by copying the `.env.example` file:
    ```bash
    cp .env.example .env
    ```
    Then, fill in the required values in the `.env` file. You will also need to set the following environment variables for the emulator:
    ```
    FIRESTORE_EMULATOR_HOST=localhost:8080
    GCP_PROJECT_ID=local-project
    ```

5.  **Run the application:**
    ```bash
    npm run dev
    ```
    The application will be running on `http://localhost:3000`.

## Running in GCP

To deploy the application to GCP, you will need to have the gcloud CLI installed and authenticated. You will also need to have a GCP project with the GKE, Secret Manager, and Firestore (in Native Mode) APIs enabled.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/andysturrock/trainbot.git
    cd trainbot
    ```

2.  **Authenticate gcloud and set project:**
    Log in to your Google Cloud account and set your default project:
    ```bash
    gcloud auth login
    gcloud config set project <YOUR_GCP_PROJECT_ID>
    ```
    Replace `<YOUR_GCP_PROJECT_ID>` with your actual GCP project ID.

3.  **Set Default GCP Compute Region:**
    It's recommended to set a default compute region for your `gcloud` CLI. Replace `<REGION>` with your desired GCP region (e.g., `europe-west2`):
    ```bash
    gcloud config set compute/region <REGION>
    ```

4.  **Authorize Cloud Storage Service Account for KMS:**
    If your organization policy requires Customer-Managed Encryption Keys (CMEK) for GCS buckets, you need to authorize the Cloud Storage service account to use your KMS key.

    Run the following command:
    ```bash
    gsutil kms authorize \
      -k projects/prj-i-solid-ocelot-cf27/locations/europe-west2/keyRings/prj-i-solid-ocelot-cf27-default-cmek-key-ring/cryptoKeys/default-cmek-key \
      -p prj-i-solid-ocelot-cf27
    ```
    Ensure the `projects`, `locations`, `keyRings`, `cryptoKeys`, and `key` names match your organization's setup.

5.  **Create the GCS Bucket for Terraform State:**
    Terraform will store its state file in a GCS bucket. You must create this bucket before initializing Terraform.

    Run the following commands, replacing `<YOUR_UNIQUE_BUCKET_NAME>` with a globally unique name:
    ```bash
    # Set your bucket name and CMEK key details
    TF_STATE_BUCKET="<YOUR_UNIQUE_BUCKET_NAME>"
    GCP_PROJECT_ID=$(gcloud config get-value project) # This will be your currently configured gcloud project
    KEY_RING_NAME="prj-i-solid-ocelot-cf27-default-cmek-key-ring" # User-provided keyring name
    KEY_NAME="default-cmek-key" # User-provided key name
    GCP_REGION=$(gcloud config get-value compute/region) # This should be your default region, e.g., europe-west2

    # Create the bucket with the CMEK key
    gsutil mb -p $GCP_PROJECT_ID -l $GCP_REGION -k "projects/$GCP_PROJECT_ID/locations/$GCP_REGION/keyRings/$KEY_RING_NAME/cryptoKeys/$KEY_NAME" gs://$TF_STATE_BUCKET

    # Enable versioning on the bucket (best practice for state files)
    gsutil versioning set on gs://$TF_STATE_BUCKET
    ```
    Remember the bucket name you chose for the next step.

6.  **Configure Terraform variables:**
    Create a `terraform.tfvars` file in the `terraform` directory by copying the `terraform/terraform.tfvars.example` file:
    ```bash
    cp terraform/terraform.tfvars.example terraform/terraform.tfvars
    ```
    Then, fill in the required values in the `terraform/terraform.tfvars` file.

7.  **Initialize and Apply the Terraform configuration:**
    Navigate to the terraform directory. When you initialize Terraform, you must pass the name of the GCS bucket you created.
    ```bash
    # Ensure TF_STATE_BUCKET is exported in your shell
    export TF_STATE_BUCKET="<YOUR_UNIQUE_BUCKET_NAME>" # Replace with the bucket name you created earlier
    cd terraform
    terraform init -backend-config="bucket=$TF_STATE_BUCKET"
    terraform apply
    ```
    This will create the GKE cluster, the Secret Manager secret, the Firestore database, and all the other necessary resources.

8.  **Build and push the Docker image:**
    First, configure Docker to use the gcloud CLI for authentication:
    ```bash
    gcloud auth configure-docker
    ```
    Then, build and push the Docker image to Google Container Registry (GCR). Make sure to replace `your-gcp-project-id` with your actual GCP project ID.
    ```bash
    docker build -t gcr.io/your-gcp-project-id/trainbot:latest .
    docker push gcr.io/your-gcp-project-id/trainbot:latest
    ```

9.  **Deployment to GKE:**
    The Terraform configuration already includes the Kubernetes deployment and service. Once the Docker image is pushed to GCR, GKE will automatically pull the image and deploy the application. You can get the external IP address of the service by running:
    ```bash
    kubectl get svc trainbot
    ```
    You will then need to update your Slack app's request URL to point to this IP address.

