#!/bin/sh
set -e

echo "=== FreeRADIUS Docker Entrypoint ==="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 30); do
    if nc -z "${DB_HOST}" "${DB_PORT}" 2>/dev/null; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "Waiting for PostgreSQL... attempt $i/30"
    sleep 2
done

# Enable SQL module if not already enabled
if [ ! -L /etc/raddb/mods-enabled/sql ]; then
    echo "Enabling SQL module..."
    ln -sf /etc/raddb/mods-available/sql /etc/raddb/mods-enabled/sql
fi

# Create symlinks for site configurations
echo "Configuring sites..."
ln -sf /etc/raddb/sites-available/default /etc/raddb/sites-enabled/default
ln -sf /etc/raddb/sites-available/inner-tunnel /etc/raddb/sites-enabled/inner-tunnel

# Set proper permissions
chown -R freerad:freerad /etc/raddb 2>/dev/null || true

# Test configuration
echo "Testing FreeRADIUS configuration..."
if radiusd -C; then
    echo "Configuration test passed!"
else
    echo "Configuration test FAILED!"
    exit 1
fi

# Start FreeRADIUS in foreground with debugging
echo "Starting FreeRADIUS server..."
exec radiusd -f -l stdout
