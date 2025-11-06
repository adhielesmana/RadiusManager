#!/bin/bash
# Certificate renewal script
# Runs daily via cron at 2 AM

echo "[$(date)] Starting certificate renewal check..."

# Renew certificates (certbot will only renew if expiring within 30 days)
certbot renew --webroot -w /var/www/certbot --quiet --deploy-hook "nginx -s reload"

RENEWAL_EXIT_CODE=$?

if [ $RENEWAL_EXIT_CODE -eq 0 ]; then
    echo "[$(date)] Certificate renewal check completed successfully"
else
    echo "[$(date)] Certificate renewal check failed with exit code: $RENEWAL_EXIT_CODE"
fi

exit $RENEWAL_EXIT_CODE
