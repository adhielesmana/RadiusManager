# Nginx + Certbot for ISP Manager
FROM nginx:alpine

# Install certbot and dependencies
RUN apk add --no-cache \
    certbot \
    certbot-nginx \
    openssl \
    curl \
    bash \
    dcron \
    && mkdir -p /var/www/certbot \
    && mkdir -p /etc/letsencrypt \
    && mkdir -p /var/log/letsencrypt

# Copy configuration templates
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY site.conf.template /etc/nginx/templates/default.conf.template
COPY entrypoint.sh /entrypoint.sh
COPY renew-certs.sh /usr/local/bin/renew-certs.sh

# Make scripts executable
RUN chmod +x /entrypoint.sh /usr/local/bin/renew-certs.sh

# Create cron job for certificate renewal (runs daily at 2 AM)
RUN echo "0 2 * * * /usr/local/bin/renew-certs.sh >> /var/log/certbot-renew.log 2>&1" > /etc/crontabs/root

# Health check endpoint
RUN mkdir -p /usr/share/nginx/html && \
    echo "OK" > /usr/share/nginx/html/health

# Expose HTTP and HTTPS
EXPOSE 80 443

# Use custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
