# ISP Manager - Deployment Modes Guide

This guide explains the two deployment architectures available for ISP Manager with **intelligent automatic nginx detection**.

## ✨ Automatic Nginx Detection

ISP Manager now features **intelligent nginx detection** that automatically configures the deployment mode based on your server environment:

### 🎯 Detection Scenarios:

**1. Nginx Detected on Host (Non-Docker)**
- ✅ **Automatically configures for Host Nginx mode**
- ✅ Skips manual mode selection
- ✅ Automatically adjusts ports to avoid conflicts
- ✅ Updates nginx configuration only
- ℹ️ Perfect for servers with existing nginx installations

**2. Nginx Detected in Docker**
- **If Update Deployment**: Continues seamlessly
- **If Fresh Install**: Offers options:
  - Remove existing nginx container and continue
  - Cancel deployment (preserve existing setup)

**3. No Nginx Detected**
- Presents interactive choice:
  - Install nginx on host (multi-app mode)
  - Use Docker nginx (single-app mode)

## 🎯 Deployment Modes

### Mode 1: Host Nginx (Recommended for Multi-App Servers)

**Architecture:**
```
Host Server
├── Nginx (installed on host OS via apt/yum)
│   ├── /etc/nginx/sites-available/isp-manager
│   ├── /etc/nginx/sites-available/another-app
│   └── /etc/nginx/sites-enabled/ (symlinks)
├── /etc/letsencrypt/ (all SSL certificates)
└── Docker Containers
    ├── isp-manager-app:5000
    ├── another-app:5001
    └── third-app:5002
```

**Features:**
- ✅ One nginx instance serves all applications
- ✅ Each app runs in Docker on unique port
- ✅ Host nginx proxies to `localhost:PORT`
- ✅ All SSL certificates in one location
- ✅ Easy to add more apps
- ✅ Professional, scalable architecture

**Best For:**
- Production servers running multiple services
- VPS/dedicated servers hosting multiple sites
- Existing nginx installations
- ISPs managing multiple customer portals

**Setup:**
```bash
# 1. Choose deployment mode
./select-deployment-mode.sh
# Select option 1

# 2. Install nginx on host (if not already installed)
./install-host-nginx.sh

# 3. Configure ISP Manager
./setup.sh --domain isp.example.com --email admin@example.com

# 4. Deploy
./deploy.sh
```

**Result:**
- ISP Manager app runs in Docker on port 5000
- Nginx on host proxies https://isp.example.com → localhost:5000
- SSL certificates at `/etc/letsencrypt/live/isp.example.com/`
- Easy to add more apps: just deploy them on different ports (5001, 5002...)

---

### Mode 2: Docker Nginx (Single-App Deployment)

**Architecture:**
```
Docker Compose Stack
├── isp-manager-app (Node.js application)
├── isp-manager-reverse-proxy (Nginx container)
│   └── /etc/letsencrypt/ (in Docker volume)
├── isp-postgres (PostgreSQL database)
└── isp-freeradius (FreeRADIUS server)
```

**Features:**
- ✅ Self-contained Docker Compose stack
- ✅ No host OS dependencies
- ✅ Nginx runs in dedicated container
- ✅ SSL certificates in Docker volumes
- ✅ Isolated from other services

**Best For:**
- Dedicated servers running only ISP Manager
- Testing and development environments
- Servers without existing nginx
- Quick single-app deployments

**Setup:**
```bash
# 1. Choose deployment mode
./select-deployment-mode.sh
# Select option 2

# 2. Configure ISP Manager
./setup.sh --domain isp.example.com --email admin@example.com

# 3. Deploy
./deploy.sh
```

**Result:**
- All services run in Docker containers
- Nginx container exposes ports 80 and 443
- SSL certificates managed inside nginx container
- No interaction with host OS nginx

---

## 🤔 Which Mode Should I Choose?

### Choose **Mode 1 (Host Nginx)** if:
- ✅ You run multiple applications on the server
- ✅ You want professional, scalable architecture
- ✅ You need to manage multiple domains easily
- ✅ You have or can install nginx on host OS
- ✅ **Recommended for production ISP deployments**

### Choose **Mode 2 (Docker Nginx)** if:
- ✅ This is the only app on the server
- ✅ You want complete Docker isolation
- ✅ You're testing or developing
- ✅ You don't want to modify host OS
- ✅ Quick deployment is priority

---

## 📋 Comparison Table

| Feature | Mode 1: Host Nginx | Mode 2: Docker Nginx |
|---------|-------------------|---------------------|
| Nginx Location | Host OS | Docker Container |
| SSL Certificates | `/etc/letsencrypt/` | Docker Volume |
| Multi-App Support | ✅ Excellent | ❌ Single App Only |
| Isolation | App in Docker, nginx on host | Everything in Docker |
| Port Management | Manual (5000, 5001...) | Automatic (ports 80, 443) |
| Setup Complexity | Medium | Easy |
| Scalability | ✅ High | Limited |
| Production Ready | ✅ Yes | ✅ Yes |
| Best Use Case | Multiple apps/sites | Single dedicated app |

---

## 🚀 Quick Start

### Automatic Detection (Recommended):
```bash
./setup.sh --domain your-domain.com --email your@email.com
# Nginx detection runs automatically
# Deployment mode configured based on detection
./deploy.sh
```

### Manual Mode Selection:
```bash
chmod +x select-deployment-mode.sh
./select-deployment-mode.sh
# Intelligent detection runs automatically
# If nginx found on host → auto-configures Host Nginx mode
# If nginx in Docker → handles update/fresh install
# If no nginx → offers choice between modes
```

---

## 🔧 Advanced: Switching Modes

If you need to switch from one mode to another:

### Docker → Host:
```bash
# 1. Stop Docker nginx
docker-compose down

# 2. Install host nginx
./install-host-nginx.sh

# 3. Update deployment mode
./select-deployment-mode.sh  # Choose option 1

# 4. Redeploy
./deploy.sh
```

### Host → Docker:
```bash
# 1. Stop host nginx (optional)
systemctl stop nginx

# 2. Update deployment mode
./select-deployment-mode.sh  # Choose option 2

# 3. Redeploy
./deploy.sh
```

---

## 📚 Additional Resources

- **Setup Script**: `./setup.sh --help`
- **Deployment Script**: `./deploy.sh --help`
- **Auto-Detection Guide**: `AUTO-DETECTION-GUIDE.md`
- **SSL Certificate Guide**: `SSL-CERTIFICATE-PATHS.md`

---

## ❓ FAQ

**Q: Can I run both modes simultaneously?**
A: No, choose one mode per server. However, you can have different servers using different modes.

**Q: Which mode is more secure?**
A: Both are equally secure when configured properly. Mode 1 (Host Nginx) follows industry-standard architecture used by most production environments.

**Q: Can I manually manage SSL certificates?**
A: Yes, both modes support manual certificate management. See SSL-CERTIFICATE-PATHS.md for details.

**Q: What if I already have nginx on the host?**
A: Perfect! The deployment system will **automatically detect** your host nginx installation and configure for Host Nginx mode. No manual selection needed - port conflicts are automatically avoided!

**Q: Can I add more apps later in Host Nginx mode?**
A: Yes! That's the main advantage. Just deploy new apps on different ports (5001, 5002...) and create new nginx site configs.

---

For more help, see the main documentation or run `./setup.sh --help`
