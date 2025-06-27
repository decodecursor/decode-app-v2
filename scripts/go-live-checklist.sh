#!/bin/bash

# DECODE Go-Live Checklist Script
# Interactive checklist for production launch verification

set -e

# Configuration
CHECKLIST_FILE="./go-live-checklist.json"
RESULTS_DIR="./launch-verification"
LOG_FILE="$RESULTS_DIR/go-live-verification.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Emojis for visual feedback
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
ROCKET="🚀"
LOCK="🔐"
CHART="📊"
BACKUP="💾"
TEST="🧪"

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Create checklist data structure
create_checklist() {
    cat > "$CHECKLIST_FILE" << 'EOF'
{
  "categories": {
    "environment": {
      "name": "Environment Configuration",
      "icon": "🔧",
      "items": [
        {
          "id": "env_variables",
          "description": "Production environment variables configured",
          "automated": true,
          "critical": true
        },
        {
          "id": "supabase_connection",
          "description": "Supabase production database connected",
          "automated": true,
          "critical": true
        },
        {
          "id": "crossmint_config",
          "description": "Crossmint production API keys configured",
          "automated": true,
          "critical": true
        },
        {
          "id": "ssl_certificates",
          "description": "SSL certificates installed and valid",
          "automated": true,
          "critical": true
        }
      ]
    },
    "security": {
      "name": "Security Configuration",
      "icon": "🔐",
      "items": [
        {
          "id": "https_enforced",
          "description": "HTTPS enforced (HTTP redirects to HTTPS)",
          "automated": true,
          "critical": true
        },
        {
          "id": "security_headers",
          "description": "Security headers configured",
          "automated": true,
          "critical": true
        },
        {
          "id": "rate_limiting",
          "description": "Rate limiting active",
          "automated": true,
          "critical": true
        },
        {
          "id": "input_validation",
          "description": "Input validation enabled",
          "automated": false,
          "critical": true
        }
      ]
    },
    "payments": {
      "name": "Payment Processing",
      "icon": "💳",
      "items": [
        {
          "id": "crossmint_production",
          "description": "Crossmint production environment configured",
          "automated": true,
          "critical": true
        },
        {
          "id": "webhook_endpoints",
          "description": "Webhook endpoints secure and functional",
          "automated": true,
          "critical": true
        },
        {
          "id": "payment_splitting",
          "description": "Payment splitting logic tested",
          "automated": false,
          "critical": true
        },
        {
          "id": "transaction_logging",
          "description": "Transaction logging working",
          "automated": true,
          "critical": true
        }
      ]
    },
    "monitoring": {
      "name": "Monitoring & Alerting",
      "icon": "📊",
      "items": [
        {
          "id": "health_endpoint",
          "description": "Health check endpoint responding",
          "automated": true,
          "critical": true
        },
        {
          "id": "metrics_collection",
          "description": "Metrics collection active",
          "automated": true,
          "critical": true
        },
        {
          "id": "alert_notifications",
          "description": "Alert notifications configured",
          "automated": false,
          "critical": false
        },
        {
          "id": "error_tracking",
          "description": "Error tracking enabled (Sentry)",
          "automated": true,
          "critical": false
        }
      ]
    },
    "backup": {
      "name": "Backup & Recovery",
      "icon": "💾",
      "items": [
        {
          "id": "automated_backups",
          "description": "Automated backups scheduled",
          "automated": true,
          "critical": true
        },
        {
          "id": "backup_integrity",
          "description": "Backup integrity verified",
          "automated": true,
          "critical": true
        },
        {
          "id": "disaster_recovery",
          "description": "Disaster recovery procedures tested",
          "automated": false,
          "critical": true
        },
        {
          "id": "cloud_backup",
          "description": "Cloud backup storage configured",
          "automated": true,
          "critical": false
        }
      ]
    },
    "performance": {
      "name": "Performance & Scaling",
      "icon": "⚡",
      "items": [
        {
          "id": "load_time",
          "description": "Application load time < 3 seconds",
          "automated": true,
          "critical": true
        },
        {
          "id": "api_response_time",
          "description": "API response time < 1 second",
          "automated": true,
          "critical": true
        },
        {
          "id": "database_optimization",
          "description": "Database query optimization",
          "automated": false,
          "critical": false
        },
        {
          "id": "cdn_configuration",
          "description": "CDN configuration (if applicable)",
          "automated": false,
          "critical": false
        }
      ]
    },
    "testing": {
      "name": "Testing",
      "icon": "🧪",
      "items": [
        {
          "id": "production_tests",
          "description": "All production tests passing",
          "automated": true,
          "critical": true
        },
        {
          "id": "e2e_validation",
          "description": "End-to-end user journeys verified",
          "automated": true,
          "critical": true
        },
        {
          "id": "payment_flow_tested",
          "description": "Payment processing flow tested",
          "automated": false,
          "critical": true
        },
        {
          "id": "split_payments_validated",
          "description": "Split payment functionality validated",
          "automated": false,
          "critical": true
        }
      ]
    }
  }
}
EOF
}

# Load checklist results
load_results() {
    if [ -f "$RESULTS_DIR/checklist-results.json" ]; then
        cat "$RESULTS_DIR/checklist-results.json"
    else
        echo '{}'
    fi
}

# Save checklist results
save_results() {
    local results="$1"
    echo "$results" > "$RESULTS_DIR/checklist-results.json"
}

# Run automated check
run_automated_check() {
    local check_id="$1"
    local base_url="${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}"
    
    case "$check_id" in
        "env_variables")
            if [ -f ".env.production" ] && grep -q "NODE_ENV=production" .env.production; then
                return 0
            fi
            return 1
            ;;
        "supabase_connection")
            if curl -f -s "$base_url/api/health" | grep -q '"database":"healthy"'; then
                return 0
            fi
            return 1
            ;;
        "crossmint_config")
            if grep -q "CROSSMINT_API_KEY" .env.production && grep -q "production" .env.production; then
                return 0
            fi
            return 1
            ;;
        "ssl_certificates")
            if echo | openssl s_client -servername decode.beauty -connect decode.beauty:443 2>/dev/null | openssl x509 -noout -dates > /dev/null; then
                return 0
            fi
            return 1
            ;;
        "https_enforced")
            local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://decode.beauty" 2>/dev/null || echo "000")
            if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
                return 0
            fi
            return 1
            ;;
        "security_headers")
            local headers=$(curl -s -I "$base_url" 2>/dev/null || echo "")
            if echo "$headers" | grep -qi "strict-transport-security" && echo "$headers" | grep -qi "x-content-type-options"; then
                return 0
            fi
            return 1
            ;;
        "rate_limiting")
            # Test rate limiting by making multiple requests
            local rate_limit_hit=false
            for i in {1..25}; do
                local status=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/health" 2>/dev/null || echo "000")
                if [ "$status" = "429" ]; then
                    rate_limit_hit=true
                    break
                fi
                sleep 0.1
            done
            if [ "$rate_limit_hit" = true ]; then
                return 0
            fi
            return 1
            ;;
        "crossmint_production")
            if grep -q "NEXT_PUBLIC_CROSSMINT_ENVIRONMENT=production" .env.production; then
                return 0
            fi
            return 1
            ;;
        "webhook_endpoints")
            if curl -f -s "$base_url/api/webhooks/crossmint" > /dev/null 2>&1; then
                return 0
            fi
            return 1
            ;;
        "transaction_logging")
            if curl -f -s "$base_url/api/metrics" | grep -q "decode_transactions_total"; then
                return 0
            fi
            return 1
            ;;
        "health_endpoint")
            if curl -f -s "$base_url/api/health" | grep -q "healthy"; then
                return 0
            fi
            return 1
            ;;
        "metrics_collection")
            if curl -f -s "$base_url/api/metrics" | grep -q "decode_app_uptime_seconds"; then
                return 0
            fi
            return 1
            ;;
        "error_tracking")
            if grep -q "SENTRY_DSN" .env.production; then
                return 0
            fi
            return 1
            ;;
        "automated_backups")
            if [ -f "./scripts/backup.sh" ] && [ -x "./scripts/backup.sh" ]; then
                return 0
            fi
            return 1
            ;;
        "backup_integrity")
            if ./scripts/backup.sh test > /dev/null 2>&1; then
                return 0
            fi
            return 1
            ;;
        "cloud_backup")
            if grep -q "BACKUP_STORAGE_BUCKET" .env.production; then
                return 0
            fi
            return 1
            ;;
        "load_time")
            local start_time=$(date +%s%N)
            curl -s "$base_url" > /dev/null 2>&1
            local end_time=$(date +%s%N)
            local load_time_ms=$(( (end_time - start_time) / 1000000 ))
            if [ $load_time_ms -lt 3000 ]; then
                return 0
            fi
            return 1
            ;;
        "api_response_time")
            local start_time=$(date +%s%N)
            curl -s "$base_url/api/health" > /dev/null 2>&1
            local end_time=$(date +%s%N)
            local response_time_ms=$(( (end_time - start_time) / 1000000 ))
            if [ $response_time_ms -lt 1000 ]; then
                return 0
            fi
            return 1
            ;;
        "production_tests")
            if ./scripts/run-production-tests.sh all > /dev/null 2>&1; then
                return 0
            fi
            return 1
            ;;
        "e2e_validation")
            if ./scripts/run-production-tests.sh e2e > /dev/null 2>&1; then
                return 0
            fi
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

# Interactive checklist runner
run_interactive_checklist() {
    log "$ROCKET Starting DECODE Go-Live Verification..." $BLUE
    
    mkdir -p "$RESULTS_DIR"
    create_checklist
    
    local results=$(load_results)
    local total_items=0
    local passed_items=0
    local critical_failed=0
    
    # Process each category
    for category_key in $(jq -r '.categories | keys[]' "$CHECKLIST_FILE"); do
        local category_name=$(jq -r ".categories.$category_key.name" "$CHECKLIST_FILE")
        local category_icon=$(jq -r ".categories.$category_key.icon" "$CHECKLIST_FILE")
        
        echo ""
        log "$category_icon $category_name" $PURPLE
        echo "$(printf '%.0s-' {1..50})"
        
        # Process each item in category
        local item_count=$(jq -r ".categories.$category_key.items | length" "$CHECKLIST_FILE")
        for i in $(seq 0 $((item_count - 1))); do
            local item=$(jq -r ".categories.$category_key.items[$i]" "$CHECKLIST_FILE")
            local item_id=$(echo "$item" | jq -r '.id')
            local description=$(echo "$item" | jq -r '.description')
            local automated=$(echo "$item" | jq -r '.automated')
            local critical=$(echo "$item" | jq -r '.critical')
            
            ((total_items++))
            
            local status="unknown"
            
            if [ "$automated" = "true" ]; then
                echo -n "Testing: $description... "
                if run_automated_check "$item_id"; then
                    echo -e "${GREEN}$CHECK PASS${NC}"
                    status="pass"
                    ((passed_items++))
                else
                    echo -e "${RED}$CROSS FAIL${NC}"
                    status="fail"
                    if [ "$critical" = "true" ]; then
                        ((critical_failed++))
                    fi
                fi
            else
                echo -n "$description "
                if [ "$critical" = "true" ]; then
                    echo -e "${YELLOW}(CRITICAL - Manual Verification Required)${NC}"
                else
                    echo -e "${BLUE}(Manual Verification Required)${NC}"
                fi
                
                while true; do
                    read -p "Has this been completed? (y/n/skip): " -r response
                    case $response in
                        [Yy]*)
                            echo -e "${GREEN}$CHECK VERIFIED${NC}"
                            status="pass"
                            ((passed_items++))
                            break
                            ;;
                        [Nn]*)
                            echo -e "${RED}$CROSS NOT COMPLETED${NC}"
                            status="fail"
                            if [ "$critical" = "true" ]; then
                                ((critical_failed++))
                            fi
                            break
                            ;;
                        [Ss]*)
                            echo -e "${YELLOW}$WARNING SKIPPED${NC}"
                            status="skip"
                            break
                            ;;
                        *)
                            echo "Please answer y (yes), n (no), or skip"
                            ;;
                    esac
                done
            fi
            
            # Update results
            results=$(echo "$results" | jq --arg id "$item_id" --arg status "$status" '.[$id] = $status')
        done
    done
    
    # Save results
    save_results "$results"
    
    # Generate summary
    echo ""
    echo "$(printf '%.0s=' {1..60})"
    log "$ROCKET GO-LIVE VERIFICATION SUMMARY" $PURPLE
    echo "$(printf '%.0s=' {1..60})"
    
    local pass_percentage=$((passed_items * 100 / total_items))
    
    echo ""
    echo -e "Total Items Checked: ${BLUE}$total_items${NC}"
    echo -e "Items Passed: ${GREEN}$passed_items${NC}"
    echo -e "Items Failed: ${RED}$((total_items - passed_items))${NC}"
    echo -e "Success Rate: ${BLUE}$pass_percentage%${NC}"
    echo ""
    
    if [ $critical_failed -eq 0 ]; then
        echo -e "${GREEN}$CHECK ALL CRITICAL CHECKS PASSED${NC}"
        echo ""
        echo -e "${GREEN}$ROCKET READY FOR PRODUCTION LAUNCH! $ROCKET${NC}"
        echo ""
        echo "🎉 Congratulations! Your DECODE platform is ready to go live."
        echo "🌟 All critical systems are operational and secure."
        echo "💄 Beauty professionals can now start accepting payments!"
        
        # Generate launch commands
        echo ""
        echo "📋 LAUNCH COMMANDS:"
        echo "==================="
        echo "1. Final deployment: ./scripts/deploy-production.sh deploy"
        echo "2. DNS update: Point decode.beauty to this server"
        echo "3. Monitor health: curl https://decode.beauty/api/health"
        echo "4. Watch logs: docker-compose -f docker-compose.production.yml logs -f"
        
        return 0
    else
        echo -e "${RED}$CROSS $critical_failed CRITICAL ISSUES FOUND${NC}"
        echo ""
        echo -e "${YELLOW}$WARNING PRODUCTION LAUNCH BLOCKED${NC}"
        echo ""
        echo "🚫 Critical issues must be resolved before going live."
        echo "🔧 Please address the failed items and run this checklist again."
        
        return 1
    fi
}

# Generate detailed report
generate_launch_report() {
    log "📊 Generating launch verification report..." $BLUE
    
    local results=$(load_results)
    local report_file="$RESULTS_DIR/launch-verification-report.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DECODE Launch Verification Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .category { margin: 20px 0; padding: 15px; border-left: 4px solid #2196F3; background: #f8f9fa; }
        .pass { color: #4CAF50; }
        .fail { color: #f44336; }
        .skip { color: #ff9800; }
        .summary { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .critical { background: #ffebee; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 DECODE Launch Verification Report</h1>
        
        <div class="header">
            <h2 style="color: white; margin-top: 0;">Launch Readiness Assessment</h2>
            <p><strong>Platform:</strong> DECODE Beauty Payment Platform</p>
            <p><strong>Environment:</strong> Production</p>
            <p><strong>Assessment Date:</strong> $(date)</p>
            <p><strong>Verification Status:</strong> $([ $critical_failed -eq 0 ] && echo "✅ READY FOR LAUNCH" || echo "❌ LAUNCH BLOCKED")</p>
        </div>
EOF

    # Add category results
    for category_key in $(jq -r '.categories | keys[]' "$CHECKLIST_FILE"); do
        local category_name=$(jq -r ".categories.$category_key.name" "$CHECKLIST_FILE")
        local category_icon=$(jq -r ".categories.$category_key.icon" "$CHECKLIST_FILE")
        
        echo "<div class=\"category\">" >> "$report_file"
        echo "<h3>$category_icon $category_name</h3>" >> "$report_file"
        echo "<ul>" >> "$report_file"
        
        local item_count=$(jq -r ".categories.$category_key.items | length" "$CHECKLIST_FILE")
        for i in $(seq 0 $((item_count - 1))); do
            local item=$(jq -r ".categories.$category_key.items[$i]" "$CHECKLIST_FILE")
            local item_id=$(echo "$item" | jq -r '.id')
            local description=$(echo "$item" | jq -r '.description')
            local critical=$(echo "$item" | jq -r '.critical')
            
            local status=$(echo "$results" | jq -r --arg id "$item_id" '.[$id] // "unknown"')
            local status_class=""
            local status_icon=""
            
            case "$status" in
                "pass") status_class="pass"; status_icon="✅" ;;
                "fail") status_class="fail"; status_icon="❌" ;;
                "skip") status_class="skip"; status_icon="⚠️" ;;
                *) status_class="skip"; status_icon="❓" ;;
            esac
            
            echo "<li class=\"$status_class\">$status_icon $description" >> "$report_file"
            if [ "$critical" = "true" ]; then
                echo " <span class=\"critical\">(CRITICAL)</span>" >> "$report_file"
            fi
            echo "</li>" >> "$report_file"
        done
        
        echo "</ul>" >> "$report_file"
        echo "</div>" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF
        <div class="summary">
            <h3>🎯 Launch Readiness Summary</h3>
            <p><strong>Total Checks:</strong> $total_items</p>
            <p><strong>Passed:</strong> $passed_items</p>
            <p><strong>Failed:</strong> $((total_items - passed_items))</p>
            <p><strong>Success Rate:</strong> $pass_percentage%</p>
            $([ $critical_failed -eq 0 ] && echo "<p style=\"color: #4CAF50;\"><strong>✅ ALL CRITICAL CHECKS PASSED - READY FOR LAUNCH</strong></p>" || echo "<p style=\"color: #f44336;\"><strong>❌ $critical_failed CRITICAL ISSUES - LAUNCH BLOCKED</strong></p>")
        </div>
        
        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; text-align: center;">
            <p>Generated by DECODE Launch Verification System</p>
            <p>$(date)</p>
        </footer>
    </div>
</body>
</html>
EOF
    
    log "✅ Launch verification report generated: $report_file" $GREEN
}

# Main function
main() {
    case "${1:-checklist}" in
        "checklist")
            if run_interactive_checklist; then
                generate_launch_report
                exit 0
            else
                generate_launch_report
                exit 1
            fi
            ;;
        "report")
            generate_launch_report
            ;;
        *)
            echo "DECODE Go-Live Checklist"
            echo "Usage: $0 [checklist|report]"
            echo ""
            echo "Commands:"
            echo "  checklist  - Run interactive go-live checklist (default)"
            echo "  report     - Generate launch verification report"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"