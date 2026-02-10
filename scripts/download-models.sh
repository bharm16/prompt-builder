#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODEL_DIR="${SPAN_LABELING_MODEL_DIR:-${ROOT_DIR}/server/src/llm/span-labeling/nlp/models}"
MODEL_FILE="${MODEL_DIR}/model.onnx"
MODEL_SOURCE_URI="${SPAN_LABELING_MODELS_GCS_URI:-}"

if [[ -f "${MODEL_FILE}" ]]; then
  echo "Span-labeling models already present at ${MODEL_DIR}; skipping download."
  exit 0
fi

if [[ -z "${MODEL_SOURCE_URI}" ]]; then
  echo "Missing SPAN_LABELING_MODELS_GCS_URI and no local model assets found."
  echo "Set SPAN_LABELING_MODELS_GCS_URI (for example: gs://your-bucket/span-labeling/models/) and rerun:"
  echo "  npm run download-models"
  exit 1
fi

if [[ "${MODEL_SOURCE_URI}" != gs://* ]]; then
  echo "SPAN_LABELING_MODELS_GCS_URI must be a gs:// URI. Received: ${MODEL_SOURCE_URI}"
  exit 1
fi

TMP_DIR="$(mktemp -d "${MODEL_DIR%/}.tmp.XXXXXX")"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

parse_bucket_name() {
  local uri="$1"
  local without_scheme
  without_scheme="${uri#gs://}"
  echo "${without_scheme%%/*}"
}

download_with_gsutil() {
  echo "Downloading span-labeling models via gsutil from ${MODEL_SOURCE_URI} ..."
  gsutil -m cp -r "${MODEL_SOURCE_URI%/}/." "${TMP_DIR}/"
}

download_with_gcloud() {
  echo "Downloading span-labeling models via gcloud from ${MODEL_SOURCE_URI} ..."
  gcloud storage cp --recursive "${MODEL_SOURCE_URI%/}/." "${TMP_DIR}/"
}

download_with_node_sdk() {
  echo "Downloading span-labeling models via @google-cloud/storage from ${MODEL_SOURCE_URI} ..."

  MODEL_SOURCE_URI="${MODEL_SOURCE_URI}" DEST_DIR="${TMP_DIR}" node --input-type=module <<'NODE'
import { Storage } from '@google-cloud/storage';
import fs from 'node:fs/promises';
import path from 'node:path';

const sourceUri = process.env.MODEL_SOURCE_URI;
const destinationDir = process.env.DEST_DIR;

if (!sourceUri || !destinationDir) {
  throw new Error('MODEL_SOURCE_URI and DEST_DIR are required');
}

const match = /^gs:\/\/([^/]+)\/?(.*)$/.exec(sourceUri);
if (!match) {
  throw new Error(`Invalid gs:// URI: ${sourceUri}`);
}

const bucketName = match[1];
let prefix = (match[2] || '').replace(/^\/+|\/+$/g, '');
if (prefix.length > 0) {
  prefix = `${prefix}/`;
}

const storage = new Storage();
const bucket = storage.bucket(bucketName);
const [files] = await bucket.getFiles({ prefix });

const objects = files.filter((file) => file.name !== prefix && !file.name.endsWith('/'));
if (objects.length === 0) {
  throw new Error(`No model files found at ${sourceUri}`);
}

const concurrency = 4;
let index = 0;

const worker = async () => {
  while (true) {
    const current = index;
    index += 1;
    if (current >= objects.length) break;

    const file = objects[current];
    const relativePath = prefix ? file.name.slice(prefix.length) : file.name;
    const destinationPath = path.join(destinationDir, relativePath);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await file.download({ destination: destinationPath });
  }
};

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(`Downloaded ${objects.length} object(s) from ${sourceUri}`);
NODE
}

mkdir -p "${MODEL_DIR}"

if command -v gsutil >/dev/null 2>&1; then
  download_with_gsutil
elif command -v gcloud >/dev/null 2>&1; then
  if gcloud storage ls "gs://$(parse_bucket_name "${MODEL_SOURCE_URI}")" >/dev/null 2>&1; then
    download_with_gcloud
  else
    download_with_node_sdk
  fi
else
  download_with_node_sdk
fi

if [[ -z "$(find "${TMP_DIR}" -type f -print -quit)" ]]; then
  echo "Download completed but no files were fetched from ${MODEL_SOURCE_URI}."
  exit 1
fi

rm -rf "${MODEL_DIR}"
mkdir -p "${MODEL_DIR}"
cp -R "${TMP_DIR}/." "${MODEL_DIR}/"

if [[ ! -f "${MODEL_FILE}" ]]; then
  echo "Downloaded assets, but required file is missing: ${MODEL_FILE}"
  exit 1
fi

echo "Span-labeling models downloaded to ${MODEL_DIR}"
