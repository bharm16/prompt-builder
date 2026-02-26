#!/usr/bin/env bash
set -euo pipefail

# Firestore Export Script
# Exports Firestore data to a GCS bucket for backup/DR purposes.
#
# Usage:
#   scripts/ops/firestore-export.sh --project <PROJECT_ID> [--collections col1,col2]
#
# Environment:
#   FIRESTORE_BACKUP_BUCKET - Override default backup bucket name

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT=""
COLLECTIONS=""
BUCKET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --collections)
      COLLECTIONS="$2"
      shift 2
      ;;
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 --project <PROJECT_ID> [--collections col1,col2] [--bucket gs://...]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT" ]]; then
  echo "Error: --project is required" >&2
  exit 1
fi

BUCKET="${BUCKET:-${FIRESTORE_BACKUP_BUCKET:-gs://${PROJECT}-firestore-backups}}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EXPORT_PATH="${BUCKET}/exports/${TIMESTAMP}"

echo "=== Firestore Export ==="
echo "Project:    $PROJECT"
echo "Bucket:     $BUCKET"
echo "Export to:  $EXPORT_PATH"
echo "Collections: ${COLLECTIONS:-all}"
echo ""

EXPORT_CMD=(gcloud firestore export "$EXPORT_PATH" --project "$PROJECT")

if [[ -n "$COLLECTIONS" ]]; then
  IFS=',' read -ra COLLECTION_ARRAY <<< "$COLLECTIONS"
  for col in "${COLLECTION_ARRAY[@]}"; do
    EXPORT_CMD+=(--collection-ids "$col")
  done
fi

echo "Running: ${EXPORT_CMD[*]}"
"${EXPORT_CMD[@]}"

echo ""
echo "Export complete: $EXPORT_PATH"
echo "Verify with: gcloud firestore operations list --project $PROJECT"
