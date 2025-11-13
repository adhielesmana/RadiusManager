# FreeRADIUS Configuration

## Default Setup: Local FreeRADIUS Container

By default, the ISP Manager uses a **local FreeRADIUS container** that runs alongside the application.

### How It Works:

```
Internet → Nginx (host:443)
    ↓
ISP Manager App (Docker)
    ↓
Local FreeRADIUS (Docker) ← Default
    ↓
PostgreSQL (Docker)
```

### Configuration (.env):
```bash
# Default - Uses local FreeRADIUS container
RADIUS_HOST=freeradius
RADIUS_SECRET=testing123
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
```

---

## Customize: Use External FreeRADIUS Server

If you have an existing FreeRADIUS server or want to use a remote one:

### 1. Edit .env file:
```bash
# External FreeRADIUS
RADIUS_HOST=192.168.1.100        # Change to your server IP/hostname
RADIUS_SECRET=your-shared-secret # Match your FreeRADIUS secret
RADIUS_AUTH_PORT=1812            # Default auth port
RADIUS_ACCT_PORT=1813            # Default accounting port
```

### 2. Restart the application:
```bash
./deploy.sh
```

### 3. Configure your external FreeRADIUS:

Add ISP Manager as a NAS client in `/etc/raddb/clients.conf`:
```conf
client isp-manager {
    ipaddr = YOUR_ISP_MANAGER_IP
    secret = your-shared-secret
    shortname = isp-manager
    nastype = other
}
```

Restart FreeRADIUS:
```bash
systemctl restart freeradius
```

---

## Switch Between Local and External

### Use Local FreeRADIUS (Docker):
```bash
# Edit .env
RADIUS_HOST=freeradius

# Restart
./deploy.sh
```

### Use External FreeRADIUS:
```bash
# Edit .env
RADIUS_HOST=192.168.1.100
RADIUS_SECRET=matching-secret

# Restart
./deploy.sh
```

---

## Benefits of Each Setup

### Local FreeRADIUS (Default):
- ✅ Zero configuration needed
- ✅ All-in-one deployment
- ✅ Automatic database integration
- ✅ Perfect for single-server setups

### External FreeRADIUS:
- ✅ Centralized RADIUS server
- ✅ Multiple apps can share one RADIUS
- ✅ Existing infrastructure integration
- ✅ High availability setups

---

## Database Integration

Both local and external FreeRADIUS can connect to the same PostgreSQL database:

### Local FreeRADIUS:
- Automatically connects to ISP Manager's PostgreSQL
- Shares `radcheck`, `radreply`, `radusergroup` tables

### External FreeRADIUS:
- Configure SQL module to point to ISP Manager database
- Edit `/etc/raddb/mods-available/sql`:
```conf
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"
    
    server = "YOUR_ISP_MANAGER_IP"
    port = 5433
    login = "ispuser"
    password = "isppass123"
    radius_db = "ispmanager"
}
```

---

**Seamless switching between local and external FreeRADIUS!** 🚀
