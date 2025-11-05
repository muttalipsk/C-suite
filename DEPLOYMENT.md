# Azure VM Deployment Guide

Complete guide to deploy the Ask the Expert application on Ubuntu 24.04 Azure VM.

## Prerequisites

- Azure VM running Ubuntu 24.04.3 LTS
- SSH access to the VM (azureuser@74.225.252.224)
- Domain name (optional, for SSL)
- Gemini API key

---

## Step 1: Connect to Your Azure VM

```bash
ssh -i "rpa-data-vm-3-key-2 1.pem" azureuser@74.225.252.224
```

---

## Step 2: Install Required Software

### 2.1 Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### 2.2 Install Node.js 20.x
```bash
# Install Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x
npm --version
```

### 2.3 Install Python 3.11 and pip
```bash
# Python 3.11 should be available on Ubuntu 24.04
sudo apt install -y python3 python3-pip python3-venv

# Verify installation
python3 --version  # Should show Python 3.11+
pip3 --version
```

### 2.4 Install PostgreSQL 16
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo systemctl status postgresql
```

### 2.5 Install Git
```bash
sudo apt install -y git
```

### 2.6 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 2.7 Install Nginx (Web Server)
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## Step 3: Set Up PostgreSQL Database

### 3.1 Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt, run:
CREATE DATABASE ask_the_expert;
CREATE USER ask_expert_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE ask_the_expert TO ask_expert_user;

# Grant schema privileges (PostgreSQL 15+)
\c ask_the_expert
GRANT ALL ON SCHEMA public TO ask_expert_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ask_expert_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ask_expert_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ask_expert_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ask_expert_user;

# Exit PostgreSQL
\q
```

### 3.2 Note Your Database Connection String
```
DATABASE_URL=postgresql://ask_expert_user:your_secure_password_here@localhost:5432/ask_the_expert
```

---

## Step 4: Transfer Project Files to Azure VM

### Option A: Using Git (Recommended if you have a Git repository)
```bash
# Clone your repository
cd ~
git clone https://github.com/yourusername/ask-the-expert.git
cd ask-the-expert
```

### Option B: Using SCP (From Your Local Machine)
```bash
# From your local machine (not on the VM)
# Compress the project folder first (excluding node_modules and generated files)
cd /path/to/your/project
tar -czf project.tar.gz \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='chroma_db' \
  --exclude='chroma_chat_db' \
  --exclude='chroma_twins_db' \
  --exclude='dist' \
  --exclude='uploads' \
  .

# Transfer to Azure VM
scp -i "rpa-data-vm-3-key-2 1.pem" project.tar.gz azureuser@74.225.252.224:~

# On the Azure VM, create directory and extract
cd ~
mkdir -p ask-the-expert
tar -xzf project.tar.gz -C ask-the-expert
cd ask-the-expert
```

---

## Step 5: Install Project Dependencies

### 5.1 Install Node.js Dependencies
```bash
cd ~/ask-the-expert
npm install
```

### 5.2 Install Python Dependencies
```bash
cd ~/ask-the-expert

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Deactivate for now
deactivate
```

---

## Step 6: Configure Environment Variables

### 6.1 Create .env File
```bash
cd ~/ask-the-expert
nano .env
```

### 6.2 Add Environment Variables

**First, generate a secure session secret:**
```bash
openssl rand -base64 32
```
Copy the output and use it in the SESSION_SECRET field below.

**Then add these environment variables to .env:**
```env
# Database
DATABASE_URL=postgresql://ask_expert_user:your_secure_password_here@localhost:5432/ask_the_expert
PGHOST=localhost
PGPORT=5432
PGUSER=ask_expert_user
PGPASSWORD=your_secure_password_here
PGDATABASE=ask_the_expert

# Session Secret (paste the output from 'openssl rand -base64 32')
SESSION_SECRET=paste_your_generated_secret_here

# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Node Environment
NODE_ENV=production

# Python API URL (internal communication)
PYTHON_API_URL=http://localhost:8000
```

Save and exit (Ctrl+X, then Y, then Enter)

---

## Step 7: Set Up Database Schema

```bash
cd ~/ask-the-expert

# Run database migrations
npm run db:push
```

---

## Step 8: Build the Application

```bash
cd ~/ask-the-expert

# Build the frontend
npm run build
```

---

## Step 9: Set Up Process Management with PM2

### 9.1 Create PM2 Ecosystem File
```bash
cd ~/ask-the-expert
nano ecosystem.config.js
```

### 9.2 Add Configuration
```javascript
module.exports = {
  apps: [
    {
      name: 'ask-expert-node',
      script: 'npm',
      args: 'start',
      cwd: '/home/azureuser/ask-the-expert',
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
      script: '/home/azureuser/ask-the-expert/venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: '/home/azureuser/ask-the-expert',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    }
  ]
};
```

Save and exit (Ctrl+X, then Y, then Enter)

### 9.3 Start Applications with PM2
```bash
cd ~/ask-the-expert

# Start both applications
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Follow the command it outputs (will include sudo)
```

---

## Step 10: Configure Nginx Reverse Proxy

### 10.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/ask-the-expert
```

### 10.2 Add Configuration
```nginx
server {
    listen 80;
    server_name 74.225.252.224;  # Replace with your domain if you have one

    # Increase upload size for file uploads
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

Save and exit (Ctrl+X, then Y, then Enter)

### 10.3 Enable Site and Test Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ask-the-expert /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 11: Configure Azure Network Security Group

### Allow HTTP/HTTPS Traffic
1. Go to Azure Portal
2. Navigate to your VM → Networking → Network Security Group
3. Add inbound security rules:
   - **HTTP**: Port 80, Priority 1001
   - **HTTPS**: Port 443, Priority 1002 (if using SSL)

---

## Step 12: Access Your Application

Open a web browser and navigate to:
```
http://74.225.252.224
```

---

## Step 13: (Optional) Set Up SSL with Let's Encrypt

### 13.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 13.2 Update Nginx Configuration with Domain
```bash
sudo nano /etc/nginx/sites-available/ask-the-expert
```

Change `server_name` from IP to your domain:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

### 13.3 Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### 13.4 Set Up Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Renewal is automatic via systemd timer
sudo systemctl status certbot.timer
```

---

## Useful PM2 Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs
pm2 logs ask-expert-node
pm2 logs ask-expert-python

# Restart applications
pm2 restart all
pm2 restart ask-expert-node
pm2 restart ask-expert-python

# Stop applications
pm2 stop all

# View detailed info
pm2 info ask-expert-node

# Monitor resources
pm2 monit
```

---

## Troubleshooting

### Check if services are running
```bash
# Check Node.js app
pm2 status
curl http://localhost:5000

# Check Python API
curl http://localhost:8000/health

# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# Check Nginx
sudo systemctl status nginx
sudo nginx -t
```

### View logs
```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Restart services
```bash
# Restart applications
pm2 restart all

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Database connection issues
```bash
# Test database connection
PGPASSWORD=your_password psql -h localhost -U ask_expert_user -d ask_the_expert -c "SELECT 1;"

# Check PostgreSQL is listening
sudo netstat -plnt | grep 5432
```

---

## Updating the Application

```bash
# Stop applications
pm2 stop all

# Pull latest changes (if using Git)
cd ~/ask-the-expert
git pull

# Install new dependencies
npm install
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Run database migrations if schema changed
npm run db:push

# Rebuild frontend
npm run build

# Restart applications
pm2 restart all
```

---

## Security Recommendations

1. **Use a firewall**
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

2. **Use environment variables** (already done in .env)

3. **Set up SSL** (covered in Step 13)

4. **Regular updates**
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

5. **Change default PostgreSQL password**

6. **Use SSH keys** (already done)

7. **Set up fail2ban** (optional, protects against brute force)
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   ```

---

## Performance Optimization

### Enable gzip in Nginx
```bash
sudo nano /etc/nginx/nginx.conf
```

Add in `http` block:
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

---

## Backup Strategy

### Database Backup Script
```bash
nano ~/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/azureuser/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=your_password pg_dump -h localhost -U ask_expert_user ask_the_expert > $BACKUP_DIR/db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
```

Make executable:
```bash
chmod +x ~/backup-db.sh
```

Set up daily cron job:
```bash
crontab -e
```

Add line:
```
0 2 * * * /home/azureuser/backup-db.sh
```

---

## Support

If you encounter issues:
1. Check the logs (PM2, Nginx, PostgreSQL)
2. Verify all services are running
3. Check environment variables in .env
4. Ensure database connection is working
5. Verify firewall/security group settings
