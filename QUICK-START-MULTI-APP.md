# Quick Start - Multi-App Deployment

## 🎯 Deploy Multiple Apps on One Server

Use this when you have multiple applications to deploy on one server with your existing Nginx.

---

## 🚀 One Command Setup

```bash
./setup-multi-app.sh
```

**Interactive prompts will ask:**

```
================================================
Multi-App Deployment Setup
================================================

Enter your email for SSL certificates: adhielesmana@gmail.com

How many applications do you want to configure? (1-10): 2

================================================
Application 1 of 2
================================================

App 1 - Name/Identifier (e.g., isp-manager, monitoring): isp-manager
App 1 - Domain name (e.g., isp.maxnetplus.id): isp.maxnetplus.id
App 1 - Port number (e.g., 5000): 5000

✓ App 1 configured:
  Name:   isp-manager
  Domain: isp.maxnetplus.id
  Port:   5000

================================================
Application 2 of 2
================================================

App 2 - Name/Identifier (e.g., isp-manager, monitoring): monitoring
App 2 - Domain name (e.g., isp.maxnetplus.id): monitoring.maxnetplus.id
App 2 - Port number (e.g., 5000): 3000

✓ App 2 configured:
  Name:   monitoring
  Domain: monitoring.maxnetplus.id
  Port:   3000

================================================
Configuration Summary
================================================

Email: adhielesmana@gmail.com
Total Apps: 2

App 1: isp-manager
  └─ https://isp.maxnetplus.id → localhost:5000

App 2: monitoring
  └─ https://monitoring.maxnetplus.id → localhost:3000

Proceed with this configuration? (y/n) y
```

---

## ✅ What It Generates

After running, you'll get:

```
nginx-configs/
├── isp-manager.conf          # Nginx config for ISP Manager
└── monitoring.conf            # Nginx config for Monitoring

ssl-commands/
└── get-all-certificates.sh   # Script to get SSL for all domains

install-to-nginx.sh            # Script to install all configs to Nginx
```

---

## 📋 Next Steps (Automated Scripts!)

### **Step 1: Get SSL Certificates**

```bash
./ssl-commands/get-all-certificates.sh
```

This will:
- Stop your Nginx container
- Get SSL cert for isp.maxnetplus.id
- Get SSL cert for monitoring.maxnetplus.id
- Start your Nginx container
- Total downtime: ~60 seconds

### **Step 2: Install Configs to Nginx**

```bash
./install-to-nginx.sh
```

This will:
- Find your Nginx Docker container
- Copy all configs to the container
- Test Nginx configuration
- Restart Nginx if valid
- Done!

### **Step 3: Access Your Apps**

```
https://isp.maxnetplus.id → ISP Manager
https://monitoring.maxnetplus.id → Monitoring App
```

---

## 🌍 For Different Servers/Locations

Perfect for deploying to multiple locations with different domains:

### **Server 1 (Jakarta)**
```bash
./setup-multi-app.sh

# Prompts:
# Email: adhielesmana@gmail.com
# Apps: 2
# App 1: isp-manager, isp-jakarta.maxnetplus.id, 5000
# App 2: monitoring, mon-jakarta.maxnetplus.id, 3000
```

### **Server 2 (Surabaya)**
```bash
./setup-multi-app.sh

# Prompts:
# Email: adhielesmana@gmail.com
# Apps: 2
# App 1: isp-manager, isp-surabaya.maxnetplus.id, 5000
# App 2: monitoring, mon-surabaya.maxnetplus.id, 3000
```

### **Server 3 (Bali)**
```bash
./setup-multi-app.sh

# Prompts:
# Email: adhielesmana@gmail.com
# Apps: 2
# App 1: isp-manager, isp-bali.maxnetplus.id, 5000
# App 2: monitoring, mon-bali.maxnetplus.id, 3000
```

**Each server gets its own domain-specific configs!** 🎉

---

## 📊 Architecture

```
Your Server (One Nginx, Multiple Apps)
├── Nginx Docker (ports 80/443)
│   │
│   ├─→ isp.maxnetplus.id → ISP Manager (port 5000)
│   ├─→ monitoring.maxnetplus.id → Monitoring (port 3000)
│   └─→ admin.maxnetplus.id → Admin Panel (port 8080)
│
├── SSL Certificates
│   ├── /etc/letsencrypt/live/isp.maxnetplus.id/
│   ├── /etc/letsencrypt/live/monitoring.maxnetplus.id/
│   └── /etc/letsencrypt/live/admin.maxnetplus.id/
│
└── Your Apps
    ├── ISP Manager (Docker, port 5000)
    ├── Monitoring (Docker, port 3000)
    └── Admin Panel (Docker, port 8080)
```

---

## 🔧 DNS Configuration

For each domain, add A record:

```
isp.maxnetplus.id            A    YOUR_SERVER_IP
monitoring.maxnetplus.id     A    YOUR_SERVER_IP
admin.maxnetplus.id          A    YOUR_SERVER_IP
```

---

## ✅ Complete Example

```bash
# 1. Run multi-app setup
./setup-multi-app.sh

# Interactive prompts:
# Email: adhielesmana@gmail.com
# Apps: 3
#
# App 1: isp-manager, isp.maxnetplus.id, 5000
# App 2: monitoring, monitoring.maxnetplus.id, 3000
# App 3: admin, admin.maxnetplus.id, 8080

# 2. Get SSL certificates
./ssl-commands/get-all-certificates.sh

# 3. Install to Nginx
./install-to-nginx.sh

# 4. Done! Access:
# https://isp.maxnetplus.id
# https://monitoring.maxnetplus.id
# https://admin.maxnetplus.id
```

---

## 🎯 Benefits

✅ **Flexible:** Works on any server with any domains
✅ **Repeatable:** Same process for all locations
✅ **Automated:** No manual config editing
✅ **Safe:** Doesn't modify existing Nginx
✅ **Scalable:** Support up to 10 apps per server

---

## 📝 Example Use Cases

### **Multi-Location ISP Deployment**
- Jakarta: isp-jakarta.company.id
- Surabaya: isp-surabaya.company.id
- Bali: isp-bali.company.id

### **Multiple Services**
- Main app: app.company.id
- Admin panel: admin.company.id
- Monitoring: monitoring.company.id
- API: api.company.id

### **Client Deployments**
- Client A: isp.clienta.com
- Client B: isp.clientb.com
- Client C: isp.clientc.com

---

**Perfect for ISP with multiple branches or multiple client deployments!** 🚀

---

**Last Updated:** November 11, 2025  
**Feature:** Multi-App Deployment with Variable Domains  
**Status:** ✅ Ready to Use
