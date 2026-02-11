/**
 * Vercel Serverless Function - Trimble Dashboard Backend
 * 
 * Version 5.0.0 - Fixed API endpoints based on official trimble-connect-sdk
 * 
 * CORRECT Trimble Connect Core API v2.0 endpoints (from SDK source):
 *   - Todos:  GET /tc/api/2.0/todos?projectId={id}
 *   - Views:  GET /tc/api/2.0/views?projectId={id}
 *   - Files:  GET /tc/api/2.0/search?query=*&projectId={id}&type=FILE
 *   - Sync:   GET /tc/api/2.0/sync/{projectId}?excludeVersion=true
 *   - BCF:    GET /tc/api/bcf/2.1/projects/{id}/topics (separate API)
 *   
 * IMPORTANT: Todos, Views use QUERY parameters (?projectId=), NOT path params!
 * Files are accessed via Search API or folder navigation, not /projects/{id}/files
 */

console.log('🔵 [Vercel v5.0] Starting serverless function...');

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';
const IS_STAGING = ENVIRONMENT === 'staging';

console.log('ℹ️ [Vercel] ENVIRONMENT:', ENVIRONMENT);
console.log('ℹ️ [Vercel] CLIENT_ID:', process.env.TRIMBLE_CLIENT_ID ? '✓ SET' : '✗ MISSING');

// Auth URLs
const TRIMBLE_AUTH_URL = IS_STAGING 
  ? 'https://stage.id.trimble.com/oauth/authorize'
  : 'https://id.trimble.com/oauth/authorize';

const TRIMBLE_TOKEN_URL = IS_STAGING
  ? 'https://stage.id.trimble.com/oauth/token'
  : 'https://id.trimble.com/oauth/token';

/**
 * Regional base URLs for Trimble Connect Core API
 * Format: https://{host}/tc/api/2.0/{endpoint}
 * 
 * The SDK uses: CONNECT_API_PROTOCOL + origin + CONNECT_API_ROOT + path
 * Where CONNECT_API_ROOT = '/tc/api/2.0/'
 */
const REGIONAL_HOSTS = IS_STAGING ? {
  us: 'app.stage.connect.trimble.com',
  eu: 'app21.stage.connect.trimble.com',
  ap: 'app31.stage.connect.trimble.com',
  'ap-au': 'app32.stage.connect.trimble.com',
} : {
  us: 'app.connect.trimble.com',
  eu: 'app21.connect.trimble.com',
  ap: 'app31.connect.trimble.com',
  'ap-au': 'app32.connect.trimble.com',
};

/**
 * Get the base API URL for a region
 * @param {string} region - Region code (us, eu, ap, ap-au)
 * @returns {string} Base URL like "https://app21.connect.trimble.com/tc/api/2.0"
 */
function getBaseUrl(region) {
  const host = REGIONAL_HOSTS[region] || REGIONAL_HOSTS['eu'];
  return `https://${host}/tc/api/2.0`;
}

/**
 * Get the BCF API base URL for a region
 * @param {string} region - Region code
 * @returns {string} Base URL like "https://app21.connect.trimble.com/tc/api/bcf/2.1"
 */
function getBcfBaseUrl(region) {
  const host = REGIONAL_HOSTS[region] || REGIONAL_HOSTS['eu'];
  return `https://${host}/tc/api/bcf/2.1`;
}

// Token store
const tokenStore = new Map();

/**
 * Convert project location string to region code
 */
function getRegionCode(location) {
  const locationToRegion = {
    'northamerica': 'us',
    'northAmerica': 'us',
    'us': 'us',
    'europe': 'eu',
    'eu': 'eu',
    'asia': 'ap',
    'ap': 'ap',
    'australia': 'ap-au',
    'ap-au': 'ap-au',
  };
  
  const normalized = (location || 'europe').toLowerCase().trim();
  const regionCode = locationToRegion[normalized] || 'eu';
  console.log(`🌍 Location "${location}" → Region "${regionCode}"`);
  return regionCode;
}

// CORS configuration
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3001',
  'http://localhost:5500',
  'https://simontrim.github.io',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️ Origin rejected: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========================================
// AUTH ROUTES
// ========================================

app.get('/auth/login', (req, res) => {
  const state = generateRandomState();
  const sessionId = req.query.session || generateRandomState();
  
  tokenStore.set(`state_${sessionId}`, state);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TRIMBLE_CLIENT_ID,
    redirect_uri: process.env.TRIMBLE_REDIRECT_URI,
    scope: 'openid SMA-tc-dashboard',
    state: `${state}:${sessionId}`
  });

  res.redirect(`${TRIMBLE_AUTH_URL}?${params.toString()}`);
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  const [stateValue, sessionId] = state.split(':');
  const storedState = tokenStore.get(`state_${sessionId}`);
  
  if (!storedState || storedState !== stateValue) {
    return res.status(403).send('Invalid state - Possible CSRF attack');
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    
    tokenStore.set(`tokens_${sessionId}`, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      region: tokens.data_region || 'us'
    });

    tokenStore.delete(`state_${sessionId}`);

    const frontendUrl = process.env.FRONTEND_URL || 'https://simontrim.github.io';
    let redirectUrl;
    
    if (frontendUrl.includes('localhost')) {
      redirectUrl = `${frontendUrl}/index-local.html?session=${sessionId}&auth=success`;
    } else {
      redirectUrl = `${frontendUrl}/trimble-dashboard/?session=${sessionId}&auth=success`;
    }
    
    console.log(`✅ OAuth success, redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ OAuth callback error:', error.message);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: process.env.TRIMBLE_REDIRECT_URI,
    client_id: process.env.TRIMBLE_CLIENT_ID,
    client_secret: process.env.TRIMBLE_CLIENT_SECRET
  });

  const response = await fetch(TRIMBLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.TRIMBLE_CLIENT_ID,
    client_secret: process.env.TRIMBLE_CLIENT_SECRET
  });

  const response = await fetch(TRIMBLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ========================================
// AUTH MIDDLEWARE
// ========================================

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const sessionId = req.headers['x-session-id'];

  // Mode 1: Bearer Token (integrated mode - from Trimble Connect extension)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    console.log('🔑 Using Bearer token authentication');
    req.accessToken = accessToken;
    
    // Read region from X-Project-Region header sent by the frontend
    const projectLocation = req.headers['x-project-region'] || 'europe';
    req.region = getRegionCode(projectLocation);
    console.log(`📍 Region from header: "${projectLocation}" → "${req.region}"`);
    return next();
  }

  // Mode 2: Session ID (standalone mode with OAuth)
  if (!sessionId) {
    return res.status(401).json({ error: 'Missing session ID or authorization header' });
  }

  const tokenData = tokenStore.get(`tokens_${sessionId}`);

  if (!tokenData) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check token expiration (with 5min margin)
  if (Date.now() >= tokenData.expiresAt - (5 * 60 * 1000)) {
    try {
      console.log('🔄 Token expired - Refreshing...');
      const newTokens = await refreshAccessToken(tokenData.refreshToken);
      tokenData.accessToken = newTokens.access_token;
      tokenData.refreshToken = newTokens.refresh_token;
      tokenData.expiresAt = Date.now() + (newTokens.expires_in * 1000);
      tokenStore.set(`tokens_${sessionId}`, tokenData);
      console.log('✅ Token refreshed successfully');
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      return res.status(401).json({ error: 'Token refresh failed' });
    }
  }

  req.accessToken = tokenData.accessToken;
  req.region = tokenData.region || 'eu';
  next();
}

/**
 * Helper: Make an authenticated request to Trimble Connect API
 */
async function trimbleFetch(url, accessToken, options = {}) {
  console.log(`📡 Trimble API: GET ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Trimble API Error ${response.status}: ${errorText.substring(0, 200)}`);
    return { ok: false, status: response.status, error: errorText };
  }

  const data = await response.json();
  return { ok: true, data };
}

// ========================================
// API ROUTES (PROXY TO TRIMBLE CONNECT)
// ========================================

/**
 * GET /api/projects/:projectId/todos
 * 
 * Correct Trimble endpoint: GET /tc/api/2.0/todos?projectId={projectId}
 * (Uses QUERY parameter, NOT path parameter!)
 */
app.get('/api/projects/:projectId/todos', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const baseUrl = getBaseUrl(req.region);
    const apiUrl = `${baseUrl}/todos?projectId=${projectId}`;
    
    const result = await trimbleFetch(apiUrl, req.accessToken);
    
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const todos = Array.isArray(result.data) ? result.data : (result.data?.data || []);
    console.log(`✅ Retrieved ${todos.length} todos`);
    res.json(todos);
  } catch (error) {
    console.error('❌ Todos API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/views
 * 
 * Correct Trimble endpoint: GET /tc/api/2.0/views?projectId={projectId}
 * (Uses QUERY parameter, NOT path parameter!)
 */
app.get('/api/projects/:projectId/views', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const baseUrl = getBaseUrl(req.region);
    const apiUrl = `${baseUrl}/views?projectId=${projectId}`;
    
    const result = await trimbleFetch(apiUrl, req.accessToken);
    
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const views = Array.isArray(result.data) ? result.data : (result.data?.data || []);
    console.log(`✅ Retrieved ${views.length} views`);
    res.json(views);
  } catch (error) {
    console.error('❌ Views API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/files
 * 
 * Strategy: Use the Search API to find all files in the project
 * Correct Trimble endpoint: GET /tc/api/2.0/search?query=*&projectId={projectId}&type=FILE
 * 
 * Fallback: Use sync endpoint to get the file system structure
 * GET /tc/api/2.0/sync/{projectId}?excludeVersion=true
 */
app.get('/api/projects/:projectId/files', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const baseUrl = getBaseUrl(req.region);
    
    // Strategy 1: Try Search API
    const searchUrl = `${baseUrl}/search?query=*&projectId=${projectId}&type=FILE`;
    console.log(`📁 Trying Search API for files...`);
    
    let result = await trimbleFetch(searchUrl, req.accessToken);
    
    if (result.ok) {
      // Search API returns results in different formats
      let files = [];
      if (Array.isArray(result.data)) {
        files = result.data;
      } else if (result.data?.details) {
        files = result.data.details;
      } else if (result.data?.data) {
        files = result.data.data;
      } else if (result.data?.items) {
        files = result.data.items;
      }
      console.log(`✅ Retrieved ${files.length} files via Search API`);
      return res.json(files);
    }
    
    console.log(`⚠️ Search API failed (${result.status}), trying Sync API...`);
    
    // Strategy 2: Fallback to Sync API (returns file system structure)
    const syncUrl = `${baseUrl}/sync/${projectId}?excludeVersion=true`;
    result = await trimbleFetch(syncUrl, req.accessToken);
    
    if (result.ok) {
      // Sync returns all items (files + folders), filter to files only
      let items = Array.isArray(result.data) ? result.data : (result.data?.data || []);
      const files = items.filter(item => item.type === 'FILE');
      console.log(`✅ Retrieved ${files.length} files via Sync API (from ${items.length} items)`);
      return res.json(files);
    }
    
    console.log(`⚠️ Sync API also failed (${result.status})`);
    
    // Strategy 3: Try getting root folder and listing its items
    const projectUrl = `${baseUrl}/projects/${projectId}`;
    const projectResult = await trimbleFetch(projectUrl, req.accessToken);
    
    if (projectResult.ok && projectResult.data) {
      const rootId = projectResult.data.rootId;
      if (rootId) {
        const folderUrl = `${baseUrl}/folders/${rootId}/items`;
        const folderResult = await trimbleFetch(folderUrl, req.accessToken);
        
        if (folderResult.ok) {
          let items = Array.isArray(folderResult.data) ? folderResult.data : (folderResult.data?.data || []);
          const files = items.filter(item => item.type === 'FILE');
          console.log(`✅ Retrieved ${files.length} files via Folder API`);
          return res.json(files);
        }
      }
    }
    
    // All strategies failed
    console.error('❌ All file fetching strategies failed');
    return res.status(result.status || 500).json({ error: result.error || 'Failed to fetch files' });
    
  } catch (error) {
    console.error('❌ Files API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/bcf/topics
 * 
 * BCF Topics use a separate API:
 * Correct Trimble endpoint: GET /tc/api/bcf/2.1/projects/{projectId}/topics
 */
app.get('/api/projects/:projectId/bcf/topics', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const bcfBaseUrl = getBcfBaseUrl(req.region);
    const apiUrl = `${bcfBaseUrl}/projects/${projectId}/topics`;
    
    const result = await trimbleFetch(apiUrl, req.accessToken);
    
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const topics = Array.isArray(result.data) ? result.data : (result.data?.data || []);
    console.log(`✅ Retrieved ${topics.length} BCF topics`);
    res.json(topics);
  } catch (error) {
    console.error('❌ BCF Topics API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId
 * Get project info
 */
app.get('/api/projects/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const baseUrl = getBaseUrl(req.region);
    const apiUrl = `${baseUrl}/projects/${projectId}`;
    
    const result = await trimbleFetch(apiUrl, req.accessToken);
    
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('❌ Project API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// AUTH STATUS ROUTES
// ========================================

app.get('/api/auth/status', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.session;
  
  if (!sessionId) {
    return res.json({ authenticated: false });
  }

  const tokenData = tokenStore.get(`tokens_${sessionId}`);
  const authenticated = !!tokenData && Date.now() < tokenData.expiresAt;

  if (authenticated && tokenData) {
    res.json({ 
      authenticated: true,
      tokens: {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt,
        region: tokenData.region
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    tokenStore.delete(`tokens_${sessionId}`);
  }
  res.json({ success: true });
});

// ========================================
// HEALTH / INFO ROUTES
// ========================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '5.0.0',
    environment: ENVIRONMENT,
    activeSessions: tokenStore.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Trimble Dashboard Backend',
    version: '5.0.0',
    environment: ENVIRONMENT,
    deployed: new Date().toISOString(),
    note: 'Fixed API endpoints based on official trimble-connect-sdk patterns',
    supportedRegions: Object.keys(REGIONAL_HOSTS),
    endpoints: {
      auth: {
        login: '/auth/login',
        callback: '/callback',
        status: '/api/auth/status'
      },
      api: {
        project: '/api/projects/:projectId → GET /tc/api/2.0/projects/{id}',
        todos: '/api/projects/:projectId/todos → GET /tc/api/2.0/todos?projectId={id}',
        views: '/api/projects/:projectId/views → GET /tc/api/2.0/views?projectId={id}',
        files: '/api/projects/:projectId/files → GET /tc/api/2.0/search?query=*&projectId={id}&type=FILE',
        topics: '/api/projects/:projectId/bcf/topics → GET /tc/api/bcf/2.1/projects/{id}/topics'
      }
    }
  });
});

// ========================================
// UTILITIES
// ========================================

function generateRandomState() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

console.log('✅ [Vercel v5.0] Serverless function initialized');

module.exports = app;
