// DECODE Production End-to-End Tests
// Comprehensive testing suite for production deployment validation

import { test, expect, Page } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://decode.beauty'
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@decode.beauty'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123'

test.describe('Production Deployment Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for production environment
    test.setTimeout(60000)
  })

  test('should load main application page', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Check page loads successfully
    await expect(page).toHaveTitle(/DECODE/)
    
    // Check essential elements are present
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    
    // Check for proper SSL certificate (no security warnings)
    const response = await page.goto(BASE_URL)
    expect(response?.status()).toBe(200)
  })

  test('should have proper SSL configuration', async ({ page }) => {
    const response = await page.goto(BASE_URL)
    
    // Check HTTPS redirect works
    const url = page.url()
    expect(url).toMatch(/^https:\/\//)
    
    // Check security headers are present
    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ]
    
    for (const header of securityHeaders) {
      expect(response?.headers()[header]).toBeDefined()
    }
  })

  test('should have working health check endpoint', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/api/health`)
    expect(response?.status()).toBe(200)
    
    const healthData = await response?.json()
    expect(healthData.status).toBe('healthy')
    expect(healthData.checks.database).toBe('healthy')
    expect(healthData.checks.application).toBe('healthy')
  })

  test('should complete user authentication flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`)
    
    // Fill in login form
    await page.fill('input[type="email"]', TEST_USER_EMAIL)
    await page.fill('input[type="password"]', TEST_USER_PASSWORD)
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })

  test('should create payment link successfully', async ({ page }) => {
    // Login first
    await loginUser(page)
    
    // Navigate to create payment page
    await page.goto(`${BASE_URL}/payment/create`)
    
    // Fill out payment form - Step 1: Basic Info
    await page.fill('input[name="title"]', 'Test Production Payment')
    await page.fill('textarea[name="description"]', 'Production testing payment link')
    await page.fill('input[name="amount"]', '25.00')
    
    // Go to next step
    await page.click('button:has-text("Next: Configure Splits")')
    
    // Step 2: Skip splits for now
    await page.click('button:has-text("Next: Review")')
    
    // Step 3: Create payment link
    await page.click('button:has-text("Create Payment Link")')
    
    // Wait for success message
    await expect(page.locator('text=Payment Link Created!')).toBeVisible({ timeout: 10000 })
    
    // Verify redirect to My Links
    await page.waitForURL('**/my-links', { timeout: 10000 })
  })

  test('should handle payment processing flow', async ({ page }) => {
    // This would test the actual payment flow with Crossmint
    // Note: In production, use test API keys and small amounts
    
    await loginUser(page)
    
    // Create a test payment link
    const paymentLink = await createTestPaymentLink(page)
    
    // Navigate to payment page as a customer
    await page.goto(paymentLink)
    
    // Verify payment page loads
    await expect(page.locator('h1')).toContainText('Test Production Payment')
    await expect(page.locator('text=$25.00')).toBeVisible()
    
    // Check Crossmint integration loads
    await expect(page.locator('[data-testid="crossmint-embed"]')).toBeVisible({ timeout: 15000 })
    
    // Note: Actual payment processing would require test card details
    // and should be done carefully in production testing
  })

  test('should validate split payment functionality', async ({ page }) => {
    await loginUser(page)
    
    // Navigate to create payment with splits
    await page.goto(`${BASE_URL}/payment/create`)
    
    // Create payment with split configuration
    await page.fill('input[name="title"]', 'Split Payment Test')
    await page.fill('input[name="amount"]', '100.00')
    await page.click('button:has-text("Next: Configure Splits")')
    
    // Add split recipient
    await page.click('button:has-text("Add Recipient")')
    await page.fill('input[placeholder="Email address"]', 'recipient@example.com')
    await page.fill('input[placeholder="Name"]', 'Test Recipient')
    await page.fill('input[placeholder="Percentage"]', '30')
    
    // Continue to review
    await page.click('button:has-text("Next: Review")')
    
    // Verify split is shown in review
    await expect(page.locator('text=Test Recipient')).toBeVisible()
    await expect(page.locator('text=30%')).toBeVisible()
    
    // Create payment link
    await page.click('button:has-text("Create Payment Link")')
    await expect(page.locator('text=Payment Link Created!')).toBeVisible()
  })

  test('should validate analytics dashboard', async ({ page }) => {
    await loginUser(page)
    
    // Navigate to analytics
    await page.goto(`${BASE_URL}/analytics`)
    
    // Check main metrics are displayed
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-transactions"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-rate"]')).toBeVisible()
    
    // Check charts load
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible({ timeout: 10000 })
    
    // Check split payment analytics if enabled
    if (await page.locator('text=Split Payment Analytics').isVisible()) {
      await expect(page.locator('[data-testid="split-analytics"]')).toBeVisible()
    }
  })

  test('should validate monitoring endpoints', async ({ page }) => {
    // Test metrics endpoint
    const metricsResponse = await page.goto(`${BASE_URL}/api/metrics`)
    expect(metricsResponse?.status()).toBe(200)
    
    const metricsText = await metricsResponse?.text()
    expect(metricsText).toContain('decode_app_uptime_seconds')
    expect(metricsText).toContain('decode_users_total')
    expect(metricsText).toContain('decode_transactions_total')
  })

  test('should validate error handling', async ({ page }) => {
    // Test 404 page
    await page.goto(`${BASE_URL}/nonexistent-page`)
    expect(page.url()).toMatch(/404|not-found/)
    
    // Test API error handling
    const apiResponse = await page.goto(`${BASE_URL}/api/nonexistent-endpoint`)
    expect(apiResponse?.status()).toBe(404)
  })

  test('should validate rate limiting', async ({ page }) => {
    // Make multiple rapid requests to test rate limiting
    const promises = Array.from({ length: 20 }, () => 
      page.goto(`${BASE_URL}/api/health`)
    )
    
    const responses = await Promise.all(promises)
    
    // Some requests should be rate limited (429 status)
    const rateLimitedResponses = responses.filter(response => response?.status() === 429)
    expect(rateLimitedResponses.length).toBeGreaterThan(0)
  })

  test('should validate database connectivity', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/api/health`)
    const healthData = await response?.json()
    
    expect(healthData.checks.database).toBe('healthy')
    expect(healthData.environment).toBe('production')
  })

  test('should validate mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto(BASE_URL)
    
    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible()
    
    // Test payment creation on mobile
    await loginUser(page)
    await page.goto(`${BASE_URL}/payment/create`)
    
    // Verify form is usable on mobile
    await expect(page.locator('input[name="title"]')).toBeVisible()
    await expect(page.locator('input[name="amount"]')).toBeVisible()
  })

  test('should validate performance metrics', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now()
    await page.goto(BASE_URL)
    const loadTime = Date.now() - startTime
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
    
    // Check for performance optimizations
    const response = await page.goto(BASE_URL)
    const cacheControl = response?.headers()['cache-control']
    expect(cacheControl).toBeDefined()
  })
})

// Helper functions
async function loginUser(page: Page) {
  await page.goto(`${BASE_URL}/auth`)
  await page.fill('input[type="email"]', TEST_USER_EMAIL)
  await page.fill('input[type="password"]', TEST_USER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
}

async function createTestPaymentLink(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/payment/create`)
  await page.fill('input[name="title"]', 'Test Production Payment')
  await page.fill('input[name="amount"]', '25.00')
  await page.click('button:has-text("Next: Configure Splits")')
  await page.click('button:has-text("Next: Review")')
  await page.click('button:has-text("Create Payment Link")')
  
  // Wait for success and extract payment link
  await page.waitForURL('**/my-links')
  
  // Get the first payment link from the list
  const linkElement = await page.locator('[data-testid="payment-link-url"]').first()
  return await linkElement.textContent() || ''
}