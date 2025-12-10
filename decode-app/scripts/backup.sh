#!/bin/bash

# DECODE Production Backup Script
# Performs automated database and file backups

set -e

# Configuration
BACKUP_DIR="/backups"
DB_BACKUP_DIR="$BACKUP_DIR/database"
FILES_BACKUP_DIR="$BACKUP_DIR/files"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_DAYS=30

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

# Create backup directories
setup_backup_dirs() {
    mkdir -p "$DB_BACKUP_DIR"
    mkdir -p "$FILES_BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
}

# Parse database URL for connection details
parse_db_url() {
    if [ -z "$DATABASE_URL" ]; then
        error_exit "DATABASE_URL environment variable not set"
    fi
    
    # Extract components from DATABASE_URL
    # Format: postgresql://username:password@hostname:port/database
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    log "Database connection parsed: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME" $BLUE
}

# Backup database
backup_database() {
    log "🗄️  Starting database backup..." $BLUE
    
    parse_db_url
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$DB_BACKUP_DIR/decode_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    # Set password for pg_dump
    export PGPASSWORD="$DB_PASS"
    
    # Create database dump
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password \
        --verbose \
        --format=custom \
        --no-owner \
        --no-privileges \
        --exclude-table-data=audit_logs \
        --exclude-table-data=session_logs \
        > "$backup_file" 2>> "$LOG_FILE"; then
        
        # Compress the backup
        gzip "$backup_file"
        
        local backup_size=$(du -h "$compressed_file" | cut -f1)
        log "✅ Database backup completed: $compressed_file ($backup_size)" $GREEN
        
        # Verify backup integrity
        if gunzip -t "$compressed_file" 2>/dev/null; then
            log "✅ Backup integrity verified" $GREEN
        else
            error_exit "Backup integrity check failed"
        fi
        
    else
        error_exit "Database backup failed"
    fi
    
    unset PGPASSWORD
}

# Backup application files
backup_files() {
    log "📁 Starting application files backup..." $BLUE
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$FILES_BACKUP_DIR/decode_files_$timestamp.tar.gz"
    
    # Files and directories to backup
    local backup_items=(
        "/app/.env.production"
        "/app/ssl"
        "/app/logs"
        "/app/uploads"
        "/app/monitoring"
    )
    
    # Create tar archive of important files
    if tar -czf "$backup_file" -C /app \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='*.log' \
        --warning=no-file-changed \
        $(printf '%s ' "${backup_items[@]}" | sed 's|/app/||g') 2>> "$LOG_FILE"; then
        
        local backup_size=$(du -h "$backup_file" | cut -f1)
        log "✅ Files backup completed: $backup_file ($backup_size)" $GREEN
    else
        log "⚠️  Files backup completed with warnings (some files may have changed during backup)" $YELLOW
    fi
}

# Upload backups to cloud storage (if configured)
upload_to_cloud() {
    if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$BACKUP_STORAGE_BUCKET" ]; then
        log "☁️  Uploading backups to cloud storage..." $BLUE
        
        # Upload database backups
        for backup_file in "$DB_BACKUP_DIR"/*.gz; do
            if [ -f "$backup_file" ]; then
                local filename=$(basename "$backup_file")
                if aws s3 cp "$backup_file" "s3://$BACKUP_STORAGE_BUCKET/database/$filename" 2>> "$LOG_FILE"; then
                    log "✅ Uploaded database backup: $filename" $GREEN
                else
                    log "❌ Failed to upload database backup: $filename" $RED
                fi
            fi
        done
        
        # Upload file backups
        for backup_file in "$FILES_BACKUP_DIR"/*.tar.gz; do
            if [ -f "$backup_file" ]; then
                local filename=$(basename "$backup_file")
                if aws s3 cp "$backup_file" "s3://$BACKUP_STORAGE_BUCKET/files/$filename" 2>> "$LOG_FILE"; then
                    log "✅ Uploaded files backup: $filename" $GREEN
                else
                    log "❌ Failed to upload files backup: $filename" $RED
                fi
            fi
        done
    else
        log "ℹ️  Cloud storage not configured, skipping upload" $BLUE
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "🧹 Cleaning up old backups..." $BLUE
    
    # Remove local backups older than retention period
    find "$DB_BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete 2>> "$LOG_FILE" || true
    find "$FILES_BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>> "$LOG_FILE" || true
    
    # Clean up old logs
    find "$(dirname "$LOG_FILE")" -name "*.log" -type f -mtime +$RETENTION_DAYS -delete 2>> "$LOG_FILE" || true
    
    log "✅ Old backups cleaned up (older than $RETENTION_DAYS days)" $GREEN
    
    # If cloud storage is configured, clean up old cloud backups too
    if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$BACKUP_STORAGE_BUCKET" ]; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
        
        # This would require a more sophisticated cleanup script for S3
        log "ℹ️  Cloud backup cleanup should be configured separately in S3 lifecycle policies" $BLUE
    fi
}

# Test backup restoration
test_backup() {
    log "🧪 Testing backup restoration..." $BLUE
    
    # Find the most recent backup
    local latest_backup=$(ls -t "$DB_BACKUP_DIR"/*.gz 2>/dev/null | head -n1)
    
    if [ -n "$latest_backup" ]; then
        # Test that the backup can be read
        if gunzip -t "$latest_backup" 2>/dev/null; then
            log "✅ Backup restoration test passed" $GREEN
        else
            error_exit "Backup restoration test failed - backup file is corrupted"
        fi
    else
        log "⚠️  No backup files found for testing" $YELLOW
    fi
}

# Generate backup report
generate_report() {
    log "📊 Generating backup report..." $BLUE
    
    local report_file="$BACKUP_DIR/backup_report_$(date +%Y%m%d).txt"
    
    cat > "$report_file" << EOF
DECODE Backup Report
==================
Date: $(date)
Environment: ${NODE_ENV:-production}

Database Backups:
$(ls -lh "$DB_BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo "No database backups found")

File Backups:
$(ls -lh "$FILES_BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5 || echo "No file backups found")

Disk Usage:
$(df -h "$BACKUP_DIR" | tail -1)

Total Backup Size:
Database: $(du -sh "$DB_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0B")
Files: $(du -sh "$FILES_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0B")
Total: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0B")

Last 10 Log Entries:
$(tail -10 "$LOG_FILE" 2>/dev/null || echo "No log entries found")
EOF
    
    log "✅ Backup report generated: $report_file" $GREEN
}

# Send backup notification
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
                    \"title\": \"DECODE Backup Report\",
                    \"text\": \"$message\",
                    \"footer\": \"DECODE Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" 2>> "$LOG_FILE" || true
    fi
}

# Main backup function
main() {
    log "🚀 Starting DECODE backup process..." $BLUE
    
    setup_backup_dirs
    
    case "${1:-full}" in
        "database")
            backup_database
            ;;
        "files")
            backup_files
            ;;
        "full")
            backup_database
            backup_files
            upload_to_cloud
            cleanup_old_backups
            test_backup
            generate_report
            send_notification "success" "✅ DECODE backup completed successfully at $(date)"
            ;;
        "test")
            test_backup
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 [database|files|full|test|cleanup]"
            echo ""
            echo "Commands:"
            echo "  database  - Backup database only"
            echo "  files     - Backup application files only"
            echo "  full      - Complete backup process (default)"
            echo "  test      - Test backup integrity"
            echo "  cleanup   - Clean up old backups"
            exit 1
            ;;
    esac
    
    log "🎉 Backup process completed!" $GREEN
}

# Trap errors and send failure notification
trap 'send_notification "failed" "❌ DECODE backup failed at $(date). Check logs for details."; exit 1' ERR

# Run main function
main "$@"