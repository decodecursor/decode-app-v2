#!/bin/bash

# DECODE Production Deployment Script
# Automates the complete production deployment process

set -e

# Configuration
APP_NAME="decode-app"
DOMAIN="decode.beauty"
BACKUP_DIR="./backups/pre-deployment"
LOG_FILE="./logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error_exit() {
    log "❌ ERROR: $1" $RED
    exit 1
}

# Pre-deployment checks
pre_deployment_checks() {
    log "🔍 Running pre-deployment checks..." $BLUE
    
    # Check if required files exist
    [ -f ".env.production" ] || error_exit ".env.production file not found. Please create it from .env.production.example"
    [ -f "docker-compose.production.yml" ] || error_exit "docker-compose.production.yml not found"
    [ -f "Dockerfile.production" ] || error_exit "Dockerfile.production not found"
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running"
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Compose is not installed"
    fi
    
    # Validate environment variables
    source .env.production
    
    [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] || error_exit "NEXT_PUBLIC_SUPABASE_URL not set in .env.production"
    [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] || error_exit "SUPABASE_SERVICE_ROLE_KEY not set in .env.production"
    [ -n "$CROSSMINT_API_KEY" ] || error_exit "CROSSMINT_API_KEY not set in .env.production"
    [ -n "$DATABASE_URL" ] || error_exit "DATABASE_URL not set in .env.production"
    [ -n "$JWT_SECRET" ] || error_exit "JWT_SECRET not set in .env.production"
    
    log "✅ Pre-deployment checks passed"
}

# Create backup of current deployment
create_backup() {
    log "💾 Creating deployment backup..." $BLUE
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current containers if they exist
    if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
        log "📦 Backing up current containers..."
        docker-compose -f docker-compose.production.yml stop
        
        # Export current images
        docker save $(docker-compose -f docker-compose.production.yml config --services | xargs -I {} echo "decode-app_{}") > "$BACKUP_DIR/images-$(date +%Y%m%d-%H%M%S).tar" || true
    fi
    
    # Backup volumes
    if docker volume ls | grep -q "decode-app"; then
        log "💿 Backing up Docker volumes..."
        mkdir -p "$BACKUP_DIR/volumes"
        docker run --rm -v decode-app_redis-data:/source -v "$(pwd)/$BACKUP_DIR/volumes":/backup alpine tar czf /backup/redis-data.tar.gz -C /source . || true
    fi
    
    log "✅ Backup created in $BACKUP_DIR"
}

# Setup SSL certificates
setup_ssl() {
    log "🔐 Setting up SSL certificates..." $BLUE
    
    if [ ! -f "./ssl/$DOMAIN.crt" ] || [ ! -f "./ssl/$DOMAIN.key" ]; then
        log "🔧 SSL certificates not found, generating..."
        ./scripts/setup-ssl.sh auto
    else
        log "✅ SSL certificates already exist"
    fi
}

# Build and deploy application
deploy_application() {
    log "🚀 Building and deploying application..." $BLUE
    
    # Pull latest images
    log "📥 Pulling latest base images..."
    docker-compose -f docker-compose.production.yml pull
    
    # Build application image
    log "🔨 Building application image..."
    docker-compose -f docker-compose.production.yml build
    
    # Start services
    log "▶️  Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be healthy
    log "⏳ Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    log "🏥 Checking service health..." $BLUE
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
            log "✅ Application is healthy"
            return 0
        fi
        
        log "⏳ Attempt $attempt/$max_attempts - waiting for application to be ready..."
        sleep 10
        ((attempt++))
    done
    
    error_exit "Application failed to become healthy after $max_attempts attempts"
}

# Run post-deployment tests
run_post_deployment_tests() {
    log "🧪 Running post-deployment tests..." $BLUE
    
    # Test main application endpoint
    if curl -f -s "https://$DOMAIN" > /dev/null; then
        log "✅ Main application endpoint accessible"
    else
        log "⚠️  Main application endpoint not accessible via HTTPS" $YELLOW
    fi
    
    # Test API health endpoint
    if curl -f -s "https://$DOMAIN/api/health" > /dev/null; then
        log "✅ API health endpoint accessible"
    else
        log "❌ API health endpoint not accessible" $RED
    fi
    
    # Test SSL certificate
    if echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates > /dev/null; then
        log "✅ SSL certificate is valid"
    else
        log "⚠️  SSL certificate validation failed" $YELLOW
    fi
    
    # Test database connectivity (through application)
    if curl -f -s -H "Content-Type: application/json" "https://$DOMAIN/api/health" | grep -q "healthy"; then
        log "✅ Database connectivity through application"
    else
        log "⚠️  Database connectivity test failed" $YELLOW
    fi
}

# Setup monitoring and alerts
setup_monitoring() {
    log "📊 Setting up monitoring..." $BLUE
    
    # Start monitoring services if profile is available
    if docker-compose -f docker-compose.production.yml --profile monitoring config > /dev/null 2>&1; then
        log "📈 Starting monitoring services..."
        docker-compose -f docker-compose.production.yml --profile monitoring up -d
        
        # Wait for Grafana to be ready
        sleep 30
        
        if curl -f -s "http://localhost:3001" > /dev/null; then
            log "✅ Grafana monitoring dashboard available at http://localhost:3001"
        fi
    else
        log "ℹ️  Monitoring profile not configured, skipping..." $YELLOW
    fi
}

# Setup automated backups
setup_backups() {
    log "💾 Setting up automated backups..." $BLUE
    
    # Create backup script
    mkdir -p scripts
    
    # Start backup service if profile is available
    if docker-compose -f docker-compose.production.yml --profile backup config > /dev/null 2>&1; then
        log "📦 Starting backup services..."
        docker-compose -f docker-compose.production.yml --profile backup up -d
        log "✅ Automated backup services started"
    else
        log "ℹ️  Backup profile not configured" $YELLOW
    fi
}

# Cleanup old resources
cleanup() {
    log "🧹 Cleaning up old resources..." $BLUE
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    # docker volume prune -f
    
    log "✅ Cleanup completed"
}

# Display deployment summary
deployment_summary() {
    log "📋 Deployment Summary" $BLUE
    echo "===================="
    echo "🌐 Application URL: https://$DOMAIN"
    echo "🏥 Health Check: https://$DOMAIN/api/health"
    echo "📊 Monitoring: http://localhost:3001 (if enabled)"
    echo "📝 Logs: docker-compose -f docker-compose.production.yml logs -f"
    echo "🔧 Management: docker-compose -f docker-compose.production.yml [command]"
    echo ""
    echo "📁 Important Files:"
    echo "   - Configuration: .env.production"
    echo "   - SSL Certificates: ./ssl/"
    echo "   - Backups: $BACKUP_DIR"
    echo "   - Logs: $LOG_FILE"
    echo ""
    echo "🚀 Deployment completed successfully!"
}

# Rollback function
rollback() {
    log "🔄 Rolling back deployment..." $YELLOW
    
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        log "📦 Restoring from backup..."
        
        # Stop current containers
        docker-compose -f docker-compose.production.yml down
        
        # Restore images if available
        if [ -f "$BACKUP_DIR"/images-*.tar ]; then
            log "🔄 Restoring container images..."
            docker load < "$BACKUP_DIR"/images-*.tar
        fi
        
        # Restore volumes if available
        if [ -f "$BACKUP_DIR/volumes/redis-data.tar.gz" ]; then
            log "💿 Restoring Redis data..."
            docker run --rm -v decode-app_redis-data:/target -v "$(pwd)/$BACKUP_DIR/volumes":/backup alpine tar xzf /backup/redis-data.tar.gz -C /target
        fi
        
        # Restart services
        docker-compose -f docker-compose.production.yml up -d
        
        log "✅ Rollback completed"
    else
        error_exit "No backup found for rollback"
    fi
}

# Main deployment function
main() {
    log "🚀 Starting DECODE Production Deployment" $BLUE
    log "=========================================" $BLUE
    
    # Create logs directory
    mkdir -p logs
    
    case "${1:-deploy}" in
        "deploy")
            pre_deployment_checks
            create_backup
            setup_ssl
            deploy_application
            run_post_deployment_tests
            setup_monitoring
            setup_backups
            cleanup
            deployment_summary
            ;;
        "rollback")
            rollback
            ;;
        "health")
            check_service_health
            ;;
        "ssl")
            setup_ssl
            ;;
        "backup")
            create_backup
            ;;
        "logs")
            docker-compose -f docker-compose.production.yml logs -f
            ;;
        "status")
            docker-compose -f docker-compose.production.yml ps
            ;;
        *)
            echo "DECODE Production Deployment Script"
            echo "Usage: $0 [deploy|rollback|health|ssl|backup|logs|status]"
            echo ""
            echo "Commands:"
            echo "  deploy    - Full production deployment (default)"
            echo "  rollback  - Rollback to previous deployment"
            echo "  health    - Check application health"
            echo "  ssl       - Setup/renew SSL certificates"
            echo "  backup    - Create deployment backup"
            echo "  logs      - View application logs"
            echo "  status    - Show service status"
            exit 1
            ;;
    esac
}

# Trap errors and provide rollback option
trap 'echo -e "\n${RED}❌ Deployment failed!${NC}"; echo "Run $0 rollback to restore previous state"; exit 1' ERR

# Run main function
main "$@"