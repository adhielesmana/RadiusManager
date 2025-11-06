#!/bin/bash
set -e

# ISP Manager - Deployment Script
# This script builds and deploys the ISP Manager application with Docker

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command_exists docker; then
        print_error "Docker is not installed"
        print_info "Please run './setup.sh' first"
        exit 1
    fi
    print_success "Docker is available"
    
    # Check Docker Compose
    if ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available"
        print_info "Please run './setup.sh' first"
        exit 1
    fi
    print_success "Docker Compose is available"
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running"
        print_info "Please start Docker and try again"
        exit 1
    fi
    print_success "Docker daemon is running"
    
    # Check .env file
    if [ ! -f .env ]; then
        print_error ".env file not found"
        print_info "Please run './setup.sh' first to create the environment file"
        exit 1
    fi
    print_success ".env file exists"
    
    # Load SSL configuration from .env
    if [ -f .env ]; then
        set -a
        source .env
        set +a
        
        if [ "$ENABLE_SSL" = "true" ]; then
            COMPOSE_FILES="-f docker-compose.yml -f docker-compose.ssl.yml"
            SSL_MODE="ENABLED"
            print_info "SSL Mode: ENABLED (using domain: ${APP_DOMAIN})"
        else
            COMPOSE_FILES="-f docker-compose.yml"
            SSL_MODE="DISABLED"
            print_info "SSL Mode: DISABLED (local development)"
        fi
    fi
    
    # Check curl (needed for health checks)
    if ! command_exists curl; then
        print_warning "curl not found, will skip application health check"
        SKIP_CURL_CHECK=true
    else
        SKIP_CURL_CHECK=false
    fi
}

# Stop existing containers
stop_containers() {
    print_header "Stopping Existing Containers"
    
    if docker compose $COMPOSE_FILES ps -q 2>/dev/null | grep -q .; then
        print_info "Stopping running containers..."
        docker compose $COMPOSE_FILES down
        print_success "Containers stopped"
    else
        print_info "No running containers to stop"
    fi
}

# Build images
build_images() {
    print_header "Building Docker Images"
    
    print_info "Building Docker images..."
    if [ "$REBUILD" = true ]; then
        docker compose $COMPOSE_FILES build --no-cache
    else
        docker compose $COMPOSE_FILES build
    fi
    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_header "Starting Services"
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        print_info "Starting PostgreSQL, FreeRADIUS, ISP Manager, and Nginx (SSL)..."
    else
        print_info "Starting PostgreSQL, FreeRADIUS, and ISP Manager..."
    fi
    
    docker compose $COMPOSE_FILES up -d
    print_success "Services started in background"
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services to be Ready"
    
    # Wait for PostgreSQL
    print_info "Waiting for PostgreSQL..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose exec -T postgres pg_isready -U ispuser >/dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "PostgreSQL failed to start"
        exit 1
    fi
    
    # Wait for ISP Manager application
    if [ "$SKIP_CURL_CHECK" = false ]; then
        print_info "Waiting for ISP Manager application..."
        attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|302"; then
                print_success "ISP Manager application is ready"
                break
            fi
            attempt=$((attempt + 1))
            echo -n "."
            sleep 2
        done
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "ISP Manager application may not be fully ready yet"
            print_info "Check logs with: docker compose logs -f app"
        fi
    else
        print_info "Waiting for ISP Manager application (curl not available)..."
        sleep 10
        print_info "Application should be starting, check logs if needed"
    fi
    
    # Check FreeRADIUS
    print_info "Checking FreeRADIUS..."
    if docker compose exec -T freeradius radiusd -v >/dev/null 2>&1; then
        print_success "FreeRADIUS is running"
    else
        print_warning "FreeRADIUS status could not be verified"
    fi
}

# Display service status
show_status() {
    print_header "Service Status"
    docker compose $COMPOSE_FILES ps
}

# Display logs (last 20 lines)
show_logs() {
    print_header "Recent Logs"
    print_info "Application logs (last 20 lines):"
    docker compose $COMPOSE_FILES logs --tail=20 app
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo ""
        print_info "Nginx logs (last 10 lines):"
        docker compose $COMPOSE_FILES logs --tail=10 reverse-proxy
    fi
}

# Display access information
show_access_info() {
    print_header "Access Information"
    
    echo -e "${GREEN}ISP Manager Application:${NC}"
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo -e "  URL:      ${BLUE}https://${APP_DOMAIN}${NC}"
        echo -e "  Note:     ${YELLOW}SSL certificate obtained from Let's Encrypt${NC}"
    else
        echo -e "  URL:      ${BLUE}http://localhost:5000${NC}"
    fi
    echo -e "  Username: ${BLUE}adhielesmana${NC}"
    echo -e "  Password: ${BLUE}admin123${NC}"
    echo ""
    
    echo -e "${GREEN}Database Access:${NC}"
    echo -e "  Host:     ${BLUE}localhost${NC}"
    echo -e "  Port:     ${BLUE}5432${NC}"
    echo -e "  Database: ${BLUE}ispmanager${NC}"
    echo -e "  Username: ${BLUE}ispuser${NC}"
    echo -e "  Password: ${BLUE}(see .env file)${NC}"
    echo ""
    
    echo -e "${GREEN}FreeRADIUS:${NC}"
    echo -e "  Auth Port:   ${BLUE}1812/udp${NC}"
    echo -e "  Acct Port:   ${BLUE}1813/udp${NC}"
    echo -e "  Secret:      ${BLUE}(see .env file)${NC}"
    echo ""
}

# Display useful commands
show_commands() {
    print_header "Useful Commands"
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.ssl.yml"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    echo -e "${GREEN}View logs:${NC}"
    echo -e "  ${COMPOSE_CMD} logs -f              # All services"
    echo -e "  ${COMPOSE_CMD} logs -f app          # Application only"
    echo -e "  ${COMPOSE_CMD} logs -f freeradius   # FreeRADIUS only"
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo -e "  ${COMPOSE_CMD} logs -f reverse-proxy  # Nginx/SSL logs"
    fi
    echo ""
    
    echo -e "${GREEN}Manage services:${NC}"
    echo -e "  ${COMPOSE_CMD} ps                   # Service status"
    echo -e "  ${COMPOSE_CMD} restart app          # Restart application"
    echo -e "  ${COMPOSE_CMD} down                 # Stop all services"
    echo -e "  ${COMPOSE_CMD} down -v              # Stop and remove data"
    echo ""
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo -e "${GREEN}SSL Certificate Management:${NC}"
        echo -e "  ${COMPOSE_CMD} exec reverse-proxy certbot renew     # Manual renewal check"
        echo -e "  ${COMPOSE_CMD} exec reverse-proxy certbot certificates  # View cert info"
        echo -e "  ${COMPOSE_CMD} logs reverse-proxy | grep certbot    # Check renewal logs"
        echo ""
    fi
    
    echo -e "${GREEN}Database access:${NC}"
    echo -e "  docker compose exec postgres psql -U ispuser -d ispmanager"
    echo ""
    
    echo -e "${GREEN}Test RADIUS authentication:${NC}"
    echo -e "  radtest testuser testpass localhost 0 \$(grep RADIUS_SECRET .env | cut -d= -f2)"
    echo ""
}

# Main deployment function
main() {
    print_header "ISP Manager - Deployment"
    
    # Parse command line arguments
    REBUILD=false
    SKIP_BUILD=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --rebuild)
                REBUILD=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --help)
                echo "Usage: ./deploy.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --rebuild      Force rebuild of Docker images"
                echo "  --skip-build   Skip building, just restart services"
                echo "  --help         Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Validate conflicting flags
    if [ "$REBUILD" = true ] && [ "$SKIP_BUILD" = true ]; then
        print_error "Cannot use --rebuild and --skip-build together"
        print_info "Use --help for usage information"
        exit 1
    fi
    
    # Run deployment steps
    check_prerequisites
    stop_containers
    
    if [ "$SKIP_BUILD" = false ]; then
        build_images
        start_services
    else
        print_info "Skipping build as requested, starting services..."
        start_services
    fi
    wait_for_services
    
    echo ""
    show_status
    echo ""
    show_logs
    echo ""
    show_access_info
    show_commands
    
    # Final success message
    print_header "Deployment Complete!"
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        print_success "ISP Manager is now running at https://${APP_DOMAIN}"
        echo ""
        print_info "SSL certificate status:"
        docker compose $COMPOSE_FILES exec -T reverse-proxy certbot certificates 2>/dev/null || print_warning "Certificate info not available yet"
    else
        print_success "ISP Manager is now running at http://localhost:5000"
    fi
}

# Run main function
main "$@"

exit 0
