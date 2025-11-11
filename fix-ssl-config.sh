#!/bin/bash

# Quick fix script to enable SSL in .env file

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Fixing SSL Configuration${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Error: .env file not found${NC}"
    echo "Please run ./setup.sh first"
    exit 1
fi

# Ask for domain
read -p "Enter your domain name (e.g., isp.yourcompany.com): " DOMAIN
read -p "Enter your email for Let's Encrypt: " EMAIL

# Validate inputs
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${YELLOW}Error: Domain and email are required${NC}"
    exit 1
fi

echo ""
echo "Updating .env file..."

# Update .env file (works on both Linux and macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/^ENABLE_SSL=.*/ENABLE_SSL=true/" .env
    sed -i '' "s/^APP_DOMAIN=.*/APP_DOMAIN=$DOMAIN/" .env
    sed -i '' "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$EMAIL/" .env
else
    # Linux
    sed -i "s/^ENABLE_SSL=.*/ENABLE_SSL=true/" .env
    sed -i "s/^APP_DOMAIN=.*/APP_DOMAIN=$DOMAIN/" .env
    sed -i "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$EMAIL/" .env
fi

echo -e "${GREEN}✓ SSL configuration updated${NC}"
echo ""
echo "Configuration:"
echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo "  SSL:    ENABLED"
echo ""
echo -e "${BLUE}Next step: Run './deploy.sh' to deploy with SSL${NC}"
