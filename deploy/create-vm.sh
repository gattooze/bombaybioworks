#!/bin/bash
# Run from your Mac AFTER:
#   1. gcloud auth login  (or gcloud auth activate-service-account --key-file=serviceAccount.json if SA has compute perms)
#   2. gcloud config set project bombay-bioworks
#   3. Compute Engine API is enabled

ZONE=us-central1-a
INSTANCE=whatsapp-bot
PROJECT=bombay-bioworks

echo "=== Creating e2-micro VM ==="
gcloud compute instances create $INSTANCE \
  --project=$PROJECT \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server \
  --metadata=enable-oslogin=TRUE

echo ""
echo "=== Getting external IP ==="
gcloud compute instances describe $INSTANCE \
  --project=$PROJECT \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'

echo ""
echo "=== SSH into the VM and run setup: ==="
echo "  gcloud compute ssh $INSTANCE --zone=$ZONE"
echo "  Then paste and run setup-vm.sh"
