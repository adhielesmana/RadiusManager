# Docker Container Auto-Detection

## ✅ Automatic Docker Container Detection Enabled!

Both `setup.sh` and `setup-multi-app.sh` now **automatically detect running Docker containers** and their ports!

---

## 🎯 What It Does

When you run either setup script, it will:

1. ✅ **Scan** for running Docker containers
2. ✅ **Display** container names, images, and ports
3. ✅ **Avoid** ports used by existing containers
4. ✅ **Suggest** only available ports

---

## 🚀 Example Output

### **When You Run `./setup.sh` or `./setup-multi-app.sh`:**

```bash
================================================
Detecting Running Docker Containers
================================================

✓ Found running Docker containers:

NAMES              IMAGE                    PORTS
nginx-proxy        nginx:latest             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
postgres-db        postgres:15              0.0.0.0:5432->5432/tcp
redis-cache        redis:7                  0.0.0.0:6379->6379/tcp
monitoring-app     monitoring:latest        0.0.0.0:3000->3000/tcp

ℹ Port suggestions will automatically avoid these containers

================================================
```

**Result:**
- Won't suggest port 80, 443 (Nginx)
- Won't suggest port 5432 (PostgreSQL)
- Won't suggest port 6379 (Redis)
- Won't suggest port 3000 (Monitoring)
- **Will suggest:** 5000, 5100, 5200... (all available!)

---

## 📊 Before vs After

### **Before (Manual Check):**

```bash
# You had to manually check what's running:
docker ps

# Then remember to avoid those ports
# Easy to make mistakes!
```

### **After (Automatic):**

```bash
./setup-multi-app.sh

# Shows you everything automatically:
# ✓ Nginx on 80/443
# ✓ PostgreSQL on 5432
# ✓ Monitoring on 3000
#
# Suggests: 5000, 5100, 5200 (all safe!)
```

---

## 🎯 Integration with Port Detection

The scripts now combine **two detection methods**:

### **1. System Port Detection:**
- Uses `netstat`, `ss`, or `lsof`
- Detects **all** ports in use (Docker + non-Docker)

### **2. Docker Container Detection:**
- Shows **which containers** are using ports
- Displays **container names and images**
- Helps you understand **what's running**

### **Combined Result:**
```
Running Containers:
  nginx-proxy: 80, 443
  postgres-db: 5432
  other-app: 3000

Port Suggestions:
  App 1: 5000 ✓ (avoiding 80, 443, 5432, 3000)
  App 2: 5100 ✓ (avoiding 80, 443, 5432, 3000)
  App 3: 5200 ✓ (avoiding 80, 443, 5432, 3000)
```

---

## 💡 Benefits

### **For ISP Manager Setup (`setup.sh`):**
```bash
./setup.sh --domain isp.maxnetplus.id --email you@email.com --existing-nginx

# Output shows:
# ✓ Found nginx-proxy on 80/443
# ℹ Will integrate with existing Nginx
# ℹ ISP Manager will run on port 5000 (auto-selected, avoids conflicts)
```

### **For Multi-App Setup (`setup-multi-app.sh`):**
```bash
./setup-multi-app.sh

# Shows all running containers first
# Then suggests ports that avoid all of them
# No manual checking needed!
```

---

## 🔍 Smart Detection

### **Scenario 1: Nginx Already Running**

```
Detected:
  nginx-proxy: 80, 443

Setup Response:
  ✓ Will integrate with existing Nginx
  ✓ ISP Manager on port 5000
```

### **Scenario 2: Multiple Apps Running**

```
Detected:
  app1: 3000
  app2: 4000
  db: 5432

Port Suggestions:
  New App 1: 5000 ✓
  New App 2: 5100 ✓
  New App 3: 5200 ✓
```

### **Scenario 3: Ports 5000-5200 In Use**

```
Detected:
  app1: 5000
  app2: 5100
  app3: 5200

Port Suggestions:
  New App 1: 5001 ✓ (next available)
  New App 2: 5101 ✓ (next available)
  New App 3: 5201 ✓ (next available)
```

---

## 🌍 Perfect for Production Servers

On production servers with multiple services:

```
Your Server:
  ├── nginx-proxy (80, 443)
  ├── postgresql (5432)
  ├── redis (6379)
  ├── monitoring (3000)
  └── api-gateway (8080)

Run setup:
  ./setup-multi-app.sh

Auto-detects all above ✓
Suggests safe ports: 5000, 5100, 5200 ✓
No conflicts! ✓
```

---

## ✅ What Both Scripts Now Do

### **`setup.sh` (ISP Manager):**
1. Detects running Docker containers
2. Shows container details
3. Detects existing Nginx automatically
4. Suggests available port for ISP Manager
5. Configures for existing Nginx integration

### **`setup-multi-app.sh` (Multiple Apps):**
1. Detects running Docker containers
2. Shows container details
3. Suggests available ports for **each** app
4. Prevents conflicts with **all** existing containers
5. Generates configs for all apps

---

## 📋 Example Session

```bash
root@server:~$ ./setup-multi-app.sh

================================================
Multi-App Deployment Setup
================================================

ℹ Each app will have its own domain and Nginx configuration

================================================
Detecting Running Docker Containers
================================================

✓ Found running Docker containers:

NAMES              IMAGE                    PORTS
nginx-proxy        nginx:latest             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
postgresql-main    postgres:15              0.0.0.0:5432->5432/tcp

ℹ Port suggestions will automatically avoid these containers

Enter your email: adhielesmana@gmail.com
How many apps? 2

App 1 - Name: isp-manager
App 1 - Domain: isp.maxnetplus.id

✓ Suggested available port: 5000
Use port 5000? [Enter=5000]: ⏎

App 2 - Name: monitoring
App 2 - Domain: monitoring.maxnetplus.id

✓ Suggested available port: 5100
Use port 5100? [Enter=5100]: ⏎

✓ All configs generated!
```

**No conflicts with nginx-proxy or postgresql-main!** ✅

---

## 🎉 Summary

**You don't need to:**
- ❌ Run `docker ps` manually
- ❌ Remember which ports are used
- ❌ Check for conflicts yourself

**Scripts automatically:**
- ✅ Detect all running containers
- ✅ Show you what's running
- ✅ Suggest only available ports
- ✅ Prevent all conflicts

---

**Just run the script and press Enter!** 🚀

```bash
./setup.sh
# or
./setup-multi-app.sh
```

---

**Last Updated:** November 11, 2025  
**Feature:** Automatic Docker Container Detection  
**Status:** ✅ Production Ready
