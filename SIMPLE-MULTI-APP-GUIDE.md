# Simple Multi-App Setup Guide

## ✅ Auto-Port Detection Enabled!

You don't need to know ports anymore - the script **detects and suggests** them automatically!

---

## 🚀 How to Use

### **Run the script:**

```bash
./setup-multi-app.sh
```

### **Answer the prompts:**

```
Enter your email for SSL certificates: adhielesmana@gmail.com

How many applications? 2

================================================
Application 1 of 2
================================================

App 1 - Name: isp-manager
App 1 - Domain: isp.maxnetplus.id

✓ Suggested available port: 5000
App 1 - Use port 5000 or enter custom port [Enter=5000]: ⏎

✓ App 1 configured

================================================
Application 2 of 2
================================================

App 2 - Name: monitoring  
App 2 - Domain: monitoring.maxnetplus.id

✓ Suggested available port: 5100
App 2 - Use port 5100 or enter custom port [Enter=5100]: ⏎

✓ App 2 configured
```

### **Just press Enter** to accept suggested ports! 🎉

---

## 📋 Then Run These Commands:

```bash
# 1. Get SSL certificates for all domains
./ssl-commands/get-all-certificates.sh

# 2. Install configs to your Nginx
./install-to-nginx.sh

# Done!
```

---

## ✅ What It Does Automatically

✅ **Detects** which ports are already in use
✅ **Suggests** next available port for each app
✅ **Prevents** duplicate ports in the same session
✅ **Validates** your input if you choose custom port
✅ **Generates** Nginx config for each app
✅ **Creates** SSL certificate script
✅ **Creates** installation script

---

## 🎯 Port Suggestions

The script suggests ports in a smart way:

- **App 1:** 5000 (or next available)
- **App 2:** 5100 (or next available)
- **App 3:** 5200 (or next available)
- **App 4:** 5300 (or next available)

This spreads them out so they're easy to remember!

---

## 💡 Custom Port?

If you want a specific port, just type it:

```
✓ Suggested available port: 5000
App 1 - Use port 5000 or enter custom port [Enter=5000]: 3000

✓ Using port 3000
```

The script will check if it's available!

---

## 🌍 Perfect for Multiple Locations

Run on each server - ports are auto-detected:

**Jakarta:**
```bash
./setup-multi-app.sh
# Auto-suggests: 5000, 5100 ✓
```

**Surabaya:**
```bash
./setup-multi-app.sh  
# Auto-detects 5000 is used, suggests: 5001, 5101 ✓
```

**Bali:**
```bash
./setup-multi-app.sh
# Auto-suggests: 5000, 5100 ✓
```

Each location adapts automatically! 🚀

---

## ⚠️ No Port Detection Tools?

If your system doesn't have `netstat`, `ss`, or `lsof`, you'll see:

```
⚠ Port detection tools (netstat/ss/lsof) not found
ℹ Port availability checks will be disabled - please verify ports manually
```

The script will still work, but you'll need to verify ports yourself.

---

## 📊 Summary

**Old way:**
- Manually check which ports are free
- Guess port numbers
- Hope no conflicts
- Risk duplicates

**New way:**
- Run script
- Press Enter on each port
- Done! ✓

---

**Try it now!**

```bash
./setup-multi-app.sh
```

Just press Enter for each port suggestion! 🎉

---

**Last Updated:** November 11, 2025  
**Feature:** Automatic Port Detection with Conflict Prevention  
**Status:** ✅ Tested & Ready
