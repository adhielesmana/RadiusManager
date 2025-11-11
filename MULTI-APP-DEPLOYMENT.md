# Multi-App Deployment Guide

## Overview

Deploy multiple applications on one server with one Nginx, each with their own domain/subdomain.

---

## Architecture

```
Your Server
├── Nginx Docker (ports 80/443)
│   ├── isp.maxnetplus.id → App 1 (ISP Manager, port 5000)
│   ├── monitoring.maxnetplus.id → App 2 (port 3000)
│   └── admin.maxnetplus.id → App 3 (port 8080)
└── SSL Certificates (Let's Encrypt)
    ├── /etc/letsencrypt/live/isp.maxnetplus.id/
    ├── /etc/letsencrypt/live/monitoring.maxnetplus.id/
    └── /etc/letsencrypt/live/admin.maxnetplus.id/
```

---

## Setup Process

### Step 1: Configure First App (ISP Manager)

```bash
./setup.sh \
  --domain isp.maxnetplus.id \
  --email adhielesmana@gmail.com \
  --existing-nginx

./deploy.sh
```

This creates config at: `/etc/nginx/sites-available/isp-manager`

### Step 2: Configure Additional Apps

For each additional app, create a similar Nginx config:

**Example: Monitoring App on port 3000**

Create `/etc/nginx/sites-available/monitoring-app`:

```nginx
# Monitoring App - Nginx Configuration

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name monitoring.maxnetplus.id;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name monitoring.maxnetplus.id;

    ssl_certificate /etc/letsencrypt/live/monitoring.maxnetplus.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitoring.maxnetplus.id/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/monitoring-access.log;
    error_log /var/log/nginx/monitoring-error.log;
}
```

### Step 3: Get SSL Certificates for Each Domain

```bash
# For ISP Manager
certbot certonly --standalone -d isp.maxnetplus.id -m adhielesmana@gmail.com --agree-tos

# For Monitoring App
certbot certonly --standalone -d monitoring.maxnetplus.id -m adhielesmana@gmail.com --agree-tos

# For Admin App
certbot certonly --standalone -d admin.maxnetplus.id -m adhielesmana@gmail.com --agree-tos
```

### Step 4: Add All Configs to Nginx Docker

```bash
# Copy all configs to Nginx container
docker cp /etc/nginx/sites-available/isp-manager nginx:/etc/nginx/conf.d/
docker cp /etc/nginx/sites-available/monitoring-app nginx:/etc/nginx/conf.d/
docker cp /etc/nginx/sites-available/admin-app nginx:/etc/nginx/conf.d/

# Test and reload
docker exec nginx nginx -t
docker restart nginx
```

---

## Automated Multi-App Setup Script

Coming soon: Enhanced `setup.sh` that asks:
1. How many apps to configure?
2. For each app:
   - App name
   - Domain/subdomain
   - Port number
3. Generates all Nginx configs automatically

---

## DNS Configuration

For each subdomain, add A record pointing to your server:

```
isp.maxnetplus.id        A    YOUR.SERVER.IP
monitoring.maxnetplus.id A    YOUR.SERVER.IP
admin.maxnetplus.id      A    YOUR.SERVER.IP
```

---

## Current vs Enhanced Setup

**Current (Manual for each app):**
```bash
# App 1
./setup.sh --domain app1.com --email you@email.com --existing-nginx
./deploy.sh
# Manually create config for App 2, App 3...

# Get SSL for each
certbot certonly --standalone -d app1.com
certbot certonly --standalone -d app2.com
certbot certonly --standalone -d app3.com
```

**Enhanced (Coming):**
```bash
./setup-multi-app.sh

# Interactive prompts:
# How many apps? 3
# 
# App 1:
#   Name: ISP Manager
#   Domain: isp.maxnetplus.id
#   Port: 5000
#
# App 2:
#   Name: Monitoring
#   Domain: monitoring.maxnetplus.id
#   Port: 3000
#
# App 3:
#   Name: Admin Panel
#   Domain: admin.maxnetplus.id
#   Port: 8080
#
# Generating configs for 3 apps...
# ✓ All configs generated!
```

---

## Next Steps

Would you like me to:
1. Create an automated multi-app setup script?
2. Create a config generator for additional apps?
3. Document the manual process for now?
