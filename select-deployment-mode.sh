#!/bin/bash
set -e

# ISP Manager - Intelligent Deployment Mode Selector
# Automatically detects nginx and configures deployment mode accordingly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Update .env with deployment mode
update_env_deployment_mode() {
    local mode=$1
    local enable_ssl=$2
    
    touch .env
    
    # Update DEPLOYMENT_MODE
    if grep -q "^DEPLOYMENT_MODE=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=$mode/" .env
        else
            sed -i "s/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=$mode/" .env
        fi
    else
        echo "DEPLOYMENT_MODE=$mode" >> .env
    fi
    
    # Update ENABLE_SSL
    if grep -q "^ENABLE_SSL=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^ENABLE_SSL=.*/ENABLE_SSL=$enable_ssl/" .env
        else
            sed -i "s/^ENABLE_SSL=.*/ENABLE_SSL=$enable_ssl/" .env
        fi
    else
        echo "ENABLE_SSL=$enable_ssl" >> .env
    fi
}

# Remove Docker nginx container
remove_docker_nginx() {
    local container=$1
    
    print_info "Removing Docker nginx container: $container"
    
    # Stop container
    if docker ps -q --filter "name=$container" 2>/dev/null | grep -q .; then
        print_info "Stopping container..."
        docker stop "$container" 2>/dev/null || true
    fi
    
    # Remove container
    docker rm "$container" 2>/dev/null || true
    
    # Remove any related volumes (optional, ask user first)
    read -p "Also remove nginx volumes? (y/N): " REMOVE_VOLUMES
    if [[ $REMOVE_VOLUMES =~ ^[Yy]$ ]]; then
        docker volume ls -q --filter "name=nginx" | xargs -r docker volume rm 2>/dev/null || true
        print_success "Removed nginx volumes"
    fi
    
    print_success "Docker nginx container removed"
}

# Main detection and selection logic
main() {
    clear
    print_header "ISP Manager - Intelligent Deployment Configuration"
    
    # Source and run nginx detection
    if [ -f detect-nginx.sh ]; then
        chmod +x detect-nginx.sh
        source detect-nginx.sh
        
        # Run detection (shows summary)
        run_nginx_detection
        DETECTION_RESULT=$?
    else
        print_error "detect-nginx.sh not found!"
        exit 1
    fi
    
    echo ""
    
    # Decision tree based on detection results
    
    # CASE 1: Host nginx detected AND RUNNING (auto-configure for host nginx mode)
    if [ "$NGINX_HOST_RUNNING" = true ]; then
        print_header "Auto-Configuration: Running Host Nginx Detected"
        
        print_success "Running nginx detected on host (version $NGINX_HOST_VERSION)"
        
        echo ""
        print_info "Automatically configuring for Host Nginx Mode:"
        echo "  ✓ Application will run in Docker"
        echo "  ✓ Nginx on host will proxy to application"
        echo "  ✓ SSL certificates managed via certbot on host"
        echo "  ✓ Port conflicts will be automatically avoided"
        echo ""
        
        # Auto-configure
        update_env_deployment_mode "host_nginx" "false"
        print_success "Configured DEPLOYMENT_MODE=host_nginx"
        
        # Adjust port if needed
        if [ -f adjust-app-port.sh ]; then
            chmod +x adjust-app-port.sh
            echo ""
            ./adjust-app-port.sh
        fi
        
        # Check and install certbot if needed
        echo ""
        print_info "Checking for certbot installation..."
        
        if ! command -v certbot &> /dev/null; then
            print_warning "Certbot not installed - installing now for SSL certificate management"
            echo ""
            
            if [ -f install-certbot.sh ]; then
                chmod +x install-certbot.sh
                ./install-certbot.sh
            else
                print_error "install-certbot.sh not found!"
                print_warning "You will need to install certbot manually before running deploy.sh"
                echo ""
                print_info "To install certbot manually:"
                echo "  Ubuntu/Debian: apt-get install certbot python3-certbot-nginx"
                echo "  RHEL/CentOS:   yum install certbot python3-certbot-nginx"
            fi
        else
            print_success "Certbot already installed"
        fi
        
        echo ""
        print_header "Next Steps"
        echo ""
        echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
        echo "  2. Run: ./deploy.sh"
        echo "  3. SSL certificates will be obtained automatically via certbot"
        echo ""
        
        return 0
    fi
    
    # CASE 2: Docker nginx detected
    if [ "$NGINX_DOCKER_DETECTED" = true ]; then
        print_header "Docker Nginx Detected"
        
        if [ "$NGINX_DOCKER_RUNNING" = true ]; then
            print_info "Running nginx container: $NGINX_DOCKER_CONTAINER"
        else
            print_warning "Stopped nginx container: $NGINX_DOCKER_CONTAINER"
        fi
        
        echo ""
        
        # Check if this is an update or fresh install
        if [ "$DEPLOYMENT_TYPE" = "update" ]; then
            print_success "Deployment Type: Update"
            echo ""
            print_info "Existing deployment detected. Configuration will be preserved."
            echo ""
            print_info "Continuing with Docker Nginx mode..."
            
            # Ensure docker_nginx mode is set
            update_env_deployment_mode "docker_nginx" "true"
            print_success "Configured DEPLOYMENT_MODE=docker_nginx"
            
            echo ""
            print_header "Next Steps"
            echo ""
            echo "  1. Run: ./deploy.sh"
            echo "  2. Your existing nginx container will be updated"
            echo ""
            
            return 0
        else
            print_warning "Deployment Type: Fresh Install"
            echo ""
            print_warning "Found existing nginx container but this appears to be a new installation."
            echo ""
            echo "What would you like to do?"
            echo ""
            echo "  ${GREEN}1. Remove existing nginx container and continue${NC}"
            echo "     (Clean slate for new deployment)"
            echo ""
            echo "  ${YELLOW}2. Cancel installation${NC}"
            echo "     (Keep existing setup, exit deployment)"
            echo ""
            
            read -p "Enter your choice (1 or 2): " DOCKER_CHOICE
            
            case $DOCKER_CHOICE in
                1)
                    echo ""
                    remove_docker_nginx "$NGINX_DOCKER_CONTAINER"
                    echo ""
                    print_info "Proceeding with fresh Docker Nginx deployment..."
                    
                    update_env_deployment_mode "docker_nginx" "true"
                    print_success "Configured DEPLOYMENT_MODE=docker_nginx"
                    
                    echo ""
                    print_header "Next Steps"
                    echo ""
                    echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
                    echo "  2. Run: ./deploy.sh"
                    echo ""
                    
                    return 0
                    ;;
                2)
                    echo ""
                    print_info "Installation cancelled by user"
                    echo ""
                    print_info "Existing nginx setup preserved"
                    exit 0
                    ;;
                *)
                    print_error "Invalid choice"
                    exit 1
                    ;;
            esac
        fi
    fi
    
    # CASE 2.5: Nginx installed but not running
    if [ "$NGINX_HOST_DETECTED" = true ] && [ "$NGINX_HOST_RUNNING" = false ]; then
        print_header "Nginx Installed But Not Running"
        
        print_info "Nginx is installed on host (version $NGINX_HOST_VERSION) but not currently running"
        echo ""
        
        echo "How would you like to proceed?"
        echo ""
        echo "  ${GREEN}1. Start Host Nginx and Use Host Mode${NC}"
        echo "     ✓ Start nginx service on host"
        echo "     ✓ Configure for Host Nginx mode"
        echo "     ✓ Best for multi-app servers"
        echo ""
        echo "  ${GREEN}2. Use Docker Nginx Instead${NC}"
        echo "     ✓ Leave host nginx stopped"
        echo "     ✓ Use containerized nginx"
        echo "     ✓ Self-contained deployment"
        echo ""
        
        read -p "Enter your choice (1 or 2): " STOPPED_CHOICE
        
        case $STOPPED_CHOICE in
            1)
                print_info "Attempting to start nginx service..."
                echo ""
                
                # Try to start nginx
                if systemctl start nginx 2>/dev/null; then
                    print_success "Nginx service started successfully"
                    
                    # Update detection to reflect running state
                    NGINX_HOST_RUNNING=true
                    
                    # Configure for host nginx mode
                    update_env_deployment_mode "host_nginx" "false"
                    print_success "Configured DEPLOYMENT_MODE=host_nginx"
                    
                    # Adjust port
                    if [ -f adjust-app-port.sh ]; then
                        chmod +x adjust-app-port.sh
                        echo ""
                        ./adjust-app-port.sh
                    fi
                    
                    # Check and install certbot if needed
                    echo ""
                    print_info "Checking for certbot installation..."
                    
                    if ! command -v certbot &> /dev/null; then
                        print_warning "Certbot not installed - installing now for SSL certificate management"
                        echo ""
                        
                        if [ -f install-certbot.sh ]; then
                            chmod +x install-certbot.sh
                            ./install-certbot.sh
                        else
                            print_error "install-certbot.sh not found!"
                            print_warning "You will need to install certbot manually before running deploy.sh"
                            echo ""
                            print_info "To install certbot manually:"
                            echo "  Ubuntu/Debian: apt-get install certbot python3-certbot-nginx"
                            echo "  RHEL/CentOS:   yum install certbot python3-certbot-nginx"
                        fi
                    else
                        print_success "Certbot already installed"
                    fi
                    
                    echo ""
                    print_header "Next Steps"
                    echo ""
                    echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
                    echo "  2. Run: ./deploy.sh"
                    echo "  3. SSL certificates will be obtained automatically via certbot"
                    echo ""
                    
                    return 0
                else
                    print_error "Failed to start nginx service"
                    print_warning "You may need to start it manually with appropriate privileges"
                    echo ""
                    print_info "Falling back to Docker Nginx mode..."
                    echo ""
                    
                    # Continue to docker nginx mode
                    update_env_deployment_mode "docker_nginx" "true"
                    print_success "Configured DEPLOYMENT_MODE=docker_nginx"
                    
                    echo ""
                    print_header "Next Steps"
                    echo ""
                    echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
                    echo "  2. Run: ./deploy.sh"
                    echo ""
                    
                    return 0
                fi
                ;;
            2)
                print_info "Using Docker Nginx mode"
                echo ""
                
                update_env_deployment_mode "docker_nginx" "true"
                print_success "Configured DEPLOYMENT_MODE=docker_nginx"
                
                echo ""
                print_header "Next Steps"
                echo ""
                echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
                echo "  2. Run: ./deploy.sh"
                echo "  3. Docker Compose will start nginx container with SSL"
                echo ""
                
                return 0
                ;;
            *)
                print_error "Invalid choice"
                exit 1
                ;;
        esac
    fi
    
    # CASE 3: No nginx detected - offer choice
    print_header "No Nginx Detected - Choose Deployment Mode"
    
    echo "No existing nginx installation found. How would you like to deploy?"
    echo ""
    
    echo "  ${GREEN}1. Install Nginx on Host (Recommended for Multi-App Servers)${NC}"
    echo "     ✓ Nginx installed on host OS (not Docker)"
    echo "     ✓ Multiple applications can share one nginx instance"
    echo "     ✓ Each app runs in Docker on unique port (5000, 5001, 5002...)"
    echo "     ✓ All SSL certs managed on host at /etc/letsencrypt/"
    echo "     ✓ Clean separation, professional architecture"
    echo ""
    echo "     ${CYAN}Best for:${NC}"
    echo "       • Servers running multiple applications"
    echo "       • Production environments with multiple services"
    echo "       • When you want centralized nginx management"
    echo ""
    
    echo "  ${GREEN}2. Docker Nginx (Single-App Deployment)${NC}"
    echo "     ✓ Self-contained docker-compose with nginx service"
    echo "     ✓ Everything runs in Docker containers"
    echo "     ✓ No interaction with other services"
    echo "     ✓ Isolated SSL certificates in Docker volumes"
    echo ""
    echo "     ${CYAN}Best for:${NC}"
    echo "       • Dedicated servers running only ISP Manager"
    echo "       • Testing/development environments"
    echo "       • Quick single-app deployments"
    echo ""
    
    read -p "Enter your choice (1 or 2): " CHOICE
    
    case $CHOICE in
        1)
            print_header "Selected: Host Nginx Mode"
            echo ""
            
            read -p "Install nginx on host now? (Y/n): " INSTALL
            
            if [[ ! $INSTALL =~ ^[Nn]$ ]]; then
                if [ -f install-host-nginx.sh ]; then
                    print_info "Installing nginx on host..."
                    echo ""
                    chmod +x install-host-nginx.sh
                    ./install-host-nginx.sh
                    echo ""
                else
                    print_error "install-host-nginx.sh not found"
                    exit 1
                fi
            else
                print_warning "Nginx installation skipped"
                echo ""
                echo "You must install nginx before deploying."
                echo "Run: ./install-host-nginx.sh"
                echo ""
            fi
            
            update_env_deployment_mode "host_nginx" "false"
            print_success "Configured DEPLOYMENT_MODE=host_nginx"
            
            # Set default port
            if [ -f adjust-app-port.sh ]; then
                chmod +x adjust-app-port.sh
                echo ""
                ./adjust-app-port.sh
            fi
            
            echo ""
            print_header "Next Steps"
            echo ""
            echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
            echo "  2. Run: ./deploy.sh"
            echo "  3. SSL certificates will be obtained automatically via certbot"
            echo ""
            ;;
            
        2)
            print_header "Selected: Docker Nginx Mode"
            echo ""
            
            update_env_deployment_mode "docker_nginx" "true"
            print_success "Configured DEPLOYMENT_MODE=docker_nginx"
            
            echo ""
            print_header "Next Steps"
            echo ""
            echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
            echo "  2. Run: ./deploy.sh"
            echo "  3. Docker Compose will start nginx container with SSL"
            echo ""
            ;;
            
        *)
            print_error "Invalid choice. Please run the script again and choose 1 or 2."
            exit 1
            ;;
    esac
    
    echo ""
    print_success "Deployment mode configured successfully!"
    echo ""
}

# Run main
main
exit $?
