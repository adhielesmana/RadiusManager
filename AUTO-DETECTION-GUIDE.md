# Docker Container Auto-Detection Guide

## ✅ **New Feature: Automatic Docker Container Detection**

The `setup-multi-app.sh` script now **automatically detects** running Docker containers and their ports, eliminating manual configuration!

---

## 🚀 **How It Works**

### **Step 1: Auto-Detection**
When you run `./setup-multi-app.sh`, the script automatically:

1. **Scans all running Docker containers**
2. **Detects exposed ports** (any IP binding: 0.0.0.0, 127.0.0.1, ::, etc.)
3. **Extracts actual container names**
4. **Finds domains** from existing nginx configs (if available)
5. **Reports what it found** and asks for your confirmation

### **Step 2: Smart Configuration**
```
Auto-Detecting Existing Docker Applications

Found 2 existing application(s):

  1. mikrotik-monitor
     Container: mikrotik-monitor-nginx-app
     Port: 5100
     Domain: mikrotik.maxnetplus.id

  2. isp-manager
     Container: isp-manager-app
     Port: 5001
     Domain: isp.maxnetplus.id

Skipped 1 container(s) - no accessible ports detected:
  - postgres-db

These containers may be:
  • Internal services without exposed ports
  • Using custom network configurations
  • Not web applications

Use these detected apps? (y/n)
```

### **Step 3: Add More Apps (Optional)**
```
Already detected: 2 application(s)
How many ADDITIONAL applications to configure? (0-8): 1

Total: 3 application(s) (2 detected + 1 new)
```

---

## 📋 **Generated Nginx Configuration**

### **For Detected Apps:**
```nginx
# mikrotik-monitor - Nginx Configuration
# Domain: mikrotik.maxnetplus.id
# Port: 5100
# Detected container: mikrotik-monitor-nginx-app (accessible via host port 5100)

server {
    listen 443 ssl http2;
    server_name mikrotik.maxnetplus.id;
    
    ssl_certificate /etc/letsencrypt/live/mikrotik.maxnetplus.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mikrotik.maxnetplus.id/privkey.pem;
    
    location / {
        proxy_pass http://host.docker.internal:5100;
        ...
    }
}
```

### **For Manual Apps:**
```nginx
# new-app - Nginx Configuration
# Domain: new.example.com
# Port: 5200
# Expected: docker run -p 5200:5000 --name new-app-app ...

server {
    listen 443 ssl http2;
    server_name new.example.com;
    
    ssl_certificate /etc/letsencrypt/live/new.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/new.example.com/privkey.pem;
    
    location / {
        proxy_pass http://host.docker.internal:5200;
        ...
    }
}
```

---

## ⚙️ **Important: host.docker.internal Setup**

### **Docker Desktop (Mac/Windows)**
✅ **Works out of the box** - No configuration needed!

### **Linux**
⚠️ **Requires extra flag** when running nginx container:

```bash
docker run -d \
  --name nginx \
  -p 80:80 \
  -p 443:443 \
  --add-host=host.docker.internal:host-gateway \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  nginx
```

**Or use host network mode:**
```bash
docker run -d \
  --name nginx \
  --network=host \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  nginx
```

---

## 🎯 **What Gets Detected?**

### **✅ Will Be Detected:**
- Containers with host port mappings (`-p 5000:5000`)
- Containers on host network mode
- Containers with ANY IP binding (0.0.0.0, 127.0.0.1, ::, etc.)
- Containers with exposed ports (`EXPOSE` in Dockerfile)

### **⚠️ Will Be Skipped:**
- Database containers (postgres, mysql, redis, etc.)
- Containers without exposed ports
- Internal-only services
- Nginx/proxy containers

### **📝 Will Be Reported:**
Skipped containers are shown with explanation:
```
Skipped 3 container(s) - no accessible ports detected:
  - postgres-db
  - redis-cache  
  - background-worker

These containers may be:
  • Internal services without exposed ports
  • Using custom network configurations
  • Not web applications
```

---

## 📊 **Port Detection Logic**

The script tries **3 methods** to find ports:

1. **Docker inspect** - Checks port bindings from Docker API
2. **docker port** command - Extracts mapped ports
3. **Exposed ports** - Falls back to internal ports (host network mode)

**Example detections:**
- `0.0.0.0:5000→5000/tcp` → Port: 5000 ✓
- `127.0.0.1:5100→5000/tcp` → Port: 5100 ✓
- `[::]:5200→3000/tcp` → Port: 5200 ✓

---

## 🔍 **Domain Detection**

The script tries to find domains from existing nginx configs:

1. **Searches** `/etc/nginx/conf.d/` in nginx container
2. **Matches** `proxy_pass` directives to container names
3. **Extracts** `server_name` from matching configs
4. **Falls back** to `{appname}.example.com` if not found

**Example:**
```
Container: mikrotik-monitor-nginx-app
Found in: /etc/nginx/conf.d/mikrotik.conf
Domain: mikrotik.maxnetplus.id ✓
```

---

## 🛠️ **Troubleshooting**

### **Problem: No apps detected**
**Solution:**
- Check Docker is running: `docker ps`
- Verify containers have exposed ports: `docker port CONTAINER`
- Ensure ports are mapped to host: `docker inspect CONTAINER`

### **Problem: Wrong domain detected**
**Solution:**
- Say "n" when asked to use detected apps
- Manually configure the correct domain

### **Problem: Nginx can't reach app**
**Solution (Linux):**
```bash
# Stop nginx
docker stop nginx-container

# Restart with host.docker.internal mapping
docker rm nginx-container
docker run -d \
  --name nginx-container \
  --add-host=host.docker.internal:host-gateway \
  -p 80:80 -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  nginx
```

---

## 📖 **Example Workflow**

```bash
# 1. Run setup script
./setup-multi-app.sh

# Auto-Detection happens automatically:
# ✓ Found mikrotik-monitor (port 5100)
# ✓ Found isp-manager (port 5001)
# 
# Use these detected apps? (y/n) y

# 2. Add SSL email
# Enter email: admin@maxnetplus.id

# 3. Add more apps if needed
# How many ADDITIONAL applications? 0

# 4. Confirm and generate
# ✓ Generated nginx-configs/mikrotik-monitor.conf
# ✓ Generated nginx-configs/isp-manager.conf
# ✓ Generated ssl-commands/get-all-certificates.sh
# ✓ Generated install-to-nginx.sh

# 5. Get SSL certificates
sudo ./ssl-commands/get-all-certificates.sh

# 6. Install configs
./install-to-nginx.sh

# Done! All apps now have HTTPS ✓
```

---

## ✅ **Benefits**

- **Zero manual typing** for existing containers
- **Correct ports** automatically detected
- **Actual container names** preserved
- **Existing domains** reused when available
- **Skipped containers** clearly reported
- **Validation** before proceeding

---

## 🚀 **Ready to Use!**

Download the updated `setup-multi-app.sh` and run it - auto-detection happens automatically!

```bash
chmod +x setup-multi-app.sh
./setup-multi-app.sh
```

Your existing Docker containers will be detected and configured with zero manual effort! 🎉
