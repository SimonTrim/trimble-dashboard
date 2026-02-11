/**
 * Vercel Serverless Function - Trimble Dashboard Backend
 * 
 * Version 5.1.0 - Fixed file names + BCF topics dynamic URL discovery
 * 
 * CORRECT Trimble Connect Core API v2.0 endpoints (from SDK source):
 *   - Todos:  GET /tc/api/2.0/todos?projectId={id}
 *   - Views:  GET /tc/api/2.0/views?projectId={id}
 *   - Files:  GET /tc/api/2.0/search?query=*&projectId={id}&type=FILE
 *   - Sync:   GET /tc/api/2.0/sync/{projectId}?excludeVersion=true
 *   - BCF:    Dynamic URL from regions API 'topic-api' field
 *   
 * IMPORTANT: Todos, Views use QUERY parameters (?projectId=), NOT path params!
 * Files are accessed via Search API or folder navigation, not /projects/{id}/files
 * BCF Topics URL is discovered dynamically from GET /tc/api/2.0/regions
 */

console.log('🔵 [Vercel v5.1] Starting serverless function...');

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
 * Cache for regions data (topic-api URLs)
 * Structure: { data: [...], fetchedAt: timestamp }
 */
let regionsCache = null;
const REGIONS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch and cache the Trimble Connect regions data
 * This gives us the dynamic 'topic-api' URL for BCF
 */
async function getRegionsData(accessToken) {
  // Return cached data if fresh
  if (regionsCache && (Date.now() - regionsCache.fetchedAt) < REGIONS_CACHE_TTL) {
    return regionsCache.data;
  }

  // We need to use the master/US endpoint to fetch regions
  const regionsUrl = `https://${REGIONAL_HOSTS['us']}/tc/api/2.0/regions`;
  console.log(`🌍 Fetching regions data from: ${regionsUrl}`);

  const response = await fetch(regionsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch regions: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const regions = Array.isArray(data) ? data : (data?.data || data);
  
  console.log(`✅ Fetched ${regions.length} regions`);
  regions.forEach(r => {
    console.log(`   Region: ${r.location} | origin: ${r.origin} | topic-api: ${r['topic-api'] || 'N/A'}`);
  });
  
  regionsCache = { data: regions, fetchedAt: Date.now() };
  return regions;
}

/**
 * Get the BCF/Topic API base URL for a region by querying the regions endpoint
 * Falls back to constructed URL if regions fetch fails
 */
async function getBcfBaseUrl(region, accessToken) {
  try {
    const regions = await getRegionsData(accessToken);
    
    if (regions) {
      // Map our region codes to Trimble location names
      const regionToLocation = {
        'us': 'northAmerica',
        'eu': 'europe',
        'ap': 'asia',
        'ap-au': 'australia',
      };
      
      const location = regionToLocation[region] || 'europe';
      
      // Find matching server by location or origin
      const host = REGIONAL_HOSTS[region] || REGIONAL_HOSTS['eu'];
      const server = regions.find(s => 
        s.location === location || 
        s.origin === host ||
        s.origin === `${host}`
      );
      
      if (server && server['topic-api']) {
        const topicApiUrl = server['topic-api'];
        console.log(`🔗 BCF Topic API URL from regions: ${topicApiUrl}`);
        return topicApiUrl;
      }
      
      console.warn(`⚠️ No topic-api found for region ${region}, trying all servers...`);
      
      // Try to find any server with topic-api
      for (const s of regions) {
        if (s['topic-api']) {
          console.log(`🔗 Using topic-api from ${s.location}: ${s['topic-api']}`);
          return s['topic-api'];
        }
      }
    }
  } catch (error) {
    console.error(`❌ Failed to get BCF URL from regions: ${error.message}`);
  }
  
  // Fallback: construct URL (may not work, but better than nothing)
  const host = REGIONAL_HOSTS[region] || REGIONAL_HOSTS['eu'];
  return `https://${host}/tc/api/2.0`;
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
      // Search API returns results in format: [{type: "FILE", details: {id, name, ...}}, ...]
      // We need to unwrap the 'details' property to get the actual file objects
      let rawResults = [];
      if (Array.isArray(result.data)) {
        rawResults = result.data;
      } else if (result.data?.data) {
        rawResults = result.data.data;
      } else if (result.data?.items) {
        rawResults = result.data.items;
      }
      
      // Unwrap search results: extract 'details' if present
      const files = rawResults.map(item => {
        if (item.details) {
          // Search result format: {type, details: {id, name, size, ...}}
          return { ...item.details, _searchType: item.type };
        }
        // Already a flat file object
        return item;
      });
      
      console.log(`✅ Retrieved ${files.length} files via Search API`);
      if (files.length > 0) {
        console.log(`📋 Sample file: ${JSON.stringify(files[0]).substring(0, 300)}`);
      }
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
 * BCF Topics use a SEPARATE API whose URL is discovered from the regions endpoint.
 * The SDK gets the URL from the 'topic-api' field in the regions response.
 * 
 * Strategy:
 * 1. Get the topic-api URL from regions endpoint  
 * 2. Try: {topic-api}/bcf/2.1/projects/{id}/topics
 * 3. Fallback: {topic-api}/projects/{id}/topics
 * 4. Fallback: {base}/topics?projectId={id} (Core API pattern)
 */
app.get('/api/projects/:projectId/bcf/topics', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Strategy 1: Use dynamic topic-api URL from regions
    const topicApiBase = await getBcfBaseUrl(req.region, req.accessToken);
    console.log(`🔧 BCF: Using topic-api base: ${topicApiBase}`);
    
    // Try BCF 2.1 standard path
    const bcfUrl1 = `${topicApiBase}/bcf/2.1/projects/${projectId}/topics`;
    console.log(`🔧 BCF: Trying ${bcfUrl1}`);
    let result = await trimbleFetch(bcfUrl1, req.accessToken);
    
    if (result.ok) {
      const topics = Array.isArray(result.data) ? result.data : (result.data?.data || []);
      console.log(`✅ Retrieved ${topics.length} BCF topics via bcf/2.1 path`);
      return res.json(topics);
    }
    console.log(`⚠️ BCF path 1 failed (${result.status})`);
    
    // Try without /bcf/2.1/ prefix (some implementations)
    const bcfUrl2 = `${topicApiBase}/projects/${projectId}/topics`;
    console.log(`🔧 BCF: Trying ${bcfUrl2}`);
    result = await trimbleFetch(bcfUrl2, req.accessToken);
    
    if (result.ok) {
      const topics = Array.isArray(result.data) ? result.data : (result.data?.data || []);
      console.log(`✅ Retrieved ${topics.length} BCF topics via /projects path`);
      return res.json(topics);
    }
    console.log(`⚠️ BCF path 2 failed (${result.status})`);
    
    // Strategy 2: Try Core API pattern (topics as query param, like todos)
    const baseUrl = getBaseUrl(req.region);
    const bcfUrl3 = `${baseUrl}/topics?projectId=${projectId}`;
    console.log(`🔧 BCF: Trying Core API pattern: ${bcfUrl3}`);
    result = await trimbleFetch(bcfUrl3, req.accessToken);
    
    if (result.ok) {
      const topics = Array.isArray(result.data) ? result.data : (result.data?.data || []);
      console.log(`✅ Retrieved ${topics.length} BCF topics via Core API pattern`);
      return res.json(topics);
    }
    console.log(`⚠️ BCF path 3 failed (${result.status})`);
    
    // Strategy 3: Try regional host with bcf prefix
    const host = REGIONAL_HOSTS[req.region] || REGIONAL_HOSTS['eu'];
    const bcfUrl4 = `https://${host}/tc/api/2.0/bcf/2.1/projects/${projectId}/topics`;
    console.log(`🔧 BCF: Trying regional bcf: ${bcfUrl4}`);
    result = await trimbleFetch(bcfUrl4, req.accessToken);
    
    if (result.ok) {
      const topics = Array.isArray(result.data) ? result.data : (result.data?.data || []);
      console.log(`✅ Retrieved ${topics.length} BCF topics via regional bcf`);
      return res.json(topics);
    }
    console.log(`⚠️ BCF path 4 failed (${result.status})`);
    
    // All strategies failed
    console.error('❌ All BCF topic strategies failed');
    return res.status(result.status || 500).json({ error: result.error || 'Failed to fetch BCF topics' });
    
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
    version: '5.1.0',
    environment: ENVIRONMENT,
    activeSessions: tokenStore.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Trimble Dashboard Backend',
    version: '5.1.0',
    environment: ENVIRONMENT,
    deployed: new Date().toISOString(),
    note: 'Fixed file names + BCF topics dynamic URL discovery from regions API',
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
        topics: '/api/projects/:projectId/bcf/topics → Dynamic URL from regions topic-api'
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

console.log('✅ [Vercel v5.1] Serverless function initialized');

module.exports = app;
