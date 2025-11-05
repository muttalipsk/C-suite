#!/bin/bash
# Azure VM Deployment Script for Ask the Expert
# Run this script on your Azure VM after transferring the project files

set -e  # Exit on any error

echo "=================================================="
echo "Ask the Expert - Azure VM Deployment Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   print_error "Please do not run this script as root (without sudo)"
   exit 1
fi

# Get project directory
PROJECT_DIR=$(pwd)
print_info "Project directory: $PROJECT_DIR"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_info "Please create a .env file with required variables:"
    echo ""
    echo "First, generate a SESSION_SECRET:"
    echo "  openssl rand -base64 32"
    echo ""
    echo "Then create .env with these variables:"
    echo "  - DATABASE_URL=postgresql://ask_expert_user:password@localhost:5432/ask_the_expert"
    echo "  - SESSION_SECRET=<paste the generated secret here>"
    echo "  - GEMINI_API_KEY=your_gemini_api_key_here"
    echo "  - NODE_ENV=production"
    echo ""
    echo "See DEPLOYMENT.md or QUICK_START.md for complete instructions."
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
if [ -z "$DATABASE_URL" ] || [ -z "$SESSION_SECRET" ] || [ -z "$GEMINI_API_KEY" ]; then
    print_error "Missing required environment variables in .env file"
    exit 1
fi

print_step "Installing Node.js dependencies..."
npm install

print_step "Creating Python virtual environment..."
python3 -m venv venv

print_step "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt
deactivate

print_step "Running database migrations..."
npm run db:push || npm run db:push --force

print_step "Building frontend..."
npm run build

print_step "Setting up PM2 ecosystem config..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'ask-expert-node',
      script: 'npm',
      args: 'start',
      cwd: '$PROJECT_DIR',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'ask-expert-python',
      script: '$PROJECT_DIR/venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: '$PROJECT_DIR',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    }
  ]
};
EOF

print_step "Starting applications with PM2..."
pm2 start ecosystem.config.js

print_step "Saving PM2 configuration..."
pm2 save

print_step "Checking application status..."
pm2 status

echo ""
echo "=================================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=================================================="
echo ""
print_info "Next steps:"
echo "  1. Configure Nginx (see DEPLOYMENT.md Step 10)"
echo "  2. Set up PM2 startup: pm2 startup (follow the command it outputs)"
echo "  3. Configure Azure Network Security Group for ports 80/443"
echo "  4. Access your app at http://$(hostname -I | awk '{print $1}')"
echo ""
print_info "Useful commands:"
echo "  - View logs: pm2 logs"
echo "  - Restart apps: pm2 restart all"
echo "  - Stop apps: pm2 stop all"
echo "  - Monitor: pm2 monit"
echo ""
