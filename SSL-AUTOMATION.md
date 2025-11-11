# Automated SSL Certificate Provisioning

## ✨ Fully Automated SSL Setup

`deploy.sh` now **automatically provisions SSL certificates** when using existing Nginx!

---

## 🚀 How It Works

### **Automatic Flow (No Manual Steps!)**

When you run `./deploy.sh`:

1. ✅ **Starts ISP Manager** (PostgreSQL, FreeRADIUS, App on port 5000)
2. ✅ **Generates Nginx config** for your domain
3. ✅ **Auto-detects** your Nginx Docker container
4. ✅ **Stops Nginx** temporarily
5. ✅ **Obtains SSL certificate** via Let's Encrypt
6. ✅ **Starts Nginx** back up
7. ✅ **Installs config** into Nginx container
8. ✅ **Reloads Nginx**
9. ✅ **Done!** Your site is live with HTTPS!

**Zero manual commands!** 🎉

---

## 📋 Prerequisites

### **1. Your Nginx Container Must Have:**

```bash
# Volume mounts required:
-v /etc/letsencrypt:/etc/letsencrypt:ro
-v /etc/nginx/conf.d:/etc/nginx/conf.d
```

**Example Nginx Container:**

```bash
docker run -d \
  --name nginx-proxy \
  -p 80:80 \
  -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d \
  --restart unless-stopped \
  nginx:latest
```

### **2. Certbot Must Be Installed:**

```bash
# Ubuntu/Debian
apt-get install -y certbot

# CentOS/RHEL
yum install -y certbot
```

### **3. DNS Must Be Configured:**

Your domain must point to your server's IP address.

---

## 🎯 Usage

### **Standard Deployment (Fully Automated)**

```bash
./setup.sh --domain isp.maxnetplus.id --email you@email.com --existing-nginx
./deploy.sh
```

**That's it!** Everything happens automatically.

---

### **Output Example:**

```bash
================================================
Automated SSL Provisioning
================================================

ℹ Running automated SSL certificate provisioning...

================================================
Detecting Nginx Container
================================================

✓ Detected Nginx container: nginx-proxy

================================================
Checking Certificate Mount
================================================

✓ /etc/letsencrypt is already mounted in Nginx container

================================================
Obtaining SSL Certificate
================================================

ℹ Stopping Nginx container temporarily...
ℹ Running certbot for domain: isp.maxnetplus.id

Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/isp.maxnetplus.id/privkey.pem

✓ SSL certificate obtained successfully!
ℹ Restarting Nginx container...

================================================
Installing Nginx Configuration
================================================

ℹ Copying configuration to Nginx container...
✓ Configuration copied successfully
ℹ Testing Nginx configuration...
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
✓ Nginx configuration is valid
ℹ Reloading Nginx...
✓ Nginx reloaded successfully

================================================
Verification
================================================

✓ SSL certificate provisioned and configured!

Domain:      isp.maxnetplus.id
Certificate: /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem
Expires:     Feb 9 12:34:56 2026 GMT

ℹ Testing HTTPS connection...
✓ HTTPS is working! Visit: https://isp.maxnetplus.id

✓ SSL provisioning complete! ✨
```

---

## 🔧 Advanced Options

### **Skip SSL Provisioning**

If you want to skip automatic SSL (maybe you already have certificates):

```bash
./deploy.sh --skip-ssl
```

### **Manual SSL Provisioning**

Run SSL provisioning separately:

```bash
./ssl-provision.sh
```

### **Specify Nginx Container**

If you have multiple Nginx containers:

```bash
NGINX_CONTAINER=my-nginx ./ssl-provision.sh
```

---

## 💡 Smart Features

### **1. Idempotent (Safe to Re-run)**

If certificate already exists and is valid (>30 days left), SSL provisioning is skipped:

```bash
✓ Valid SSL certificate already exists (expires in 62 days)
ℹ Skipping certificate provisioning
```

### **2. Auto-Detection**

Automatically detects your Nginx container:

```bash
✓ Detected Nginx container: nginx-proxy
```

If multiple containers found:

```bash
✗ Multiple Nginx containers found:
nginx-proxy-1
nginx-proxy-2

Please specify which one to use:
  NGINX_CONTAINER=nginx-proxy-1 ./ssl-provision.sh
```

### **3. Validation Checks**

Before proceeding, validates:
- ✅ Certbot is installed
- ✅ Nginx container is running
- ✅ /etc/letsencrypt is mounted in container
- ✅ Domain is set in .env
- ✅ Email is set in .env

### **4. Graceful Error Handling**

If SSL provisioning fails, deployment continues:

```bash
⚠ SSL provisioning encountered an issue
ℹ You can run './ssl-provision.sh' manually later

✓ ISP Manager backend is running on http://localhost:5000

⚠ NEXT STEPS:
  1. Run SSL provisioning manually:
     ./ssl-provision.sh
```

---

## 🔒 Certificate Renewal

### **Automatic Renewal (Recommended)**

Certbot automatically renews certificates via systemd timer:

```bash
# Check renewal status
systemctl status certbot.timer

# Test renewal
certbot renew --dry-run
```

### **Manual Renewal**

```bash
# Renew all certificates
certbot renew

# Restart Nginx to load new certificates
docker restart <nginx-container>
```

---

## 🚨 Troubleshooting

### **Problem: "certbot is not installed"**

```bash
# Install certbot
apt-get update && apt-get install -y certbot
```

### **Problem: "No running Nginx container found"**

```bash
# Check running containers
docker ps

# Make sure Nginx is running
docker start <nginx-container-name>
```

### **Problem: "/etc/letsencrypt is NOT mounted"**

Your Nginx container needs this volume mount:

```bash
# Stop and remove old container
docker stop nginx-proxy
docker rm nginx-proxy

# Start with proper mount
docker run -d \
  --name nginx-proxy \
  -p 80:80 \
  -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d \
  --restart unless-stopped \
  nginx:latest
```

### **Problem: "Certificate validation failed"**

Ensure:
1. ✅ Domain DNS points to your server
2. ✅ Port 80 is accessible from internet
3. ✅ Firewall allows HTTP/HTTPS traffic

```bash
# Test DNS
dig isp.maxnetplus.id

# Test port 80
curl -I http://isp.maxnetplus.id
```

### **Problem: "Nginx configuration test failed"**

Check the generated config:

```bash
# View configuration
cat /etc/nginx/sites-available/isp-manager

# Test manually
docker exec <nginx-container> nginx -t
```

---

## 📊 Workflow Comparison

### **Before (Manual)**

```bash
# 1. Deploy
./deploy.sh

# 2. Stop Nginx
docker stop nginx-proxy

# 3. Get certificate
certbot certonly --standalone -d isp.maxnetplus.id -m you@email.com --agree-tos

# 4. Start Nginx
docker start nginx-proxy

# 5. Copy config
docker cp /etc/nginx/sites-available/isp-manager nginx-proxy:/etc/nginx/conf.d/

# 6. Test config
docker exec nginx-proxy nginx -t

# 7. Reload Nginx
docker restart nginx-proxy

# 8. Test HTTPS
curl -I https://isp.maxnetplus.id
```

**8 manual steps!** 😓

### **After (Automated)**

```bash
./deploy.sh
```

**1 command!** ✨

---

## ✅ Summary

**deploy.sh now handles:**
- ✅ SSL certificate provisioning
- ✅ Nginx configuration
- ✅ Container detection
- ✅ Certificate installation
- ✅ Nginx reload
- ✅ HTTPS verification

**You just run:**
```bash
./setup.sh --domain <your-domain> --email <your-email> --existing-nginx
./deploy.sh
```

**Everything else is automatic!** 🚀

---

## 🔗 Related Files

- `deploy.sh` - Main deployment script (calls SSL provisioning)
- `ssl-provision.sh` - Standalone SSL provisioning script
- `setup.sh` - Initial configuration setup
- `.env` - Configuration file (domain, email, etc.)

---

**Last Updated:** November 11, 2025  
**Feature:** Fully Automated SSL Certificate Provisioning  
**Status:** ✅ Production Ready
