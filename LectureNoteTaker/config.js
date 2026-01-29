// config.js - Configuration for Bevo Notes Chrome extension
//
// DEPLOYMENT INSTRUCTIONS:
// Before publishing to Chrome Web Store, change BACKEND_URL to your production URL.
//
// Development: 'http://localhost:3000'
// Production:  'https://your-app.vercel.app' (or your custom domain)

const CONFIG = {
  // Toggle this for development vs production
  IS_PRODUCTION: false,

  // Backend URLs
  DEV_URL: 'http://localhost:3000',
  PROD_URL: 'https://bevo-notes.vercel.app', // Update this with your actual production URL

  // Computed backend URL based on environment
  get BACKEND_URL() {
    return this.IS_PRODUCTION ? this.PROD_URL : this.DEV_URL;
  }
};

// Freeze to prevent accidental modification
Object.freeze(CONFIG);
