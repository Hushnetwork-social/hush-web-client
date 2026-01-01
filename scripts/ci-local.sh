#!/bin/bash
# Local CI Script - Mirrors GitHub Actions workflow
# Run this before pushing to catch issues early
#
# Usage: ./scripts/ci-local.sh

set -e  # Exit on any error

echo "========================================"
echo "  Hush Web Client - Local CI Check"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track timing
START_TIME=$(date +%s)

# Step 1: Install dependencies
echo -e "${YELLOW}[1/4] Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 2: Lint
echo -e "${YELLOW}[2/4] Running ESLint...${NC}"
if npm run lint; then
    echo -e "${GREEN}✓ Lint passed${NC}"
else
    echo -e "${RED}✗ Lint failed${NC}"
    exit 1
fi
echo ""

# Step 3: Tests
echo -e "${YELLOW}[3/4] Running tests...${NC}"
if npm run test:run; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    exit 1
fi
echo ""

# Step 4: Build
echo -e "${YELLOW}[4/4] Building for production...${NC}"
if npm run build; then
    echo -e "${GREEN}✓ Build succeeded${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Calculate elapsed time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo -e "${GREEN}  All checks passed!${NC}"
echo "  Total time: ${ELAPSED}s"
echo "========================================"
echo ""
echo "Ready to push to GitHub."
