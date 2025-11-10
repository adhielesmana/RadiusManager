# Docker Container Isolation Guide

This document explains how ISP Manager is configured to **safely coexist** with your existing Docker containers on the same server without causing any conflicts or crashes.

## 🛡️ Isolation Features

### 1. **Dedicated Network with Custom Subnet**

ISP Manager uses a completely isolated Docker network that won't interfere with your existing containers:

```yaml
Network Name: isp-manager-network
Subnet: 172.25.0.0/16
Gateway: 172.25.0.1
```

**Why this matters:**
- Docker's default network uses `172.17.0.0/16`
- Other projects might use `172.18.0.0/16`, `172.19.0.0/16`, etc.
- ISP Manager uses `172.25.0.0/16` to completely avoid IP address conflicts
- Your existing containers remain untouched on their own networks

### 2. **Namespaced Volume Names**

All Docker volumes are prefixed with `isp-manager-` to prevent naming conflicts:

```yaml
Volumes:
- isp-manager-postgres-data
- isp-manager-letsencrypt
- isp-manager-certbot
- isp-manager-nginx-cache
```

**Why this matters:**
- If you have another PostgreSQL container with a volume named `postgres-data`, it won't conflict
- Each project's data is completely isolated

### 3. **Configurable Port Mappings**

All ports can be customized via `.env` file to avoid conflicts:

| Service | Default Host Port | Container Port | Customizable Via |
|---------|------------------|----------------|------------------|
| ISP Manager App | 5000 | 5000 | `APP_HOST_PORT` |
| PostgreSQL | **5433** | 5432 | `POSTGRES_HOST_PORT` |
| FreeRADIUS Auth | 1812 | 1812 | `RADIUS_AUTH_PORT` |
| FreeRADIUS Acct | 1813 | 1813 | `RADIUS_ACCT_PORT` |
| Nginx HTTP | 80 | 80 | `HTTP_PORT` |
| Nginx HTTPS | 443 | 443 | `HTTPS_PORT` |

**Note:** PostgreSQL defaults to **5433** (not 5432) to avoid conflicts with existing PostgreSQL instances.

### 4. **Resource Limits**

Each container has CPU and memory limits to prevent resource starvation of your other containers:

| Container | CPU Limit | Memory Limit | CPU Reservation | Memory Reservation |
|-----------|-----------|--------------|-----------------|-------------------|
| PostgreSQL | 2.0 cores | 1 GB | 0.5 cores | 256 MB |
| FreeRADIUS | 1.0 cores | 512 MB | 0.25 cores | 128 MB |
| ISP Manager App | 2.0 cores | 2 GB | 0.5 cores | 512 MB |
| Nginx (SSL) | 1.0 cores | 512 MB | 0.25 cores | 128 MB |

**Why this matters:**
- Prevents ISP Manager from consuming all server resources
- Your existing containers continue to get their fair share of CPU/memory
- System remains stable even under heavy load

### 5. **Isolated Container Names**

All containers have unique, prefixed names:

```
Container Names:
- isp-postgres
- isp-freeradius
- isp-manager-app
- isp-manager-nginx
```

## 📋 Configuration Guide

### Step 1: Check Your Existing Services

Before deploying, check what ports are already in use:

```bash
# Check all listening ports
sudo netstat -tlnp | grep LISTEN

# Or using ss
sudo ss -tlnp | grep LISTEN

# Check Docker networks
docker network ls

# Check Docker volumes
docker volume ls
```

### Step 2: Customize Ports if Needed

Create or edit `.env` file:

```bash
cp .env.example .env
nano .env
```

Example customization for a server with existing PostgreSQL and web server:

```env
# Your existing PostgreSQL is on 5432, so we use 5433 (default)
POSTGRES_HOST_PORT=5433

# Your existing web server is on 5000, so use 5001
APP_HOST_PORT=5001

# Your existing Nginx uses 80/443, so integrate with it
ENABLE_SSL=existing_nginx
APP_DOMAIN=isp.yourcompany.com

# All other ports are standard
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
```

### Step 3: Verify Isolation After Deployment

After running `./deploy.sh`, verify your containers are properly isolated:

```bash
# Check ISP Manager network
docker network inspect isp-manager-network

# Should show subnet 172.25.0.0/16
# Your other containers should NOT be on this network

# Verify resource limits
docker stats

# Should show CPU% and MEM% limits for isp-* containers

# Check volumes
docker volume ls | grep isp-manager

# Should show all ISP Manager volumes with isp-manager- prefix
```

## 🔧 Troubleshooting

### Problem: Port Already in Use

**Symptom:**
```
Error: Bind for 0.0.0.0:5432 failed: port is already allocated
```

**Solution:**
Edit `.env` and change the conflicting port:

```env
# If PostgreSQL port 5432 is taken
POSTGRES_HOST_PORT=5433

# If app port 5000 is taken
APP_HOST_PORT=5001

# If RADIUS ports are taken
RADIUS_AUTH_PORT=11812
RADIUS_ACCT_PORT=11813
```

Then redeploy:
```bash
./deploy.sh
```

### Problem: Existing Containers Crashed After ISP Manager Deployment

**Possible causes:**
1. Network IP range conflict (very rare with our 172.25.0.0/16 range)
2. Resource exhaustion
3. Docker daemon restart

**Diagnosis:**
```bash
# Check Docker daemon logs
sudo journalctl -u docker.service --since "10 minutes ago"

# Check if other containers are running
docker ps -a

# Check resource usage
docker stats --no-stream

# Restart stopped containers
docker start <container-name>
```

**Prevention:**
The resource limits in ISP Manager should prevent this. If it still happens, you can further restrict ISP Manager resources by editing `docker-compose.yml`:

```yaml
app:
  deploy:
    resources:
      limits:
        cpus: '1.0'      # Reduce from 2.0 to 1.0
        memory: 1G       # Reduce from 2G to 1G
```

### Problem: Network Conflict

**Very Rare:** If somehow 172.25.0.0/16 is already in use:

Edit `docker-compose.yml` and change the subnet:

```yaml
networks:
  isp-internal-network:
    driver: bridge
    name: isp-manager-network
    ipam:
      driver: default
      config:
        - subnet: 172.26.0.0/16  # Change to different range
          gateway: 172.26.0.1
```

## 🔐 Security Notes

1. **Network Isolation**: ISP Manager containers can ONLY communicate with each other on the `isp-manager-network`. They cannot directly access containers on other networks.

2. **No Default Bridge**: ISP Manager does NOT use Docker's default bridge network, ensuring complete isolation.

3. **Explicit Port Exposure**: Only services that need external access have ports exposed to the host.

## 📊 Resource Planning

**Minimum Server Requirements** (when running alongside other services):

- **RAM**: 4 GB total (ISP Manager needs ~2 GB max, reserves ~1 GB minimum)
- **CPU**: 4 cores total (ISP Manager uses max 5 cores across all containers)
- **Disk**: 20 GB for ISP Manager volumes and images

**Recommended for Shared Servers:**

- **RAM**: 8 GB+ total
- **CPU**: 6+ cores total
- **Disk**: 50 GB+ with SSD

## 🚀 Best Practices

1. **Always use the latest .env.example** when upgrading to get new port options

2. **Document your port mappings** to avoid future conflicts:
   ```bash
   # Create a port mapping reference
   echo "ISP Manager Ports:" > PORTS.txt
   grep _PORT .env >> PORTS.txt
   ```

3. **Monitor resource usage** after deployment:
   ```bash
   # Watch in real-time
   docker stats
   ```

4. **Regular cleanup** of unused Docker resources:
   ```bash
   # Remove unused volumes (ISP Manager volumes are protected)
   docker volume prune
   
   # Remove unused networks
   docker network prune
   ```

## 📞 Support

If you experience any conflicts with existing Docker containers after following this guide:

1. Run diagnostics:
   ```bash
   docker compose ps
   docker compose logs --tail=50
   docker network ls
   docker volume ls
   ```

2. Check your `.env` configuration

3. Verify no port conflicts exist

The ISP Manager deployment is designed to be a **good neighbor** on your Docker server! 🏠
