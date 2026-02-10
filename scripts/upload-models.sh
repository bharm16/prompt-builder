#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODEL_DIR="${SPAN_LABELING_MODEL_DIR:-${ROOT_DIR}/server/src/llm/span-labeling/nlp/models}"
MODEL_FILE="${MODEL_DIR}/model.onnx"
MODEL_SOURCE_URI="${SPAN_LABELING_MODELS_GCS_URI:-}"

if [[ -z "${MODEL_SOURCE_URI}" ]]; then
  echo "Missing SPAN_LABELING_MODELS_GCS_URI."
  echo "Set SPAN_LABELING_MODELS_GCS_URI (for example: gs://your-bucket/span-labeling/models/) and rerun:"
  echo "  npm run upload-models"
  exit 1
fi

if [[ "${MODEL_SOURCE_URI}" != gs://* ]]; then
  echo "SPAN_LABELING_MODELS_GCS_URI must be a gs:// URI. Received: ${MODEL_SOURCE_URI}"
  exit 1
fi

if [[ ! -f "${MODEL_FILE}" ]]; then
  echo "Required file not found: ${MODEL_FILE}"
  echo "Download models first or point SPAN_LABELING_MODEL_DIR to a populated directory."
  exit 1
fi

if command -v gsutil >/dev/null 2>&1; then
  echo "Uploading span-labeling models via gsutil to ${MODEL_SOURCE_URI} ..."
  gsutil -m rsync -r "${MODEL_DIR}" "${MODEL_SOURCE_URI}"
  exit 0
fi

if command -v gcloud >/dev/null 2>&1; then
  echo "Uploading span-labeling models via gcloud to ${MODEL_SOURCE_URI} ..."
  gcloud storage rsync --recursive "${MODEL_DIR}" "${MODEL_SOURCE_URI}"
  exit 0
fi

echo "Uploading span-labeling models via @google-cloud/storage to ${MODEL_SOURCE_URI} ..."

MODEL_SOURCE_URI="${MODEL_SOURCE_URI}" MODEL_DIR="${MODEL_DIR}" node --input-type=module <<'NODE'
import { Storage } from '@google-cloud/storage';
import fs from 'node:fs/promises';
import path from 'node:path';

const sourceUri = process.env.MODEL_SOURCE_URI;
const modelDir = process.env.MODEL_DIR;

if (!sourceUri || !modelDir) {
  throw new Error('MODEL_SOURCE_URI and MODEL_DIR are required');
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

async function listFiles(dir, root) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, root)));
      continue;
    }
    if (entry.isFile()) {
      files.push(path.relative(root, absolute));
    }
  }

  return files;
}

const relativeFiles = await listFiles(modelDir, modelDir);
if (relativeFiles.length === 0) {
  throw new Error(`No files found in ${modelDir}`);
}

const concurrency = 4;
let index = 0;

const worker = async () => {
  while (true) {
    const current = index;
    index += 1;
    if (current >= relativeFiles.length) break;

    const relativePath = relativeFiles[current];
    const sourcePath = path.join(modelDir, relativePath);
    const objectPath = `${prefix}${relativePath.replaceAll(path.sep, '/')}`;

    await bucket.upload(sourcePath, { destination: objectPath });
  }
};

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(`Uploaded ${relativeFiles.length} object(s) to ${sourceUri}`);
NODE

echo "Span-labeling models uploaded to ${MODEL_SOURCE_URI}"
