# Quick Start Guide for Azure VM Deployment

This is a condensed version of the full deployment guide. For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

- Azure VM with Ubuntu 24.04
- SSH access
- Gemini API key

## Quick Deployment (5 Steps)

### 1. Install Required Software
```bash
# Run on Azure VM
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python, PostgreSQL, PM2, Nginx
sudo apt install -y python3 python3-pip python3-venv postgresql postgresql-contrib nginx git
sudo npm install -g pm2
```

### 2. Set Up PostgreSQL Database
```bash
sudo -u postgres psql << EOF
CREATE DATABASE ask_the_expert;
CREATE USER ask_expert_user WITH PASSWORD 'YourSecurePassword123';
GRANT ALL PRIVILEGES ON DATABASE ask_the_expert TO ask_expert_user;
\c ask_the_expert
GRANT ALL ON SCHEMA public TO ask_expert_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ask_expert_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ask_expert_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ask_expert_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ask_expert_user;
\q
EOF
```

### 3. Transfer and Set Up Project

**Transfer project from your local machine:**
```bash
# On your local machine
cd /path/to/project
tar -czf project.tar.gz --exclude='node_modules' --exclude='venv' --exclude='chroma_db' --exclude='chroma_chat_db' --exclude='chroma_twins_db' .
scp -i "rpa-data-vm-3-key-2 1.pem" project.tar.gz azureuser@74.225.252.224:~
```

**On Azure VM:**
```bash
cd ~
tar -xzf project.tar.gz
mkdir ask-the-expert && cd ask-the-expert
tar -xzf ../project.tar.gz

# Create .env file
nano .env
```

**Add to .env:**
```env
DATABASE_URL=postgresql://ask_expert_user:YourSecurePassword123@localhost:5432/ask_the_expert
PGHOST=localhost
PGPORT=5432
PGUSER=ask_expert_user
PGPASSWORD=YourSecurePassword123
PGDATABASE=ask_the_expert
SESSION_SECRET=$(openssl rand -base64 32)
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=production
```

**Run deployment script:**
```bash
chmod +x deploy-azure.sh
./deploy-azure.sh
```

### 4. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/ask-the-expert
```

**Add:**
```nginx
server {
    listen 80;
    server_name 74.225.252.224;
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable and restart:**
```bash
sudo ln -s /etc/nginx/sites-available/ask-the-expert /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Set Up PM2 Auto-Start
```bash
pm2 startup
# Run the command it outputs (includes sudo)
pm2 save
```

## Configure Azure Firewall

1. Go to Azure Portal
2. Navigate to VM → Networking → Network Security Group
3. Add inbound rules for ports 80 (HTTP) and 443 (HTTPS)

## Access Your Application

Open browser: `http://74.225.252.224`

## Common Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs

# Restart applications
pm2 restart all

# Monitor resources
pm2 monit

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

**Check if services are running:**
```bash
pm2 status
curl http://localhost:5000
curl http://localhost:8000/health
sudo systemctl status nginx postgresql
```

**View all logs:**
```bash
pm2 logs
sudo tail -f /var/log/nginx/error.log
```

**Restart everything:**
```bash
pm2 restart all
sudo systemctl restart nginx
```

## Next Steps

- Set up SSL with Let's Encrypt (see DEPLOYMENT.md Step 13)
- Configure automatic backups (see DEPLOYMENT.md)
- Set up monitoring
- Configure firewall with UFW

For complete details, see [DEPLOYMENT.md](DEPLOYMENT.md)
