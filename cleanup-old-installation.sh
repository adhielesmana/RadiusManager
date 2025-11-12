#!/bin/bash
set -e

# Cleanup Script for Old ISP Manager Installations
# This removes all isp-manager and radius-manager containers/volumes/networks

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_header "ISP Manager Cleanup Script"
echo ""
print_warning "This will remove ALL isp-manager and radius-manager containers, volumes, and networks"
echo ""

# Show what will be deleted
print_info "Containers to be removed:"
docker ps -a --format '{{.Names}}' | grep -E '^(isp-|radius)' || echo "  (none)"
echo ""

print_info "Networks to be removed:"
docker network ls --format '{{.Name}}' | grep -E '(isp-manager|radiusmanager)' || echo "  (none)"
echo ""

print_info "Volumes to be removed:"
docker volume ls --format '{{.Name}}' | grep -E '(isp-manager|radiusmanager)' || echo "  (none)"
echo ""

read -p "Proceed with cleanup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cleanup cancelled"
    exit 0
fi

echo ""
print_header "Removing Old Installations"

# Stop and remove containers
print_info "Stopping and removing containers..."
docker ps -a --format '{{.Names}}' | grep -E '^(isp-|radius)' | xargs -r docker rm -f 2>/dev/null || true
print_success "Containers removed"

# Remove volumes
print_info "Removing volumes..."
docker volume ls --format '{{.Name}}' | grep -E '(isp-manager|radiusmanager)' | xargs -r docker volume rm 2>/dev/null || true
print_success "Volumes removed"

# Remove networks (but be careful with networks that may be in use)
print_info "Removing networks..."
docker network ls --format '{{.Name}}' | grep -E '(isp-manager|radiusmanager)' | xargs -r docker network rm 2>/dev/null || true
print_success "Networks removed"

# Clean up any dangling images
print_info "Removing dangling images..."
docker image prune -f >/dev/null 2>&1
print_success "Dangling images removed"

echo ""
print_header "Cleanup Complete!"
echo ""
print_success "All old ISP Manager installations have been removed"
print_info "You can now run ./deploy.sh --rebuild to install fresh"
echo ""
