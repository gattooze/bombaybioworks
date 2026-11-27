#!/usr/bin/env bash
# Deploy the Hivemind MCP server to Cloud Run. Run from Cloud Shell (or any shell
# logged in to gcloud as a project owner). Safe to re-run: existing resources are kept.
set -euo pipefail
P=${PROJECT:-bombay-bioworks}
R=${REGION:-asia-south1}
SA=hivemind-mcp@$P.iam.gserviceaccount.com
cd "$(dirname "$0")/.."   # hivemind/

echo "1/5 Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project "$P"

echo "2/5 Secret"
gcloud secrets describe hivemind-mcp-secret --project "$P" >/dev/null 2>&1 \
  || (openssl rand -hex 32 | tr -d '\n' | gcloud secrets create hivemind-mcp-secret --data-file=- --project "$P")

echo "3/5 Service account (Firestore read/write only)"
gcloud iam service-accounts describe "$SA" --project "$P" >/dev/null 2>&1 \
  || gcloud iam service-accounts create hivemind-mcp --display-name "Hivemind MCP" --project "$P"
gcloud projects add-iam-policy-binding "$P" --member "serviceAccount:$SA" --role roles/datastore.user --condition None --format none
gcloud secrets add-iam-policy-binding hivemind-mcp-secret --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor --project "$P" --format none
# Source deploys build with the default compute service account, which new projects leave without build rights.
NUM=$(gcloud projects describe "$P" --format 'value(projectNumber)')
gcloud projects add-iam-policy-binding "$P" --member "serviceAccount:$NUM-compute@developer.gserviceaccount.com" --role roles/run.builder --condition None --format none

echo "4/5 Building and deploying (3 to 5 minutes)"
cp mcp/Dockerfile Dockerfile
trap 'rm -f Dockerfile' EXIT
gcloud run deploy hivemind-mcp --source . --project "$P" --region "$R" \
  --service-account "$SA" --allow-unauthenticated \
  --min-instances 0 --max-instances 2 --memory 512Mi \
  --set-secrets MCP_SECRET=hivemind-mcp-secret:latest --quiet

echo "5/5 Checking"
URL=$(gcloud run services describe hivemind-mcp --project "$P" --region "$R" --format 'value(status.url)')
curl -fsS "$URL/health" && echo " <- health check"
echo
echo "Connector URL (keep it private, it grants access to Hivemind):"
echo "$URL/mcp/$(gcloud secrets versions access latest --secret hivemind-mcp-secret --project "$P")"
