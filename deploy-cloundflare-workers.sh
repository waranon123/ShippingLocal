#!/bin/bash

# 🚀 Complete Cloudflare Workers + Pages Deployment Script

set -e # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "🚀 CLOUDFLARE WORKERS + PAGES DEPLOYMENT"
echo "========================================"
echo -e "${NC}"

# Check requirements
echo -e "${YELLOW}🔍 Checking requirements...${NC}"

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Requirements satisfied${NC}"

# Step 1: Setup Backend Workers
echo -e "${YELLOW}📦 Setting up Backend (Cloudflare Workers)...${NC}"

if [ ! -d "backend-workers" ]; then
    echo -e "${YELLOW}📁 Creating backend-workers directory...${NC}"
    mkdir -p backend-workers/src
    cd backend-workers
    
    # Copy the generated files (you need to create these first)
    echo -e "${YELLOW}📝 Please create the following files first:${NC}"
    echo "  - backend-workers/src/index.js"
    echo "  - backend-workers/package.json" 
    echo "  - backend-workers/wrangler.toml"
    echo "  - backend-workers/schema.sql"
    echo ""
    echo "Then run this script again."
    exit 1
else
    cd backend-workers
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
npm install

# Login to Cloudflare (if not already)
echo -e "${YELLOW}🔐 Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Cloudflare:${NC}"
    wrangler login
fi

# Create D1 databases
echo -e "${YELLOW}🗄️ Creating D1 databases...${NC}"

# Development database
echo -e "${YELLOW}Creating development database...${NC}"
DEV_DB_OUTPUT=$(wrangler d1 create truck-management-dev 2>/dev/null || echo "Database may already exist")
echo "$DEV_DB_OUTPUT"

# Production database  
echo -e "${YELLOW}Creating production database...${NC}"
PROD_DB_OUTPUT=$(wrangler d1 create truck-management-prod 2>/dev/null || echo "Database may already exist")
echo "$PROD_DB_OUTPUT"

echo -e "${BLUE}📝 Please update wrangler.toml with the database IDs shown above${NC}"
echo -e "${BLUE}Press Enter when ready to continue...${NC}"
read

# Setup database schema
echo -e "${YELLOW}📋 Setting up database schema...${NC}"
echo "Setting up development database..."
wrangler d1 execute truck-management-dev --env development --file=./schema.sql

echo "Setting up production database..."
wrangler d1 execute truck-management-prod --env production --file=./schema.sql

# Deploy backend
echo -e "${YELLOW}🚀 Deploying backend to Workers...${NC}"
wrangler deploy --env production

# Get worker URL
WORKER_URL=$(wrangler whoami | grep -o 'https://[^.]*\.workers\.dev' | head -1)
if [ -z "$WORKER_URL" ]; then
    echo -e "${YELLOW}Please enter your Worker URL (e.g., https://truck-management-backend.your-subdomain.workers.dev):${NC}"
    read WORKER_URL
fi

echo -e "${GREEN}✅ Backend deployed to: $WORKER_URL${NC}"

# Step 2: Setup Frontend
echo -e "${YELLOW}🎨 Setting up Frontend (Cloudflare Pages)...${NC}"
cd ../frontend

# Update environment variables
echo -e "${YELLOW}📝 Updating frontend environment...${NC}"
cat > .env.production << EOF
VITE_API_BASE_URL=$WORKER_URL
VITE_ENVIRONMENT=production
EOF

# Install dependencies
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
npm install

# Build for production
echo -e "${YELLOW}🏗️ Building frontend...${NC}"
npm run build

# Deploy to Pages
echo -e "${YELLOW}🚀 Deploying to Cloudflare Pages...${NC}"

# Create Pages project if doesn't exist
npx wrangler pages project create truck-management 2>/dev/null || echo "Project may already exist"

# Deploy
npx wrangler pages deploy dist --project-name=truck-management

# Get Pages URL
PAGES_URL="https://truck-management.pages.dev"

echo -e "${GREEN}"
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "====================================="
echo -e "${NC}"
echo -e "${GREEN}Frontend URL: $PAGES_URL${NC}"
echo -e "${GREEN}Backend URL:  $WORKER_URL${NC}"
echo -e "${GREEN}Database:     D1 SQLite (Serverless)${NC}"
echo -e "${GREEN}Cost:         FREE! 🆓${NC}"
echo ""
echo -e "${BLUE}📋 Default Login Credentials:${NC}"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo -e "${BLUE}📊 Quotas:${NC}"
echo "  Workers: 100,000 requests/day"
echo "  Pages: Unlimited"
echo "  D1: 5M reads, 100K writes/day"
echo ""
echo -e "${YELLOW}🔧 Next Steps:${NC}"
echo "1. Test the application at $PAGES_URL"
echo "2. Set up custom domain (optional)"
echo "3. Configure environment variables as needed"
echo "4. Monitor usage in Cloudflare Dashboard"

# Optional: Open in browser
if command -v open &> /dev/null; then
    echo -e "${YELLOW}🌐 Opening application in browser...${NC}"
    open "$PAGES_URL"
elif command -v xdg-open &> /dev/null; then
    echo -e "${YELLOW}🌐 Opening application in browser...${NC}"
    xdg-open "$PAGES_URL"
fi

echo -e "${GREEN}✨ Deployment script completed!${NC}"