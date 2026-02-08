#!/usr/bin/env bash
set -euo pipefail

SHARDS="${VITEST_SHARDS:-8}"
MEMORY_MB="${VITEST_MEMORY_MB:-8192}"
BATCH_SIZE="${VITEST_BATCH_SIZE:-20}"
BATCH_TIMEOUT_SEC="${VITEST_BATCH_TIMEOUT_SEC:-900}"
REPORTER="${VITEST_REPORTER:-dot}"
SILENT="${VITEST_SILENT:-1}"
EXIT_CODE=0
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ALL_TEST_FILES=()
while IFS= read -r file; do
  ALL_TEST_FILES+=("${file}")
done < <(
  cd "${ROOT_DIR}" && rg --files \
    --glob '**/*.test.ts' \
    --glob '**/*.test.tsx' \
    --glob '**/*.test.js' \
    --glob '**/*.test.jsx' \
    --glob '**/*.spec.ts' \
    --glob '**/*.spec.tsx' \
    --glob '**/*.spec.js' \
    --glob '**/*.spec.jsx' \
    --glob '!**/node_modules/**' \
    --glob '!**/dist/**' \
    --glob '!**/e2e/**' \
    --glob '!tests/integration/**' \
    --glob '!docs/**' \
    | sort
)

if [ "${#ALL_TEST_FILES[@]}" -eq 0 ]; then
  echo "No unit test files found."
  exit 1
fi

for shard in $(seq 1 "${SHARDS}"); do
  shard_files=()
  for idx in "${!ALL_TEST_FILES[@]}"; do
    if (( (idx % SHARDS) + 1 == shard )); then
      shard_files+=("${ALL_TEST_FILES[$idx]}")
    fi
  done

  if [ "${#shard_files[@]}" -eq 0 ]; then
    continue
  fi

  echo
  echo "=== Running unit test shard ${shard}/${SHARDS} (${#shard_files[@]} files, heap ${MEMORY_MB}MB, batch ${BATCH_SIZE}, timeout ${BATCH_TIMEOUT_SEC}s) ==="

  batch_start=0
  while [ "${batch_start}" -lt "${#shard_files[@]}" ]; do
    batch_len="${BATCH_SIZE}"
    remaining=$(( ${#shard_files[@]} - batch_start ))
    if [ "${remaining}" -lt "${batch_len}" ]; then
      batch_len="${remaining}"
    fi
    batch_files=("${shard_files[@]:batch_start:batch_len}")
    batch_number=$(( (batch_start / BATCH_SIZE) + 1 ))
    total_batches=$(( (${#shard_files[@]} + BATCH_SIZE - 1) / BATCH_SIZE ))

    echo "--- Shard ${shard}/${SHARDS} batch ${batch_number}/${total_batches} (${batch_len} files) ---"
    vitest_args=(
      --pool=forks
      --poolOptions.forks.maxForks=1
      --reporter="${REPORTER}"
      --config
      config/test/vitest.config.js
    )
    if [ "${SILENT}" = "1" ]; then
      vitest_args+=(--silent=passed-only)
    fi
    vitest_args+=("${batch_files[@]}")
    NODE_OPTIONS="--max-old-space-size=${MEMORY_MB}" npx vitest run "${vitest_args[@]}" &
    batch_pid=$!
    started_at=$(date +%s)

    while kill -0 "${batch_pid}" 2>/dev/null; do
      now=$(date +%s)
      elapsed=$((now - started_at))
      if [ "${elapsed}" -ge "${BATCH_TIMEOUT_SEC}" ]; then
        echo "Batch ${batch_number}/${total_batches} in shard ${shard}/${SHARDS} timed out after ${BATCH_TIMEOUT_SEC}s. Killing process ${batch_pid}."
        kill -TERM "${batch_pid}" 2>/dev/null || true
        sleep 2
        kill -KILL "${batch_pid}" 2>/dev/null || true
        EXIT_CODE=1
        break
      fi
      sleep 2
    done

    if wait "${batch_pid}"; then
      :
    else
      EXIT_CODE=1
    fi

    batch_start=$((batch_start + batch_len))
  done
done

exit "${EXIT_CODE}"
