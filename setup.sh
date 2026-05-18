#!/bin/bash

# ==============================================================================
# LobeHub Full-stack Development Mode Setup Script
# ==============================================================================

# Exit immediately if any command fails
set -e

# ANSI escape codes for beautiful styling
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}  🚀 Starting LobeHub Full-stack Dev Environment Setup${NC}"
echo -e "${BLUE}======================================================================${NC}"

# Get the script directory to make paths relative to it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ------------------------------------------------------------------------------
# Step 1: Detect package manager (pnpm preferred, fallback to bun or npm)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}🔍 Detecting package manager...${NC}"
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
    echo -e "${GREEN}✓ Found pnpm${NC}"
elif command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
    echo -e "${GREEN}✓ Found bun${NC}"
else
    PKG_MANAGER="npm"
    echo -e "${YELLOW}⚠ pnpm and bun not found, falling back to npm${NC}"
fi

# ------------------------------------------------------------------------------
# Step 2: Sync and verify .env configuration file
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}⚙ Syncing and verifying .env configuration...${NC}"
if [ ! -f ".env" ]; then
    if [ -f "docker-compose/dev/.env" ]; then
        echo -e "${BLUE}Copying .env configuration from docker-compose/dev/.env...${NC}"
        cp docker-compose/dev/.env .env
        echo -e "${GREEN}✓ Created root .env using the docker-compose preset!${NC}"
    else
        echo -e "${RED}❌ Warning: No .env configuration template found in docker-compose/dev/.env.${NC}"
    fi
else
    # Verify if the root .env has key database variables
    if grep -q "DATABASE_URL" .env; then
        echo -e "${GREEN}✓ Root .env exists and is configured!${NC}"
    else
        echo -e "${YELLOW}⚠ Root .env exists but is missing DATABASE_URL. Copying preset...${NC}"
        cp docker-compose/dev/.env .env
        echo -e "${GREEN}✓ Synced root .env with docker-compose/dev/.env!${NC}"
    fi
fi

# ------------------------------------------------------------------------------
# Step 3: Install dependencies if missing
# ------------------------------------------------------------------------------
if [ ! -d "node_modules" ]; then
    echo -e "\n${YELLOW}📦 Installing dependencies using $PKG_MANAGER...${NC}"
    $PKG_MANAGER install
    echo -e "${GREEN}✓ Dependencies installed successfully!${NC}"
else
    echo -e "\n${GREEN}✓ node_modules found, skipping dependency installation.${NC}"
fi

# ------------------------------------------------------------------------------
# Step 4: Ensure Docker compose services are up
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}🐳 Ensuring Docker backend services are running...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker is not installed or not in PATH.${NC}"
    exit 1
fi

# Check if docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Error: Docker daemon is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

# Bring up backend services in detached mode
echo -e "${BLUE}Starting containers via Docker Compose...${NC}"
docker compose -f docker-compose/dev/docker-compose.yml up -d --wait postgresql redis rustfs searxng

# Bring up QStash service in detached mode
echo -e "${BLUE}Starting QStash service via Docker Compose...${NC}"
docker compose -f docker-compose/dev/docker-compose_qstash.yaml up -d --wait qstash

echo -e "${GREEN}✓ All backend containers (including QStash) are up and healthy!${NC}"

# ------------------------------------------------------------------------------
# Step 5: Run Database Migrations
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}🗄 Running database migrations...${NC}"
echo -e "${BLUE}Executing: $PKG_MANAGER run db:migrate${NC}"
$PKG_MANAGER run db:migrate
echo -e "${GREEN}✓ Database schema is up to date!${NC}"

# ------------------------------------------------------------------------------
# Step 5b: Seed Custom Telkomsel AI Provider
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}🌱 Seeding Custom Telkomsel AI Provider...${NC}"
echo -e "${BLUE}Executing: npx tsx scripts/seedTelkomselProvider.ts${NC}"
npx tsx scripts/seedTelkomselProvider.ts
echo -e "${GREEN}✓ Custom Telkomsel AI Provider is successfully seeded!${NC}"

# ------------------------------------------------------------------------------
# Step 6: Boot Local Marketplace & Dev Server
# ------------------------------------------------------------------------------
# Check if Port 3020 is in use, and release it automatically
PORT_3020_PIDS=$(lsof -t -i :3020 || true)
if [ -n "$PORT_3020_PIDS" ]; then
    echo -e "${BLUE}Releasing occupied port 3020 for Local Marketplace...${NC}"
    kill -9 $PORT_3020_PIDS 2>/dev/null || true
    sleep 1
fi

echo -e "${YELLOW}⚡ Starting Local Marketplace server on port 3020 in the background...${NC}"
npx http-server ./local-market -p 3020 --cors > /dev/null 2>&1 &
sleep 1

# Check if Port 3010 is in use, and ask to kill it if needed
PORT_3010_PIDS=$(lsof -t -i :3010 || true)
if [ -n "$PORT_3010_PIDS" ]; then
    PIDS_SPACE=$(echo "$PORT_3010_PIDS" | tr '\n' ' ')
    echo -e "\n${YELLOW}⚠ Port 3010 is currently occupied by PID(s): ${RED}$PIDS_SPACE${NC}"
    for pid in $PORT_3010_PIDS; do
        proc_name=$(ps -p $pid -o comm= 2>/dev/null || echo "Unknown Process")
        echo -e "   - PID $pid: $proc_name"
    done
    read -p "Would you like to terminate these process(es)? (y/N): " choice
    case "$choice" in 
        [yY][eE][sS]|[yY]) 
            echo -e "${BLUE}Terminating process(es)...${NC}"
            kill -9 $PORT_3010_PIDS 2>/dev/null || true
            sleep 1
            echo -e "${GREEN}✓ Port 3010 released!${NC}"
            ;;
        *)
            echo -e "${YELLOW}Continuing without terminating. Note that Next.js might fail to start if the port is busy.${NC}"
            ;;
    esac
fi

echo -e "\n${GREEN}🎉 Setup completed successfully!${NC}"
echo -e "${BLUE}----------------------------------------------------------------------${NC}"
echo -e "${GREEN}  Local App URL:  ${YELLOW}http://localhost:3010${NC}"
echo -e "${GREEN}  Local Market:   ${YELLOW}http://localhost:3020${NC}"
echo -e "${GREEN}  SearXNG Port:   ${YELLOW}http://localhost:8180${NC}"
echo -e "${GREEN}  S3 Console:     ${YELLOW}http://localhost:9001${NC}"
echo -e "${BLUE}----------------------------------------------------------------------${NC}"
echo -e "${BLUE}💡 Tip for Frontend Debugging:${NC}"
echo -e "   Open your browser console and type: ${YELLOW}localStorage.debug = 'lobe-*'${NC} then refresh!"
echo -e "${BLUE}----------------------------------------------------------------------${NC}"
echo -e "${YELLOW}⚡ Launching the dev server with full backend debug logs (DEBUG=lobe-*)...${NC}\n"

# Run development server with debug mode enabled
DEBUG=lobe-* $PKG_MANAGER run dev
