#!/bin/bash

# DECODE Disaster Recovery Script
# Handles backup restoration and failover procedures

set -e

# Configuration
BACKUP_DIR="/backups"
RESTORE_DIR="/restore"
LOG_FILE="/var/log/decode-recovery.log"

# Load environment variables
if [ -f "/app/.env.production" ]; then
    source /app/.env.production
fi

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

# Parse database URL for connection details
parse_db_url() {
    if [ -z "$DATABASE_URL" ]; then
        error_exit "DATABASE_URL environment variable not set"
    fi
    
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
}

# Check system prerequisites
check_prerequisites() {
    log "🔍 Checking system prerequisites..." $BLUE
    
    # Check if required tools are available
    for tool in pg_restore docker-compose curl; do
        if ! command -v $tool &> /dev/null; then
            error_exit "$tool is not installed or not in PATH"
        fi
    done
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        error_exit "Backup directory $BACKUP_DIR not found"
    fi
    
    # Check Docker availability
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running"
    fi
    
    log "✅ Prerequisites check passed" $GREEN
}

# Download backups from cloud storage
download_backups() {
    log "☁️  Downloading backups from cloud storage..." $BLUE
    
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$BACKUP_STORAGE_BUCKET" ]; then
        log "⚠️  Cloud storage not configured, using local backups only" $YELLOW
        return 0
    fi
    
    # Create temporary download directory
    mkdir -p "$RESTORE_DIR/downloads"
    
    # Download latest database backup
    if aws s3 sync "s3://$BACKUP_STORAGE_BUCKET/database/" "$RESTORE_DIR/downloads/database/" --exclude "*" --include "*.gz" 2>> "$LOG_FILE"; then
        log "✅ Database backups downloaded" $GREEN
    else
        log "❌ Failed to download database backups" $RED
    fi
    
    # Download latest files backup
    if aws s3 sync "s3://$BACKUP_STORAGE_BUCKET/files/" "$RESTORE_DIR/downloads/files/" --exclude "*" --include "*.tar.gz" 2>> "$LOG_FILE"; then
        log "✅ Files backups downloaded" $GREEN
    else
        log "❌ Failed to download files backups" $RED
    fi
}

# List available backups
list_backups() {
    log "📋 Available backups:" $BLUE
    
    echo "Database Backups:"
    if [ -d "$BACKUP_DIR/database" ]; then
        ls -lht "$BACKUP_DIR/database"/*.gz 2>/dev/null | head -10 || echo "  No database backups found"
    fi
    
    if [ -d "$RESTORE_DIR/downloads/database" ]; then
        echo "  Downloaded from cloud:"
        ls -lht "$RESTORE_DIR/downloads/database"/*.gz 2>/dev/null | head -5 || echo "  No downloaded database backups found"
    fi
    
    echo ""
    echo "Files Backups:"
    if [ -d "$BACKUP_DIR/files" ]; then
        ls -lht "$BACKUP_DIR/files"/*.tar.gz 2>/dev/null | head -10 || echo "  No file backups found"
    fi
    
    if [ -d "$RESTORE_DIR/downloads/files" ]; then
        echo "  Downloaded from cloud:"
        ls -lht "$RESTORE_DIR/downloads/files"/*.tar.gz 2>/dev/null | head -5 || echo "  No downloaded file backups found"
    fi
}

# Select backup file
select_backup() {
    local backup_type="$1"
    local backup_file=""
    
    if [ "$backup_type" = "database" ]; then
        # Find the most recent database backup
        backup_file=$(find "$BACKUP_DIR/database" "$RESTORE_DIR/downloads/database" -name "*.gz" -type f 2>/dev/null | sort -r | head -1)
    elif [ "$backup_type" = "files" ]; then
        # Find the most recent files backup
        backup_file=$(find "$BACKUP_DIR/files" "$RESTORE_DIR/downloads/files" -name "*.tar.gz" -type f 2>/dev/null | sort -r | head -1)
    fi
    
    if [ -z "$backup_file" ]; then
        error_exit "No $backup_type backup found"
    fi
    
    echo "$backup_file"
}

# Restore database
restore_database() {
    log "🗄️  Starting database restoration..." $BLUE
    
    parse_db_url
    
    local backup_file="${1:-$(select_backup database)}"
    
    if [ ! -f "$backup_file" ]; then
        error_exit "Backup file not found: $backup_file"
    fi
    
    log "📁 Using backup file: $backup_file" $BLUE
    
    # Verify backup integrity
    if ! gunzip -t "$backup_file" 2>/dev/null; then
        error_exit "Backup file is corrupted: $backup_file"
    fi
    
    # Stop application to prevent database writes
    log "⏹️  Stopping application..." $YELLOW
    docker-compose -f docker-compose.production.yml stop decode-app || true
    
    # Create restoration database (temporary)
    local restore_db="${DB_NAME}_restore_$(date +%s)"
    
    export PGPASSWORD="$DB_PASS"
    
    # Create temporary database for restoration
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$restore_db" 2>> "$LOG_FILE"; then
        log "✅ Created temporary restoration database: $restore_db" $GREEN
    else
        error_exit "Failed to create restoration database"
    fi
    
    # Restore backup to temporary database
    if gunzip -c "$backup_file" | pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$restore_db" --verbose --no-owner --no-privileges 2>> "$LOG_FILE"; then
        log "✅ Backup restored to temporary database" $GREEN
    else
        dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$restore_db" 2>/dev/null || true
        error_exit "Database restoration failed"
    fi
    
    # Verify restoration
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$restore_db" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    
    if [ "$table_count" -gt 0 ]; then
        log "✅ Restoration verified: $table_count tables found" $GREEN
    else
        dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$restore_db" 2>/dev/null || true
        error_exit "Restoration verification failed"
    fi
    
    # Backup current database before replacement
    local current_backup="${DB_NAME}_pre_restore_$(date +%s)"
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=custom > "/tmp/$current_backup.dump" 2>> "$LOG_FILE"; then
        log "✅ Current database backed up as: $current_backup" $GREEN
    else
        log "⚠️  Failed to backup current database" $YELLOW
    fi
    
    # Drop current database and rename restored database
    log "🔄 Replacing current database..." $YELLOW
    
    # Terminate all connections to the current database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME';" 2>> "$LOG_FILE" || true
    
    # Drop current database
    if dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>> "$LOG_FILE"; then
        log "✅ Current database dropped" $GREEN
    else
        error_exit "Failed to drop current database"
    fi
    
    # Rename restored database to current name
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "ALTER DATABASE \"$restore_db\" RENAME TO \"$DB_NAME\";" 2>> "$LOG_FILE"; then
        log "✅ Database restoration completed successfully" $GREEN
    else
        error_exit "Failed to rename restored database"
    fi
    
    unset PGPASSWORD
    
    # Restart application
    log "▶️  Restarting application..." $GREEN
    docker-compose -f docker-compose.production.yml start decode-app
    
    # Wait for application to be ready
    sleep 30
    
    # Test application health
    if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
        log "✅ Application is healthy after database restoration" $GREEN
    else
        log "⚠️  Application health check failed - manual intervention may be required" $YELLOW
    fi
}

# Restore application files
restore_files() {
    log "📁 Starting files restoration..." $BLUE
    
    local backup_file="${1:-$(select_backup files)}"
    
    if [ ! -f "$backup_file" ]; then
        error_exit "Files backup not found: $backup_file"
    fi
    
    log "📁 Using backup file: $backup_file" $BLUE
    
    # Create restoration directory
    mkdir -p "$RESTORE_DIR/files"
    
    # Extract backup
    if tar -xzf "$backup_file" -C "$RESTORE_DIR/files" 2>> "$LOG_FILE"; then
        log "✅ Files backup extracted" $GREEN
    else
        error_exit "Failed to extract files backup"
    fi
    
    # Stop application for file replacement
    log "⏹️  Stopping application for file restoration..." $YELLOW
    docker-compose -f docker-compose.production.yml stop decode-app || true
    
    # Backup current files
    local timestamp=$(date +%Y%m%d_%H%M%S)
    if tar -czf "/tmp/decode_files_pre_restore_$timestamp.tar.gz" -C /app ssl logs uploads monitoring 2>> "$LOG_FILE"; then
        log "✅ Current files backed up" $GREEN
    else
        log "⚠️  Failed to backup current files" $YELLOW
    fi
    
    # Restore files
    if cp -r "$RESTORE_DIR/files"/* /app/ 2>> "$LOG_FILE"; then
        log "✅ Files restored successfully" $GREEN
    else
        error_exit "Failed to restore files"
    fi
    
    # Fix permissions
    chown -R nextjs:nodejs /app/ssl /app/logs /app/uploads 2>/dev/null || true
    chmod 600 /app/ssl/*.key 2>/dev/null || true
    chmod 644 /app/ssl/*.crt 2>/dev/null || true
    
    # Restart application
    log "▶️  Restarting application..." $GREEN
    docker-compose -f docker-compose.production.yml start decode-app
}

# Full system restoration
full_restore() {
    log "🚀 Starting full system restoration..." $BLUE
    
    check_prerequisites
    download_backups
    list_backups
    
    # Confirm with user (unless in automated mode)
    if [ "${AUTO_CONFIRM:-false}" != "true" ]; then
        echo ""
        read -p "⚠️  This will replace the current database and files. Continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "❌ Restoration cancelled by user" $YELLOW
            exit 0
        fi
    fi
    
    restore_database
    restore_files
    
    log "🎉 Full system restoration completed!" $GREEN
    
    # Send notification
    send_notification "success" "✅ DECODE disaster recovery completed successfully at $(date)"
}

# System health check after restoration
health_check() {
    log "🏥 Performing post-restoration health check..." $BLUE
    
    local health_url="http://localhost:3000/api/health"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null; then
            log "✅ Application health check passed" $GREEN
            return 0
        fi
        
        log "⏳ Health check attempt $attempt/$max_attempts..." $BLUE
        sleep 10
        ((attempt++))
    done
    
    error_exit "Application failed health check after restoration"
}

# Failover to backup environment
failover() {
    log "🔄 Initiating failover procedure..." $BLUE
    
    # This would typically involve:
    # 1. Updating DNS to point to backup environment
    # 2. Starting backup services
    # 3. Restoring latest data to backup environment
    
    # For now, we'll simulate a local failover
    log "⚠️  Failover procedure is environment-specific and should be customized" $YELLOW
    log "ℹ️  Typical failover steps:" $BLUE
    echo "   1. Update DNS records to point to backup environment"
    echo "   2. Start backup environment services"
    echo "   3. Restore latest data from backups"
    echo "   4. Verify application functionality"
    echo "   5. Notify users of the failover"
}

# Send notification
send_notification() {
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local status="$1"
        local message="$2"
        local color="good"
        
        if [ "$status" = "failed" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"DECODE Disaster Recovery\",
                    \"text\": \"$message\",
                    \"footer\": \"DECODE DR System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" 2>> "$LOG_FILE" || true
    fi
}

# Main function
main() {
    log "🚨 DECODE Disaster Recovery System" $BLUE
    log "=================================" $BLUE
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    case "${1:-help}" in
        "restore-db")
            check_prerequisites
            download_backups
            restore_database "$2"
            health_check
            ;;
        "restore-files")
            check_prerequisites
            download_backups
            restore_files "$2"
            ;;
        "full-restore")
            full_restore
            health_check
            ;;
        "list-backups")
            download_backups
            list_backups
            ;;
        "health-check")
            health_check
            ;;
        "failover")
            failover
            ;;
        "download")
            download_backups
            ;;
        *)
            echo "DECODE Disaster Recovery Script"
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  restore-db [backup_file]    - Restore database from backup"
            echo "  restore-files [backup_file] - Restore application files"
            echo "  full-restore               - Complete system restoration"
            echo "  list-backups               - List available backups"
            echo "  health-check               - Check application health"
            echo "  failover                   - Initiate failover procedure"
            echo "  download                   - Download backups from cloud"
            echo ""
            echo "Environment Variables:"
            echo "  AUTO_CONFIRM=true          - Skip confirmation prompts"
            echo "  DATABASE_URL               - Database connection string"
            echo "  AWS_ACCESS_KEY_ID          - AWS credentials for backup download"
            echo "  BACKUP_STORAGE_BUCKET      - S3 bucket for backups"
            echo "  SLACK_WEBHOOK_URL          - Slack notifications"
            exit 1
            ;;
    esac
}

# Trap errors and send failure notification
trap 'send_notification "failed" "❌ DECODE disaster recovery failed at $(date). Check logs: $LOG_FILE"; exit 1' ERR

# Run main function
main "$@"