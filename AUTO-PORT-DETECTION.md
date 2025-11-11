# Automatic Port Detection & Assignment

## 🎯 No Need to Know Ports!

The `setup-multi-app.sh` script now **automatically detects and suggests available ports** for you!

---

## ✅ How It Works

### **Automatic Detection:**

1. **Scans system** for ports already in use
2. **Suggests next available port** starting from 5000
3. **Tracks assigned ports** to avoid duplicates in same session
4. **Validates your input** if you choose a custom port

### **Port Suggestion Strategy:**

```
App 1: Suggests 5000 (or next available)
App 2: Suggests 5100 (or next available)
App 3: Suggests 5200 (or next available)
App 4: Suggests 5300 (or next available)
```

This spreads out the ports to avoid conflicts and makes it easy to remember!

---

## 🚀 Example Usage

### **Fully Automatic (Just Press Enter):**

```bash
./setup-multi-app.sh

Email: adhielesmana@gmail.com
How many apps? 3

================================================
Application 1 of 3
================================================

App 1 - Name: isp-manager
App 1 - Domain: isp.maxnetplus.id

✓ Suggested available port: 5000
App 1 - Use port 5000 or enter custom port [Enter=5000]: ⏎

✓ App 1 configured:
  Name:   isp-manager
  Domain: isp.maxnetplus.id
  Port:   5000

================================================
Application 2 of 3
================================================

App 2 - Name: monitoring
App 2 - Domain: monitoring.maxnetplus.id

✓ Suggested available port: 5100
App 2 - Use port 5100 or enter custom port [Enter=5100]: ⏎

✓ App 2 configured:
  Name:   monitoring
  Domain: monitoring.maxnetplus.id
  Port:   5100

================================================
Application 3 of 3
================================================

App 3 - Name: admin
App 3 - Domain: admin.maxnetplus.id

✓ Suggested available port: 5200
App 3 - Use port 5200 or enter custom port [Enter=5200]: ⏎

✓ App 3 configured:
  Name:   admin
  Domain: admin.maxnetplus.id
  Port:   5200
```

**Just press Enter for each port - all automatic!** 🎉

---

## 🔧 Custom Port Override

If you want a specific port, just type it:

```bash
✓ Suggested available port: 5000
App 1 - Use port 5000 or enter custom port [Enter=5000]: 8080

# System checks if 8080 is available:

✓ Port 8080 is available, using it

# Or if in use:

⚠ Port 8080 is already in use
Use it anyway? (y/n) n

Enter a different port: 8081
✓ Using port 8081
```

---

## ✅ Smart Conflict Detection

### **1. Detects System Ports in Use:**

```bash
✓ Suggested available port: 5000

# If port 5000 is in use by another service:
# Script automatically suggests 5001 (next available)
```

### **2. Prevents Session Duplicates:**

```bash
App 1: Port 5000 ✓
App 2: Port 5100 ✓ (won't suggest 5000 - already assigned)
App 3: Port 5200 ✓ (won't suggest 5000 or 5100)
```

### **3. Validates Custom Input:**

```bash
App 1 - Use port 5000 or enter custom port: 5000 ✓

# Later:

App 2 - Use port 5100 or enter custom port: 5000
✗ Port 5000 already assigned to another app in this session
Enter a different port: _
```

---

## 🔍 Port Detection Methods

The script uses multiple tools (in order of preference):

1. **netstat** - Classic network statistics
2. **ss** - Modern socket statistics
3. **lsof** - List open files/ports

**Works on:** Ubuntu, Debian, CentOS, RHEL, and most Linux distributions!

---

## 📊 Comparison

### **Before (Manual):**
```bash
App 1 - Port number: 5000
# Oops, already in use, try another

App 1 - Port number: 5001
# Also in use

App 1 - Port number: 5002
✓ OK

App 2 - Port number: 5003
# Forgot I used 5003 for something else

App 2 - Port number: 5004
# Wait, did I already use 5004?

App 2 - Port number: 5005
✓ OK (hopefully!)
```

### **Now (Automatic):**
```bash
✓ Suggested available port: 5000
App 1 - Use port 5000 or enter custom port: ⏎  # Just press Enter

✓ Suggested available port: 5100
App 2 - Use port 5100 or enter custom port: ⏎  # Just press Enter

✓ Suggested available port: 5200
App 3 - Use port 5200 or enter custom port: ⏎  # Just press Enter
```

**No thinking required!** 🎉

---

## 💡 Tips

### **1. Accept Suggestions (Easiest):**
Just press **Enter** to use the suggested port
```bash
App 1 - Use port 5000 or enter custom port [Enter=5000]: ⏎
```

### **2. Use Custom Port (If Needed):**
Type your preferred port
```bash
App 1 - Use port 5000 or enter custom port [Enter=5000]: 3000
```

### **3. Port Already in Use:**
Script will warn you and suggest alternatives
```bash
⚠ Port 3000 is already in use
Use it anyway? (y/n) n
Enter a different port: _
```

---

## 🌍 Perfect for Multi-Location Deployments

Since ports are **auto-detected on each server**, you don't need to remember what's available!

### **Jakarta Server:**
```bash
./setup-multi-app.sh
# Auto-detects: 5000, 5100 available ✓
```

### **Surabaya Server:**
```bash
./setup-multi-app.sh
# Auto-detects: 5000 in use by something else
# Suggests: 5001, 5101 ✓
```

### **Bali Server:**
```bash
./setup-multi-app.sh
# Auto-detects: 5000, 5100, 5200 available ✓
```

**Each server adapts automatically!** 🚀

---

## ✅ Features

✅ **Auto-detects** ports in use on the system
✅ **Suggests** next available port
✅ **Validates** custom ports
✅ **Prevents duplicates** within the same setup
✅ **Warns** about conflicts
✅ **Smart spacing** (5000, 5100, 5200) for easy organization
✅ **Works offline** (no external dependencies)

---

## 🎯 Summary

**Old way:**
- Guess port numbers
- Check if in use manually
- Retry if conflict
- Risk duplicates

**New way:**
- Press Enter
- Done! ✓

---

**Just run and press Enter!** 🎉

```bash
./setup-multi-app.sh
```

---

**Last Updated:** November 11, 2025  
**Feature:** Automatic Port Detection & Assignment  
**Status:** ✅ Production Ready
