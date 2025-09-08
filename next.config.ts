import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for production optimization
  experimental: {
    // Enable server actions for form handling
    serverActions: {
      allowedOrigins: ["localhost:3000", "app.welovedecode.com"],
    },
    // Optimize for production builds
    optimizePackageImports: ["@supabase/supabase-js", "date-fns", "recharts"],
  },

  // Output configuration for production deployment
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Security and CORS headers
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development'
    const isProduction = process.env.NODE_ENV === 'production'
    
    return [
      // Security headers for all routes
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Add CSP for additional security
          {
            key: 'Content-Security-Policy',
            value: isDevelopment 
              ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.crossmint.com;",
          },
        ],
      },
      // Enhanced CORS headers for API routes
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: isDevelopment 
              ? '*' // Allow all origins in development
              : 'https://app.welovedecode.com', // Specific origin in production
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Cookie, Accept, User-Agent, Referer, x-client-info',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
          // Additional headers for better compatibility
          {
            key: 'Vary',
            value: 'Origin, Accept-Encoding',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      // Special CORS handling for auth routes
      {
        source: '/api/auth/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: isDevelopment 
              ? '*'
              : 'https://app.welovedecode.com',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, Cookie, Accept',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '3600', // 1 hour for auth routes
          },
          // Firefox-specific headers
          {
            key: 'Set-Cookie',
            value: 'SameSite=Lax; Secure=' + (isProduction ? 'true' : 'false'),
          },
        ],
      },
    ];
  },

  // Rewrites for clean URLs and API routing
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
      {
        source: '/metrics',
        destination: '/api/metrics',
      },
    ];
  },

  // Redirects for URL consistency
  async redirects() {
    return [
      {
        source: '/pay/:path*',
        has: [
          {
            type: 'query',
            key: 'ref',
            value: '(?<ref>.*)',
          },
        ],
        destination: '/pay/:path*?ref=:ref',
        permanent: false,
      },
    ];
  },

  // Webpack configuration for production optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
            },
          },
        },
      };
    }

    // Handle SVG imports
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // TypeScript configuration
  typescript: {
    // Type checking is performed separately in CI/CD
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // ESLint is run separately in CI/CD
    ignoreDuringBuilds: true,
  },

  // Compression for production
  compress: true,

  // Power optimizations
  poweredByHeader: false,

  // Generate static files for improved performance
  generateEtags: true,

  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    // Hot reload optimizations for development
    webpack: (config: any) => {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
      return config;
    },
  }),

  // Production configuration
  ...(process.env.NODE_ENV === 'production' && {
    // Additional production settings
    trailingSlash: false,
    generateBuildId: async () => {
      // Use environment variable for build ID in production
      return process.env.BUILD_ID || `build-${Date.now()}`;
    },
  }),
};

export default nextConfig;
