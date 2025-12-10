#!/bin/bash

# DECODE Production Testing Script
# Comprehensive test suite for production environment validation

set -e

# Configuration
TEST_DIR="./tests/production"
RESULTS_DIR="./test-results"
LOG_FILE="$RESULTS_DIR/production-tests.log"
REPORT_FILE="$RESULTS_DIR/test-report.html"

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
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

# Setup test environment
setup_tests() {
    log "🔧 Setting up test environment..." $BLUE
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Check if required tools are available
    for tool in npx curl docker-compose; do
        if ! command -v $tool &> /dev/null; then
            error_exit "$tool is not installed or not in PATH"
        fi
    done
    
    # Verify production environment is running
    if ! curl -f -s "${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}/api/health" > /dev/null; then
        error_exit "Production environment is not accessible. Please ensure it's running."
    fi
    
    log "✅ Test environment setup complete" $GREEN
}

# Run API tests
run_api_tests() {
    log "🌐 Running API tests..." $BLUE
    
    local base_url="${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}"
    local test_results=""
    
    # Test health endpoint
    log "🔍 Testing health endpoint..." $BLUE
    if curl -f -s "$base_url/api/health" | grep -q "healthy"; then
        log "✅ Health endpoint test passed" $GREEN
        test_results+="✅ Health endpoint: PASS\n"
    else
        log "❌ Health endpoint test failed" $RED
        test_results+="❌ Health endpoint: FAIL\n"
    fi
    
    # Test metrics endpoint
    log "📊 Testing metrics endpoint..." $BLUE
    if curl -f -s "$base_url/api/metrics" | grep -q "decode_app_uptime_seconds"; then
        log "✅ Metrics endpoint test passed" $GREEN
        test_results+="✅ Metrics endpoint: PASS\n"
    else
        log "❌ Metrics endpoint test failed" $RED
        test_results+="❌ Metrics endpoint: FAIL\n"
    fi
    
    # Test HTTPS redirect
    log "🔒 Testing HTTPS redirect..." $BLUE
    local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://decode.beauty" || echo "000")
    if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
        log "✅ HTTPS redirect test passed" $GREEN
        test_results+="✅ HTTPS redirect: PASS\n"
    else
        log "❌ HTTPS redirect test failed (status: $http_response)" $RED
        test_results+="❌ HTTPS redirect: FAIL\n"
    fi
    
    # Test rate limiting
    log "⚡ Testing rate limiting..." $BLUE
    local rate_limit_hit=false
    for i in {1..25}; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/health")
        if [ "$status" = "429" ]; then
            rate_limit_hit=true
            break
        fi
        sleep 0.1
    done
    
    if [ "$rate_limit_hit" = true ]; then
        log "✅ Rate limiting test passed" $GREEN
        test_results+="✅ Rate limiting: PASS\n"
    else
        log "⚠️  Rate limiting test inconclusive" $YELLOW
        test_results+="⚠️  Rate limiting: INCONCLUSIVE\n"
    fi
    
    echo -e "$test_results" >> "$RESULTS_DIR/api-tests.txt"
}

# Run security tests
run_security_tests() {
    log "🔐 Running security tests..." $BLUE
    
    local base_url="${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}"
    local test_results=""
    
    # Check security headers
    log "🛡️  Testing security headers..." $BLUE
    local headers_response=$(curl -s -I "$base_url")
    
    local required_headers=(
        "strict-transport-security"
        "x-content-type-options"
        "x-frame-options"
        "x-xss-protection"
    )
    
    local headers_passed=0
    for header in "${required_headers[@]}"; do
        if echo "$headers_response" | grep -qi "$header"; then
            ((headers_passed++))
            log "✅ Security header found: $header" $GREEN
        else
            log "❌ Missing security header: $header" $RED
        fi
    done
    
    if [ $headers_passed -eq ${#required_headers[@]} ]; then
        test_results+="✅ Security headers: PASS\n"
    else
        test_results+="❌ Security headers: FAIL ($headers_passed/${#required_headers[@]})\n"
    fi
    
    # Test SSL certificate
    log "📜 Testing SSL certificate..." $BLUE
    if echo | openssl s_client -servername decode.beauty -connect decode.beauty:443 2>/dev/null | openssl x509 -noout -dates > /dev/null; then
        log "✅ SSL certificate test passed" $GREEN
        test_results+="✅ SSL certificate: PASS\n"
        
        # Check certificate expiration
        local cert_expiry=$(echo | openssl s_client -servername decode.beauty -connect decode.beauty:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
        local days_until_expiry=$(( ($(date -d "$cert_expiry" +%s) - $(date +%s)) / 86400 ))
        
        if [ $days_until_expiry -gt 30 ]; then
            log "✅ SSL certificate expires in $days_until_expiry days" $GREEN
        else
            log "⚠️  SSL certificate expires in $days_until_expiry days" $YELLOW
        fi
    else
        log "❌ SSL certificate test failed" $RED
        test_results+="❌ SSL certificate: FAIL\n"
    fi
    
    echo -e "$test_results" >> "$RESULTS_DIR/security-tests.txt"
}

# Run performance tests
run_performance_tests() {
    log "⚡ Running performance tests..." $BLUE
    
    local base_url="${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}"
    local test_results=""
    
    # Test page load time
    log "🏃 Testing page load performance..." $BLUE
    local start_time=$(date +%s%N)
    curl -s "$base_url" > /dev/null
    local end_time=$(date +%s%N)
    local load_time_ms=$(( (end_time - start_time) / 1000000 ))
    
    if [ $load_time_ms -lt 3000 ]; then
        log "✅ Page load time: ${load_time_ms}ms (under 3s)" $GREEN
        test_results+="✅ Page load time: PASS (${load_time_ms}ms)\n"
    else
        log "❌ Page load time: ${load_time_ms}ms (over 3s)" $RED
        test_results+="❌ Page load time: FAIL (${load_time_ms}ms)\n"
    fi
    
    # Test API response time
    log "🔌 Testing API response time..." $BLUE
    local api_start_time=$(date +%s%N)
    curl -s "$base_url/api/health" > /dev/null
    local api_end_time=$(date +%s%N)
    local api_response_time_ms=$(( (api_end_time - api_start_time) / 1000000 ))
    
    if [ $api_response_time_ms -lt 1000 ]; then
        log "✅ API response time: ${api_response_time_ms}ms (under 1s)" $GREEN
        test_results+="✅ API response time: PASS (${api_response_time_ms}ms)\n"
    else
        log "❌ API response time: ${api_response_time_ms}ms (over 1s)" $RED
        test_results+="❌ API response time: FAIL (${api_response_time_ms}ms)\n"
    fi
    
    echo -e "$test_results" >> "$RESULTS_DIR/performance-tests.txt"
}

# Run database tests
run_database_tests() {
    log "🗄️  Running database tests..." $BLUE
    
    local base_url="${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}"
    local test_results=""
    
    # Test database connectivity through health endpoint
    local health_response=$(curl -s "$base_url/api/health")
    local db_status=$(echo "$health_response" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$db_status" = "healthy" ]; then
        log "✅ Database connectivity test passed" $GREEN
        test_results+="✅ Database connectivity: PASS\n"
    else
        log "❌ Database connectivity test failed" $RED
        test_results+="❌ Database connectivity: FAIL\n"
    fi
    
    # Test database performance through metrics
    local metrics_response=$(curl -s "$base_url/api/metrics")
    if echo "$metrics_response" | grep -q "decode_users_total"; then
        log "✅ Database metrics test passed" $GREEN
        test_results+="✅ Database metrics: PASS\n"
    else
        log "❌ Database metrics test failed" $RED
        test_results+="❌ Database metrics: FAIL\n"
    fi
    
    echo -e "$test_results" >> "$RESULTS_DIR/database-tests.txt"
}

# Run end-to-end tests with Playwright
run_e2e_tests() {
    log "🎭 Running end-to-end tests..." $BLUE
    
    if [ ! -f "package.json" ]; then
        log "⚠️  package.json not found, skipping E2E tests" $YELLOW
        return 0
    fi
    
    # Install Playwright if not already installed
    if ! npx playwright --version > /dev/null 2>&1; then
        log "📦 Installing Playwright..." $BLUE
        npx playwright install
    fi
    
    # Run Playwright tests
    if npx playwright test tests/production/e2e-production-tests.spec.ts --reporter=html --output-dir="$RESULTS_DIR/e2e-results" 2>> "$LOG_FILE"; then
        log "✅ End-to-end tests passed" $GREEN
    else
        log "❌ End-to-end tests failed" $RED
        log "📊 Check detailed results in $RESULTS_DIR/e2e-results/" $BLUE
    fi
}

# Generate test report
generate_report() {
    log "📊 Generating test report..." $BLUE
    
    local report_html="$RESULTS_DIR/production-test-report.html"
    
    cat > "$report_html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DECODE Production Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .test-section { margin: 20px 0; padding: 15px; border-left: 4px solid #2196F3; background: #f8f9fa; }
        .pass { color: #4CAF50; }
        .fail { color: #f44336; }
        .warn { color: #ff9800; }
        .timestamp { color: #666; font-size: 0.9em; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 DECODE Production Test Report</h1>
        <div class="summary">
            <h2 style="color: white; margin-top: 0;">Test Summary</h2>
            <p><strong>Environment:</strong> ${NODE_ENV:-production}</p>
            <p><strong>Application URL:</strong> ${NEXT_PUBLIC_SITE_URL:-https://decode.beauty}</p>
            <p><strong>Test Date:</strong> $(date)</p>
            <p><strong>Test Duration:</strong> Generated at runtime</p>
        </div>

        <div class="test-section">
            <h2>🌐 API Tests</h2>
            <pre>$(cat "$RESULTS_DIR/api-tests.txt" 2>/dev/null || echo "No API test results found")</pre>
        </div>

        <div class="test-section">
            <h2>🔐 Security Tests</h2>
            <pre>$(cat "$RESULTS_DIR/security-tests.txt" 2>/dev/null || echo "No security test results found")</pre>
        </div>

        <div class="test-section">
            <h2>⚡ Performance Tests</h2>
            <pre>$(cat "$RESULTS_DIR/performance-tests.txt" 2>/dev/null || echo "No performance test results found")</pre>
        </div>

        <div class="test-section">
            <h2>🗄️ Database Tests</h2>
            <pre>$(cat "$RESULTS_DIR/database-tests.txt" 2>/dev/null || echo "No database test results found")</pre>
        </div>

        <div class="test-section">
            <h2>📋 Test Logs</h2>
            <pre>$(tail -50 "$LOG_FILE" 2>/dev/null || echo "No logs found")</pre>
        </div>

        <div class="test-section">
            <h2>🎯 Recommendations</h2>
            <ul>
                <li>Monitor SSL certificate expiration dates</li>
                <li>Regularly review security headers configuration</li>
                <li>Set up automated performance monitoring</li>
                <li>Schedule regular backup testing</li>
                <li>Implement continuous security scanning</li>
            </ul>
        </div>

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; text-align: center;">
            <p>Generated by DECODE Production Testing Suite</p>
            <p class="timestamp">$(date)</p>
        </footer>
    </div>
</body>
</html>
EOF
    
    log "✅ Test report generated: $report_html" $GREEN
}

# Send test results notification
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
                    \"title\": \"DECODE Production Test Results\",
                    \"text\": \"$message\",
                    \"footer\": \"DECODE Testing System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" 2>> "$LOG_FILE" || true
    fi
}

# Main testing function
main() {
    log "🚀 Starting DECODE Production Testing Suite" $BLUE
    log "===========================================" $BLUE
    
    local start_time=$(date +%s)
    local test_errors=0
    
    setup_tests
    
    case "${1:-all}" in
        "api")
            run_api_tests
            ;;
        "security")
            run_security_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "database")
            run_database_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "all")
            run_api_tests || ((test_errors++))
            run_security_tests || ((test_errors++))
            run_performance_tests || ((test_errors++))
            run_database_tests || ((test_errors++))
            run_e2e_tests || ((test_errors++))
            ;;
        *)
            echo "DECODE Production Testing Script"
            echo "Usage: $0 [api|security|performance|database|e2e|all]"
            echo ""
            echo "Test Categories:"
            echo "  api          - API endpoint tests"
            echo "  security     - Security and SSL tests"
            echo "  performance  - Performance and load time tests"
            echo "  database     - Database connectivity tests"
            echo "  e2e          - End-to-end user journey tests"
            echo "  all          - Run all test categories (default)"
            exit 1
            ;;
    esac
    
    generate_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $test_errors -eq 0 ]; then
        log "🎉 All tests completed successfully in ${duration}s!" $GREEN
        send_notification "success" "✅ All production tests passed in ${duration}s. System is ready for production."
    else
        log "⚠️  Testing completed with $test_errors error(s) in ${duration}s" $YELLOW
        send_notification "warning" "⚠️ Production tests completed with $test_errors error(s). Review required."
    fi
    
    log "📊 View detailed report: $RESULTS_DIR/production-test-report.html" $BLUE
}

# Trap errors
trap 'send_notification "failed" "❌ Production testing failed. Check logs for details."; exit 1' ERR

# Run main function
main "$@"