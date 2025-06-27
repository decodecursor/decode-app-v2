#!/bin/bash

# DECODE SSL Certificate Setup Script
# This script sets up SSL certificates for production deployment

set -e

# Configuration
DOMAIN="decode.beauty"
SSL_DIR="./ssl"
EMAIL="${ACME_EMAIL:-admin@decode.beauty}"

echo "🔐 Setting up SSL certificates for DECODE production deployment..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Function to check if running on a server with public IP
check_server_environment() {
    echo "🔍 Checking server environment..."
    
    # Check if we can reach the internet
    if ! curl -s --max-time 5 https://httpbin.org/ip > /dev/null; then
        echo "❌ No internet connection. SSL setup requires internet access."
        return 1
    fi
    
    # Check if domain resolves to this server
    DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
    SERVER_IP=$(curl -s --max-time 5 https://httpbin.org/ip | jq -r '.origin')
    
    if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
        echo "⚠️  Warning: Domain $DOMAIN resolves to $DOMAIN_IP but server IP is $SERVER_IP"
        echo "   This may cause Let's Encrypt validation to fail."
    fi
}

# Function to generate self-signed certificates for development/testing
generate_self_signed() {
    echo "🔧 Generating self-signed certificates for development..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/$DOMAIN.key" \
        -out "$SSL_DIR/$DOMAIN.crt" \
        -subj "/C=US/ST=CA/L=San Francisco/O=DECODE/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN"
    
    echo "✅ Self-signed certificates generated at $SSL_DIR/"
    echo "⚠️  Note: Self-signed certificates will show security warnings in browsers"
}

# Function to set up Let's Encrypt certificates
setup_letsencrypt() {
    echo "🌐 Setting up Let's Encrypt certificates..."
    
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot python3-certbot-nginx
        else
            echo "❌ Could not install certbot. Please install it manually."
            return 1
        fi
    fi
    
    # Stop nginx if running to free up port 80
    if systemctl is-active --quiet nginx; then
        echo "🛑 Stopping nginx temporarily for certificate generation..."
        sudo systemctl stop nginx
        RESTART_NGINX=true
    fi
    
    # Generate certificates using standalone mode
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    
    # Copy certificates to our SSL directory
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/$DOMAIN.crt"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/$DOMAIN.key"
    
    # Set proper permissions
    chmod 644 "$SSL_DIR/$DOMAIN.crt"
    chmod 600 "$SSL_DIR/$DOMAIN.key"
    
    # Restart nginx if we stopped it
    if [ "$RESTART_NGINX" = true ]; then
        echo "🔄 Restarting nginx..."
        sudo systemctl start nginx
    fi
    
    echo "✅ Let's Encrypt certificates installed successfully!"
}

# Function to set up certificate auto-renewal
setup_auto_renewal() {
    echo "🔄 Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > "./scripts/renew-ssl.sh" << 'EOF'
#!/bin/bash
# Auto-renewal script for DECODE SSL certificates

echo "🔄 Renewing SSL certificates..."

# Renew certificates
certbot renew --quiet

# Copy renewed certificates
if [ -f "/etc/letsencrypt/live/decode.beauty/fullchain.pem" ]; then
    cp "/etc/letsencrypt/live/decode.beauty/fullchain.pem" "./ssl/decode.beauty.crt"
    cp "/etc/letsencrypt/live/decode.beauty/privkey.pem" "./ssl/decode.beauty.key"
    
    # Reload nginx configuration
    docker-compose -f docker-compose.production.yml exec nginx nginx -s reload
    
    echo "✅ SSL certificates renewed and nginx reloaded"
else
    echo "❌ Certificate renewal failed"
    exit 1
fi
EOF

    chmod +x "./scripts/renew-ssl.sh"
    
    # Add to crontab for automatic renewal (runs twice daily)
    if ! crontab -l 2>/dev/null | grep -q "renew-ssl.sh"; then
        (crontab -l 2>/dev/null; echo "0 */12 * * * /path/to/decode-app/scripts/renew-ssl.sh >> /var/log/ssl-renewal.log 2>&1") | crontab -
        echo "✅ Auto-renewal scheduled in crontab"
    fi
}

# Function to validate SSL setup
validate_ssl() {
    echo "🔍 Validating SSL setup..."
    
    if [ ! -f "$SSL_DIR/$DOMAIN.crt" ] || [ ! -f "$SSL_DIR/$DOMAIN.key" ]; then
        echo "❌ SSL certificate files not found!"
        return 1
    fi
    
    # Check certificate validity
    if openssl x509 -in "$SSL_DIR/$DOMAIN.crt" -text -noout | grep -q "CN=$DOMAIN"; then
        echo "✅ SSL certificate is valid for $DOMAIN"
    else
        echo "⚠️  SSL certificate may not be properly configured"
    fi
    
    # Check certificate expiration
    EXPIRY=$(openssl x509 -in "$SSL_DIR/$DOMAIN.crt" -noout -enddate | cut -d= -f2)
    echo "📅 Certificate expires: $EXPIRY"
}

# Main execution
main() {
    echo "🚀 DECODE SSL Setup"
    echo "=================="
    
    # Parse command line arguments
    case "${1:-auto}" in
        "letsencrypt")
            check_server_environment
            setup_letsencrypt
            setup_auto_renewal
            ;;
        "self-signed")
            generate_self_signed
            ;;
        "auto")
            if check_server_environment; then
                echo "🌐 Server environment detected, using Let's Encrypt..."
                setup_letsencrypt
                setup_auto_renewal
            else
                echo "🔧 Development environment detected, using self-signed certificates..."
                generate_self_signed
            fi
            ;;
        "validate")
            validate_ssl
            ;;
        *)
            echo "Usage: $0 [letsencrypt|self-signed|auto|validate]"
            echo ""
            echo "Options:"
            echo "  letsencrypt  - Force Let's Encrypt certificate generation"
            echo "  self-signed  - Generate self-signed certificates"
            echo "  auto         - Automatically choose based on environment (default)"
            echo "  validate     - Validate existing SSL setup"
            exit 1
            ;;
    esac
    
    validate_ssl
    
    echo ""
    echo "🎉 SSL setup complete!"
    echo "📝 Next steps:"
    echo "   1. Update your DNS to point $DOMAIN to this server"
    echo "   2. Start the production environment: docker-compose -f docker-compose.production.yml up -d"
    echo "   3. Test HTTPS access: https://$DOMAIN"
}

# Run main function
main "$@"