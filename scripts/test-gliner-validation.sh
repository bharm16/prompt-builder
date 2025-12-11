#!/bin/bash
# GLiNER Validation Test Suite
# Run: chmod +x scripts/test-gliner-validation.sh && ./scripts/test-gliner-validation.sh

API_KEY="dev-test-key-12345"
BASE_URL="http://localhost:3001/api/test-nlp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "GLiNER Neuro-Symbolic Pipeline Validation"
echo "=============================================="
echo ""

# Function to run test
run_test() {
  local name="$1"
  local prompt="$2"
  local expected_closed="$3"
  local expected_open="$4"
  
  echo -e "${YELLOW}Test: $name${NC}"
  echo "Prompt: \"$prompt\""
  
  # URL encode the prompt
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$prompt'))")
  
  result=$(curl -s "$BASE_URL?prompt=$encoded" -H "x-api-key: $API_KEY")
  
  if [ -z "$result" ]; then
    echo -e "${RED}✗ FAILED: No response from server${NC}"
    echo ""
    return 1
  fi
  
  # Parse results
  total=$(echo "$result" | jq -r '.stats.totalSpans // 0')
  closed=$(echo "$result" | jq -r '.stats.closedVocabSpans // 0')
  open=$(echo "$result" | jq -r '.stats.openVocabSpans // 0')
  tier1_latency=$(echo "$result" | jq -r '.stats.tier1Latency // 0')
  tier2_latency=$(echo "$result" | jq -r '.stats.tier2Latency // 0')
  
  echo "Results: total=$total, closed=$closed (Aho-Corasick), open=$open (GLiNER)"
  echo "Latency: Tier1=${tier1_latency}ms, Tier2=${tier2_latency}ms"
  
  # Show extracted spans
  echo "Spans:"
  echo "$result" | jq -r '.spans[] | "  - \(.text) → \(.role) (\(.confidence))"' 2>/dev/null || echo "  (none)"
  
  # Validation
  local pass=true
  
  if [ "$expected_closed" != "any" ] && [ "$closed" -lt "$expected_closed" ]; then
    echo -e "${RED}✗ Expected at least $expected_closed closed vocab spans, got $closed${NC}"
    pass=false
  fi
  
  if [ "$expected_open" != "any" ] && [ "$open" -lt "$expected_open" ]; then
    echo -e "${RED}✗ Expected at least $expected_open open vocab spans, got $open${NC}"
    pass=false
  fi
  
  if [ "$pass" = true ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
  fi
  
  echo ""
  return 0
}

# ============================================
# Test Suite
# ============================================

echo "--- TIER 1: Aho-Corasick (Technical Terms) ---"
echo ""

run_test "Technical terms only" \
  "dolly forward pan left steadicam tracking shot" \
  3 0

run_test "Frame rates and aspect ratios" \
  "24fps 16:9 4K resolution slow motion" \
  2 0

run_test "Camera movements" \
  "crane shot tilt up zoom in handheld footage" \
  3 0

echo "--- TIER 2: GLiNER (Semantic Entities) ---"
echo ""

run_test "Pure semantic (no technical)" \
  "a woman walking through Tokyo at night" \
  0 2

run_test "Subjects and locations" \
  "an elderly man sitting in a Paris cafe drinking coffee" \
  0 3

run_test "Actions and emotions" \
  "a child laughing joyfully while running through a meadow" \
  0 2

echo "--- COMBINED: Both Tiers ---"
echo ""

run_test "Cinematic + semantic" \
  "A cinematic tracking shot of a woman walking through a neon-lit Tokyo street at night" \
  1 2

run_test "Full video prompt" \
  "Dolly forward through a misty forest at dawn, following a deer as it walks between ancient oak trees, golden hour lighting, 24fps, 16:9 aspect ratio" \
  3 3

run_test "Complex scene" \
  "Aerial drone shot descending over Manhattan skyline at sunset, camera tilts down to reveal busy streets below, cinematic color grade" \
  2 2

echo "--- EDGE CASES ---"
echo ""

run_test "Empty-ish prompt" \
  "the" \
  0 0

run_test "Very short" \
  "cat" \
  0 1

run_test "Ambiguous terms (pan - cooking vs camera)" \
  "pan the camera left to show the kitchen" \
  0 any

run_test "Numbers and specs" \
  "1920x1080 60fps HDR10" \
  1 0

echo "=============================================="
echo "Validation Complete"
echo "=============================================="
