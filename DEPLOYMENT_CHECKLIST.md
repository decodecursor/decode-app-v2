# Crossmint Headless Checkout Deployment Checklist

Complete deployment guide for the DECODE beauty marketplace platform with Crossmint integration.

## 🏗️ Pre-Deployment Requirements

### Environment Setup
- [ ] **Node.js 18+** installed on target environment
- [ ] **Supabase Database** configured and accessible
- [ ] **Crossmint Account** created (staging and production)
- [ ] **Domain/SSL** configured for production webhooks

### Required Environment Variables

#### Database Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Crossmint Configuration
```bash
CROSSMINT_API_KEY=your-crossmint-api-key
CROSSMINT_PROJECT_ID=your-crossmint-project-id
CROSSMINT_ENVIRONMENT=staging # or production
CROSSMINT_WEBHOOK_SECRET=your-webhook-secret
```

#### Application Configuration
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

## 📊 Database Migration Checklist

### 1. User Table Updates
- [ ] Add `wallet_address` VARCHAR field
- [ ] Add `crossmint_wallet_id` VARCHAR field  
- [ ] Add `wallet_created_at` TIMESTAMP field
- [ ] Create index on `wallet_address`

### 2. Payment Links Table Updates
- [ ] Add `original_amount_aed` DECIMAL(10,2) field
- [ ] Add `fee_amount_aed` DECIMAL(10,2) field
- [ ] Add `total_amount_aed` DECIMAL(10,2) field
- [ ] Update existing records with fee calculations

### 3. Wallet Transactions Table Creation
- [ ] Create `wallet_transactions` table
- [ ] Set up proper indexes (user_id, payment_link_id, status)
- [ ] Configure Row Level Security (RLS) policies
- [ ] Set up auto-expiration function for payment links

### Migration Script
```sql
-- Run the complete migration script
\i supabase-crossmint-migration.sql
```

## 🔧 API Configuration

### Authentication Setup
- [ ] Configure Supabase RLS policies
- [ ] Set up API rate limiting
- [ ] Configure CORS for production domain
- [ ] Set up webhook signature validation

### API Endpoint Testing
- [ ] Test `/api/wallet/create` with staging credentials
- [ ] Test `/api/wallet/balance` response format
- [ ] Test `/api/wallet/transactions` pagination
- [ ] Test `/api/payment/create-session` with Crossmint staging
- [ ] Test `/api/webhooks/crossmint` signature validation
- [ ] Test `/api/admin/transfers` access control

## 🎨 Frontend Configuration

### Component Verification
- [ ] Headless checkout component working
- [ ] Wallet dashboard displaying correctly
- [ ] Transaction history pagination functional
- [ ] Payment link creation with fee display
- [ ] Mobile responsiveness verified

### Performance Optimization
- [ ] Enable Next.js production build optimizations
- [ ] Configure CDN for static assets
- [ ] Set up error boundaries for components
- [ ] Implement loading states for all async operations

## 🧪 Testing Protocol

### Staging Environment Testing
1. [ ] **Wallet Creation Test**
   - Create new user account
   - Verify automatic wallet creation
   - Check wallet address storage

2. [ ] **Payment Link Creation Test**
   - Create payment link with fee calculation
   - Verify database storage of fee fields
   - Test link expiration (7 days)

3. [ ] **Headless Checkout Test**
   - Access payment link as customer
   - Test crypto selection (USDC, ETH, MATIC)
   - Verify fee breakdown display
   - Create checkout session

4. [ ] **Payment Flow Test** (Small Amount)
   - Complete payment via Crossmint staging
   - Verify webhook processing
   - Check transaction recording
   - Validate fee distribution

5. [ ] **Error Handling Test**
   - Test expired payment links
   - Test invalid webhook signatures
   - Test failed transfer scenarios

### Load Testing
- [ ] Test concurrent payment link creation
- [ ] Test multiple simultaneous checkouts
- [ ] Verify database performance under load

## 🔒 Security Verification

### API Security
- [ ] All sensitive endpoints require authentication
- [ ] Webhook signatures properly validated
- [ ] User input sanitization implemented
- [ ] SQL injection protection verified

### Data Protection
- [ ] Personal data encrypted in transit
- [ ] API keys stored securely
- [ ] Database access properly restricted
- [ ] Audit logging implemented

## 📈 Monitoring Setup

### Application Monitoring
- [ ] Set up error tracking (Sentry/similar)
- [ ] Configure performance monitoring
- [ ] Set up uptime monitoring
- [ ] Configure log aggregation

### Business Metrics
- [ ] Track payment success rates
- [ ] Monitor wallet creation metrics
- [ ] Track marketplace fee collection
- [ ] Monitor transfer success rates

### Alerts Configuration
- [ ] Failed payment alerts
- [ ] Webhook processing failures
- [ ] Database connection issues
- [ ] API rate limit breaches

## 🚀 Deployment Steps

### Pre-Deployment
1. [ ] Run complete test suite
2. [ ] Verify all environment variables
3. [ ] Test database migrations on staging
4. [ ] Backup production database

### Deployment Process
1. [ ] Deploy database migrations
2. [ ] Deploy API changes
3. [ ] Deploy frontend updates
4. [ ] Verify webhook endpoints accessible
5. [ ] Test critical user flows

### Post-Deployment
1. [ ] Monitor error rates for 24 hours
2. [ ] Verify payment processing working
3. [ ] Check wallet creation functionality
4. [ ] Monitor transaction recording

## 🔄 Rollback Plan

### Immediate Rollback Triggers
- Payment processing failure rate > 5%
- Wallet creation failure rate > 10%
- Database migration errors
- Critical security vulnerability discovered

### Rollback Procedure
1. [ ] Revert application deployment
2. [ ] Restore database from backup (if needed)
3. [ ] Update DNS/load balancer
4. [ ] Notify stakeholders
5. [ ] Document issues and lessons learned

## 📋 Go-Live Checklist

### Final Verification (Production)
- [ ] Create test payment link with real account
- [ ] Complete small test payment ($1 equivalent)
- [ ] Verify webhook processing in production
- [ ] Check wallet balance updates
- [ ] Verify admin transfer tools working

### Communication
- [ ] Notify beauty professionals of new features
- [ ] Update documentation for users
- [ ] Prepare customer support for questions
- [ ] Monitor initial user adoption

## 🎯 Success Criteria

### Technical Metrics
- Payment success rate > 95%
- API response times < 2 seconds
- Wallet creation success rate > 98%
- Zero data loss incidents

### Business Metrics
- Marketplace fee collection accuracy 100%
- Professional payout success rate > 95%
- Customer satisfaction with new checkout
- Reduced payment processing time

## 📞 Support Contacts

### Technical Support
- **Database Issues**: [Database Team]
- **API Problems**: [Backend Team]
- **Frontend Issues**: [Frontend Team]
- **Crossmint Integration**: [Crossmint Support]

### Emergency Contacts
- **On-Call Engineer**: [Contact Info]
- **Product Manager**: [Contact Info]
- **System Administrator**: [Contact Info]

---

## 📝 Deployment Log

### Staging Deployment
- **Date**: _________________
- **Version**: _______________
- **Deployed By**: ___________
- **Issues**: ________________

### Production Deployment
- **Date**: _________________
- **Version**: _______________
- **Deployed By**: ___________
- **Issues**: ________________

---

*This checklist ensures a smooth deployment of the Crossmint headless checkout integration for the DECODE beauty marketplace platform.*