/**
 * Vercel Serverless Function - Trimble Dashboard Backend
 * 
 * Version 5.2.0 - Fixed BCF Topics using correct openXX.connect.trimble.com servers
 * 
 * CORRECT Trimble Connect Core API v2.0 endpoints (from SDK source):
 *   - Todos:  GET /tc/api/2.0/todos?projectId={id}
 *   - Views:  GET /tc/api/2.0/views?projectId={id}
 *   - Files:  GET /tc/api/2.0/search?query=*&projectId={id}&type=FILE
 *   - Sync:   GET /tc/api/2.0/sync/{projectId}?excludeVersion=true
 *   
 * BCF Topics API (from Swagger: https://app.swaggerhub.com/apis/Trimble-Connect/topic/v2):
 *   - Servers: openXX.connect.trimble.com (NOT appXX!)
 *   - Endpoint: GET /bcf/3.0/projects/{id}/topics (or /bcf/2.1/...)
 *   
 * IMPORTANT: Todos, Views use QUERY parameters (?projectId=), NOT path params!
 * Files are accessed via Search API or folder navigation, not /projects/{id}/files
 */

console.log('🔵 [Vercel v5.2] Starting serverless function...');

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

// The env var is named TRIMBLE_REDIRECT_URL in this project, but earlier code
// read TRIMBLE_REDIRECT_URI. Accept either so the OAuth flow works regardless.
const REDIRECT_URI = process.env.TRIMBLE_REDIRECT_URI || process.env.TRIMBLE_REDIRECT_URL;

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

function mapWebRegion(regionCode) {
  const map = {
    us: 'northamerica',
    eu: 'europe',
    ap: 'asia',
    'ap-au': 'australia',
  };
  return map[regionCode] || 'europe';
}

function build2DViewerUrl(projectId, versionId, webRegion) {
  const params = new URLSearchParams({
    id: versionId,
    version: versionId,
    type: 'revisions',
    etag: versionId,
  });
  if (webRegion) params.set('region', webRegion);
  return `https://web.connect.trimble.com/projects/${encodeURIComponent(projectId)}/viewer/2D?${params.toString()}`;
}

/**
 * BCF Topics API hosts (from Swagger: Trimble-Connect/topic/v2)
 * These are DIFFERENT from the Core API hosts (appXX → openXX)
 * 
 * Core API:  https://app21.connect.trimble.com/tc/api/2.0/...
 * BCF API:   https://open21.connect.trimble.com/bcf/3.0/...
 */
const BCF_HOSTS = IS_STAGING ? {
  us: 'open11.stage.connect.trimble.com',
  eu: 'open21.stage.connect.trimble.com',
  ap: 'open31.stage.connect.trimble.com',
  'ap-au': 'open32.stage.connect.trimble.com',
} : {
  us: 'open11.connect.trimble.com',
  eu: 'open21.connect.trimble.com',
  ap: 'open31.connect.trimble.com',
  'ap-au': 'open32.connect.trimble.com',
};

/**
 * Get the BCF/Topic API base URL for a region
 * Uses the openXX.connect.trimble.com servers from the official Swagger docs
 * @param {string} region - Region code (us, eu, ap, ap-au)
 * @returns {string} Base URL like "https://open21.connect.trimble.com"
 */
function getBcfBaseUrl(region) {
  const host = BCF_HOSTS[region] || BCF_HOSTS['eu'];
  return `https://${host}`;
}

/**
 * Probe the BCF Topics API across regions with a given token.
 * Used both by the main endpoint and the OAuth diagnostic flow.
 * Returns { ok, url?, count?, attempts }.
 */
async function probeBcfTopics(projectId, region, accessToken) {
  const versionPaths = [
    (base) => `${base}/bcf/3.0/projects/${projectId}/topics`,
    (base) => `${base}/bcf/2.1/projects/${projectId}/topics`,
  ];
  const primaryHost = BCF_HOSTS[region] || BCF_HOSTS['eu'];
  const otherHosts = Object.entries(BCF_HOSTS)
    .filter(([r]) => r !== region)
    .map(([, h]) => h);
  const hosts = [primaryHost, ...otherHosts];

  const attempts = [];
  for (const host of hosts) {
    for (const build of versionPaths) {
      const url = build(`https://${host}`);
      let r = await trimbleFetch(url, accessToken);
      let tries = 0;
      while (!r.ok && r.status >= 500 && tries < 2) {
        tries++;
        await new Promise((resolve) => setTimeout(resolve, 500 * tries));
        r = await trimbleFetch(url, accessToken);
      }
      if (r.ok) {
        const topics = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        return { ok: true, url, count: topics.length, tcRequestId: r.tcRequestId || null, attempts };
      }
      attempts.push({ url, status: r.status, tcRequestId: r.tcRequestId || null, body: (r.error || '').substring(0, 300) });
    }
  }
  return { ok: false, attempts };
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
    redirect_uri: REDIRECT_URI,
    scope: 'openid SMA-tc-dashboard',
    state: `${state}:${sessionId}`
  });

  res.redirect(`${TRIMBLE_AUTH_URL}?${params.toString()}`);
});

/**
 * DIAGNOSTIC: Log in with the SMA-tc-dashboard app itself (which is subscribed
 * to the Topics API) and test BCF topics with THAT token. Open in a browser:
 *   https://trimble-dashboard.vercel.app/api/debug/bcf-login?projectId=Cw3RYI17np8
 * It redirects through Trimble login, then renders the raw Topics API result.
 */
app.get('/api/debug/bcf-login', (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) {
    return res.status(400).send('Missing ?projectId= query parameter');
  }
  // Optional ?scope= override to experiment with different OAuth scopes
  // (e.g. "openid tc"). Defaults to the app scope.
  const scope = req.query.scope || 'openid SMA-tc-dashboard';
  const state = generateRandomState();
  const sessionId = `bcftest_${projectId}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TRIMBLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state: `${state}:${sessionId}`,
  });
  res.redirect(`${TRIMBLE_AUTH_URL}?${params.toString()}`);
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  const [stateValue, sessionId] = state.split(':');
  const isBcfTest = sessionId && sessionId.startsWith('bcftest_');

  // The CSRF state check relies on the in-memory store surviving between the
  // login and callback requests. That is unreliable on stateless serverless
  // functions, so skip it for the one-off diagnostic flow (no CSRF concern).
  if (!isBcfTest) {
    const storedState = tokenStore.get(`state_${sessionId}`);
    if (!storedState || storedState !== stateValue) {
      return res.status(403).send('Invalid state - Possible CSRF attack');
    }
  }

  try {
    const tokens = await exchangeCodeForToken(code);

    // Diagnostic branch: test the Topics API with the app's own token.
    if (isBcfTest) {
      const projectId = sessionId.substring('bcftest_'.length);
      const token = tokens.access_token;
      const region = getRegionCode(tokens.data_region || 'europe');
      const claims = decodeJwtPayload(token) || {};
      const result = await probeBcfTopics(projectId, region, token);
      return res.json({
        test: 'bcf-with-app-token (SMA-tc-dashboard)',
        success: result.ok,
        projectId,
        resolvedRegion: region,
        dataRegion: tokens.data_region || null,
        tokenScopes: claims.scope || claims.scp || claims.scopes || null,
        tokenAudience: claims.aud || null,
        result,
      });
    }

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
    redirect_uri: REDIRECT_URI,
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
 * Decode (without verifying) the payload of a JWT access token.
 * Used only for diagnostics — to surface the granted `scope` / `aud` claims
 * so we can tell whether a 403 is caused by a missing API scope.
 * @returns {object|null} decoded claims or null if not decodable
 */
function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * Helper: Make an authenticated request to Trimble Connect API
 */
async function trimbleFetch(url, accessToken, options = {}) {
  console.log(`📡 Trimble API: GET ${url}`);
  
  const baseHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  };
  // Only send Content-Type when there is actually a request body. Sending it on
  // a bodyless GET can make some gateways return 500.
  if (options.body) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers || {}),
    }
  });

  // Trimble puts a correlation id in the response headers. Capture it so we can
  // give it to Trimble support to trace server-side errors (e.g. 500s).
  const tcRequestId =
    response.headers.get('tc-request-id') ||
    response.headers.get('x-tc-request-id') ||
    response.headers.get('tc-correlation-id') ||
    response.headers.get('x-request-id') ||
    response.headers.get('request-id') ||
    null;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Trimble API Error ${response.status} (tc-request-id: ${tcRequestId}): ${errorText.substring(0, 200)}`);
    return { ok: false, status: response.status, error: errorText, tcRequestId };
  }

  const data = await response.json();
  return { ok: true, data, tcRequestId };
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

    // Fetch project members to resolve user IDs to readable names
    let userMap = {};
    try {
      const membersUrl = `${baseUrl}/projects/${projectId}/users`;
      const membersResult = await trimbleFetch(membersUrl, req.accessToken);
      if (membersResult.ok) {
        const members = Array.isArray(membersResult.data) ? membersResult.data : (membersResult.data?.data || []);
        members.forEach(m => {
          const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.id;
          if (m.id) userMap[m.id] = name;
          if (m.uid) userMap[m.uid] = name;
          if (m.email) userMap[m.email] = name;
        });
        console.log(`👥 Built user map with ${Object.keys(userMap).length} entries`);
      }
    } catch (e) {
      console.log('⚠️ Could not fetch project members');
    }

    function resolveUser(field) {
      if (!field) return null;
      if (typeof field === 'object') {
        return field.name
          || [field.firstName, field.lastName].filter(Boolean).join(' ')
          || field.email
          || (field.id && userMap[field.id])
          || null;
      }
      if (userMap[field]) return userMap[field];
      return field;
    }

    function normalizeFilePath(value) {
      if (!value) return '/';
      if (typeof value === 'string') return value.replace(/\\/g, '/');
      if (Array.isArray(value)) {
        const segments = value
          .map((seg) => {
            if (typeof seg === 'string') return seg;
            if (seg && typeof seg === 'object') return seg.name || seg.label || seg.nm || '';
            return '';
          })
          .filter(Boolean);
        return segments.length ? `/${segments.join('/')}` : '/';
      }
      if (typeof value === 'object') {
        if (typeof value.path === 'string') return normalizeFilePath(value.path);
        if (typeof value.fullPath === 'string') return normalizeFilePath(value.fullPath);
        if (typeof value.name === 'string' && !value.path) return `/${value.name}`;
        if (Array.isArray(value.segments)) return normalizeFilePath(value.segments);
      }
      return '/';
    }

    // Normalize file objects from any API source into a consistent shape
    function normalizeFile(f, folderPath, parentId) {
      const name = f.name || f.nm || f.label || 'Unknown';
      return {
        id: f.id,
        name,
        size: f.size || f.sz || 0,
        type: f.type || 'FILE',
        parentId: parentId || f.parentId || null,
        path: folderPath || normalizeFilePath(f.parentPath || f.path),
        // Dates — use both long and short field names
        createdOn: f.createdOn || f.ct || null,
        modifiedOn: f.modifiedOn || f.mt || f.createdOn || f.ct || null,
        // Author — resolve via user map
        createdBy: resolveUser(f.createdBy) || resolveUser(f.modifiedBy) || 'Unknown',
        modifiedBy: resolveUser(f.modifiedBy) || resolveUser(f.createdBy) || 'Unknown',
      };
    }

    // ── Strategy 1: Search API (reliable, returns indexed files with metadata) ──
    const searchUrl = `${baseUrl}/search?query=*&projectId=${projectId}&type=FILE`;
    console.log(`📁 Strategy 1: Search API...`);
    let result = await trimbleFetch(searchUrl, req.accessToken);
    let searchFiles = [];

    if (result.ok) {
      let rawResults = [];
      if (Array.isArray(result.data)) rawResults = result.data;
      else if (result.data?.data) rawResults = result.data.data;
      else if (result.data?.items) rawResults = result.data.items;

      searchFiles = rawResults.map(item => {
        const details = item.details || {};
        const merged = { ...details };
        // Preserve top-level metadata (createdBy, modifiedBy, dates) from search wrapper
        if (item.createdBy) merged.createdBy = item.createdBy;
        if (item.modifiedBy) merged.modifiedBy = item.modifiedBy;
        if (item.createdOn) merged.createdOn = item.createdOn;
        if (item.modifiedOn) merged.modifiedOn = item.modifiedOn;
        if (item.ct) merged.ct = item.ct;
        if (item.mt) merged.mt = item.mt;
        return normalizeFile(merged);
      });

      console.log(`✅ Search API: ${searchFiles.length} files`);
      if (searchFiles.length > 0) {
        console.log(`📋 Sample: ${searchFiles[0].name} | by: ${searchFiles[0].createdBy} | mod: ${searchFiles[0].modifiedOn}`);
      }
    } else {
      console.log(`⚠️ Search API failed (${result.status})`);
    }

    // ── Strategy 2: Folder API to catch recently uploaded files not yet indexed ──
    // Always try this to complement Search results with fresh uploads
    let folderFiles = [];
    try {
      const projectUrl = `${baseUrl}/projects/${projectId}`;
      const projectResult = await trimbleFetch(projectUrl, req.accessToken);

      if (projectResult.ok && projectResult.data && projectResult.data.rootId) {
        const rootId = projectResult.data.rootId;
        console.log(`📁 Strategy 2: Folder API (root: ${rootId})...`);

        async function listAllFiles(folderId, depth, folderPath = '/') {
          if (depth > 8) return [];
          const url = `${baseUrl}/folders/${folderId}/items`;
          const r = await trimbleFetch(url, req.accessToken);
          if (!r.ok) return [];
          const items = Array.isArray(r.data) ? r.data : (r.data?.data || []);
          let files = items
            .filter(i => i.type === 'FILE')
            .map(i => normalizeFile(i, folderPath, folderId));
          const folders = items.filter(i => i.type === 'FOLDER');
          for (let i = 0; i < folders.length; i += 5) {
            const batch = folders.slice(i, i + 5);
            const results = await Promise.all(batch.map(f => {
              const childName = f.name || f.nm || f.label || '';
              const childPath = folderPath === '/'
                ? `/${childName}`
                : `${folderPath}/${childName}`;
              return listAllFiles(f.id, depth + 1, childPath);
            }));
            for (const sub of results) files = files.concat(sub);
          }
          return files;
        }
        folderFiles = await listAllFiles(rootId, 0);
        console.log(`✅ Folder API: ${folderFiles.length} files`);
      }
    } catch (e) {
      console.log(`⚠️ Folder API error: ${e.message}`);
    }

    // ── Merge results: use all unique files from both sources ──
    const fileMap = new Map();
    // Add search files first (they have good metadata)
    for (const f of searchFiles) { if (f.id) fileMap.set(f.id, f); }
    // Add/update with folder files (they include recent uploads)
    for (const f of folderFiles) {
      if (f.id && !fileMap.has(f.id)) {
        fileMap.set(f.id, f);
      } else if (f.id && fileMap.has(f.id)) {
        // Merge: prefer folder data for dates (more recent), search data for author if better
        const existing = fileMap.get(f.id);
        if (f.modifiedOn && (!existing.modifiedOn || new Date(f.modifiedOn) > new Date(existing.modifiedOn))) {
          existing.modifiedOn = f.modifiedOn;
        }
        if (f.createdBy && f.createdBy !== 'Unknown' && existing.createdBy === 'Unknown') {
          existing.createdBy = f.createdBy;
        }
        if (f.path && f.path !== '/' && (!existing.path || existing.path === '/')) {
          existing.path = f.path;
        }
        if (f.parentId && !existing.parentId) {
          existing.parentId = f.parentId;
        }
      }
    }
    const allFiles = Array.from(fileMap.values());
    console.log(`📊 Total unique files: ${allFiles.length} (search: ${searchFiles.length}, folder: ${folderFiles.length})`);

    if (allFiles.length > 0) {
      return res.json(allFiles);
    }

    console.error('❌ No files found from any source');
    return res.status(404).json({ error: 'No files found' });

  } catch (error) {
    console.error('❌ Files API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/files/:fileId/viewer-2d
 * Resolve the latest file version and return the Trimble Connect 2D viewer URL.
 */
app.get('/api/projects/:projectId/files/:fileId/viewer-2d', requireAuth, async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    const baseUrl = getBaseUrl(req.region);
    let versionId = fileId;

    const fileResult = await trimbleFetch(`${baseUrl}/files/${fileId}`, req.accessToken);
    if (fileResult.ok && fileResult.data) {
      versionId = fileResult.data.versionId || fileResult.data.id || versionId;
    }

    const versionsResult = await trimbleFetch(`${baseUrl}/files/${fileId}/versions`, req.accessToken);
    if (versionsResult.ok) {
      const versions = Array.isArray(versionsResult.data)
        ? versionsResult.data
        : (versionsResult.data?.data || versionsResult.data?.items || []);
      if (versions.length) {
        const sorted = [...versions].sort((a, b) => {
          const da = new Date(a.modifiedOn || a.createdOn || a.mt || a.ct || 0).getTime();
          const db = new Date(b.modifiedOn || b.createdOn || b.mt || b.ct || 0).getTime();
          return db - da;
        });
        versionId = sorted[0].id || sorted[0].versionId || versionId;
      }
    }

    const webRegion = mapWebRegion(req.region);
    const viewerUrl = build2DViewerUrl(projectId, versionId, webRegion);
    console.log(`🖼️ 2D viewer URL for file ${fileId}: ${viewerUrl}`);
    res.json({ viewerUrl, versionId, fileId, projectId });
  } catch (error) {
    console.error('❌ viewer-2d error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/bcf/topics
 * 
 * BCF Topics use a SEPARATE API on openXX.connect.trimble.com servers.
 * From Swagger (Trimble-Connect/topic/v2):
 *   - North America: https://open11.connect.trimble.com
 *   - Europe:        https://open21.connect.trimble.com
 *   - Asia-Pacific:  https://open31.connect.trimble.com
 *   - Australia:     https://open32.connect.trimble.com
 * 
 * Endpoint: GET /bcf/3.0/projects/{project_id}/topics
 * Fallback: GET /bcf/2.1/projects/{project_id}/topics
 */
app.get('/api/projects/:projectId/bcf/topics', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Version paths to try, in order of preference (newest first)
    const versionPaths = [
      (base) => `${base}/bcf/3.0/projects/${projectId}/topics`,
      (base) => `${base}/bcf/2.1/projects/${projectId}/topics`,
      (base) => `${base}/projects/${projectId}/topics`,
    ];

    // Host candidates: the project's resolved region first, then every other
    // region as a fallback. This rules out a region mismatch automatically —
    // a wrong region returns 404, so if every host returns 403 the cause is
    // an authorization/scope problem, not the URL.
    const primaryHost = BCF_HOSTS[req.region] || BCF_HOSTS['eu'];
    const otherHosts = Object.entries(BCF_HOSTS)
      .filter(([region]) => region !== req.region)
      .map(([, host]) => host);
    const hostCandidates = [primaryHost, ...otherHosts];

    console.log(`🔧 BCF: Region "${req.region}" → primary host: ${primaryHost}`);

    const attempts = [];
    let lastStatus = null;
    let lastError = null;
    // The most meaningful attempt is the versioned endpoint on the project's
    // home region (the first one we try). A 500/200 there is far more telling
    // than the 403/404 we get from the wrong regions or the invalid no-version
    // path, so we report that as the primary error.
    let primaryStatus = null;
    let primaryError = null;

    // Trimble classifies 5xx as retryable server-side errors. Retry the same
    // URL a couple of times with backoff before giving up on it.
    const fetchWithRetry = async (url) => {
      let r = await trimbleFetch(url, req.accessToken);
      let tries = 0;
      while (!r.ok && r.status >= 500 && tries < 2) {
        tries++;
        await new Promise((resolve) => setTimeout(resolve, 500 * tries));
        console.log(`🔁 BCF 5xx retry #${tries} for ${url}`);
        r = await trimbleFetch(url, req.accessToken);
      }
      return r;
    };

    for (const host of hostCandidates) {
      const base = `https://${host}`;
      for (const buildUrl of versionPaths) {
        const url = buildUrl(base);
        const result = await fetchWithRetry(url);

        if (result.ok) {
          const topics = Array.isArray(result.data) ? result.data : (result.data?.data || []);
          console.log(`✅ Retrieved ${topics.length} BCF topics via ${url} (tc-request-id: ${result.tcRequestId})`);
          // Expose the Trimble correlation id of the successful call so it can
          // be read from the browser DevTools (Network tab) and shared with support.
          if (result.tcRequestId) {
            res.set('X-TC-Request-Id', result.tcRequestId);
            res.set('Access-Control-Expose-Headers', 'X-TC-Request-Id');
          }
          return res.json(topics);
        }

        if (primaryStatus === null) {
          primaryStatus = result.status;
          primaryError = result.error;
        }
        lastStatus = result.status;
        lastError = result.error;
        attempts.push({
          url,
          status: result.status,
          tcRequestId: result.tcRequestId || null,
          body: (result.error || '').substring(0, 300),
        });
        console.log(`⚠️ BCF failed (${result.status}) at ${url}: ${(result.error || '').substring(0, 200)}`);

        // 404 means "wrong host/version" → keep trying other versions/hosts.
        // 403 on the primary host means the token is rejected by the BCF
        // service; trying other hosts confirms it's not a region issue.
      }
    }

    // Everything failed — decode the token to expose the granted scopes so we
    // can tell whether the 403 is a missing-scope problem.
    const claims = decodeJwtPayload(req.accessToken) || {};
    const tokenScopes = claims.scope || claims.scp || claims.scopes || null;
    const tokenAud = claims.aud || null;

    const reportStatus = primaryStatus || lastStatus || 500;
    const reportError = primaryError || lastError || 'Failed to fetch BCF topics';

    console.error(`❌ All BCF topic attempts failed for project ${projectId}`);
    console.error(`   Resolved region: ${req.region}`);
    console.error(`   Primary (home-region) status: ${primaryStatus}`);
    console.error(`   Token scopes: ${JSON.stringify(tokenScopes)}`);
    console.error(`   Token audience: ${JSON.stringify(tokenAud)}`);
    console.error(`   Attempts: ${JSON.stringify(attempts)}`);

    let hint;
    if (reportStatus >= 500) {
      hint = 'The Topics service returned a 5xx error on the project\'s home region. The request passed authentication but the BCF service failed — check the captured response body below for the real reason (often a missing/invalid scope on the token or a project not provisioned for Topics).';
    } else if (reportStatus === 403) {
      hint = 'The Topics service rejected the token (403). The token is accepted by the Core API but not by the Topics/BCF service — likely a missing Topics scope on the token actually presented.';
    } else {
      hint = 'BCF topics could not be retrieved. Inspect the per-attempt response bodies below.';
    }

    return res.status(reportStatus).json({
      error: reportError,
      diagnostics: {
        region: req.region,
        primaryHost,
        primaryStatus,
        attempts,
        tokenScopes,
        tokenAudience: tokenAud,
        hint,
      },
    });

  } catch (error) {
    console.error('❌ BCF Topics API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/views/:viewId/thumbnail
 * Proxy for view thumbnails (requires auth, so we proxy through backend)
 *
 * Strategy:
 * 1. Fetch the view details and reuse the official `thumbnail` / `image` URLs
 * 2. Fallback to the documented `/views/{viewId}/image` endpoint
 * 3. Finally try the legacy `tc/app/files/thumb` representation URL pattern
 */
app.get('/api/projects/:projectId/views/:viewId/thumbnail', requireAuth, async (req, res) => {
  try {
    const { projectId, viewId } = req.params;
    const baseUrl = getBaseUrl(req.region);

    const baseOrigin = baseUrl.replace(/\/tc\/api\/2\.0$/, '');
    const normalizeAssetUrl = (value) => {
      if (!value || typeof value !== 'string') return null;
      if (value.startsWith('http://') || value.startsWith('https://')) return value;
      if (value.startsWith('/')) return `${baseOrigin}${value}`;
      return `${baseUrl}/${value.replace(/^\/+/, '')}`;
    };

    const candidateUrls = [];
    const pushCandidate = (value) => {
      const normalized = normalizeAssetUrl(value);
      if (normalized && !candidateUrls.includes(normalized)) {
        candidateUrls.push(normalized);
      }
    };

    // Step 1: fetch the view details using the documented endpoint
    const viewDetailUrls = [
      `${baseUrl}/views/${viewId}`,
      `${baseUrl}/views/${viewId}?projectId=${projectId}`,
    ];

    for (const viewUrl of viewDetailUrls) {
      console.log(`🖼️ Fetching view details: ${viewUrl}`);
      try {
        const viewResp = await fetch(viewUrl, {
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'Accept': 'application/json',
          }
        });

        if (!viewResp.ok) {
          console.log(`⚠️ View details response (${viewUrl}): ${viewResp.status}`);
          continue;
        }

        const viewData = await viewResp.json();
        console.log(`📋 View ${viewId}: thumbnail=${viewData.thumbnail || null}, image=${viewData.image || null}`);
        pushCandidate(viewData.thumbnail);
        pushCandidate(viewData.thumbnailUrl);
        pushCandidate(viewData.image);
        break;
      } catch (e) {
        console.log(`⚠️ View details fetch error (${viewUrl}): ${e.message}`);
      }
    }

    // Step 2: try the documented image endpoint, then the legacy representation URL
    pushCandidate(`${baseUrl}/views/${viewId}/image`);
    pushCandidate(`${baseOrigin}/tc/app/files/thumb?id=${viewId}&fc=REPRESENTATION&projectId=${projectId}`);

    // Step 3: Try each URL until one works
    for (const thumbnailUrl of candidateUrls) {
      console.log(`🖼️ Trying thumbnail: ${thumbnailUrl}`);

      try {
        const response = await fetch(thumbnailUrl, {
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'Accept': 'image/png, image/jpeg, image/webp, image/*, */*',
          }
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/png';
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          if (buffer.length > 0) {
            console.log(`✅ Thumbnail found for view ${viewId} (${buffer.length} bytes)`);
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=3600');
            return res.send(buffer);
          }
        }
        console.log(`⚠️ Thumbnail ${thumbnailUrl}: ${response.status}`);
      } catch (e) {
        console.log(`⚠️ Thumbnail fetch error: ${e.message}`);
      }
    }

    return res.status(404).send('Thumbnail not found');
  } catch (error) {
    console.error('❌ Thumbnail error:', error.message);
    res.status(500).send('Failed to fetch thumbnail');
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
    version: '5.10.0',
    environment: ENVIRONMENT,
    activeSessions: tokenStore.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Trimble Dashboard Backend',
    version: '5.10.0',
    environment: ENVIRONMENT,
    deployed: new Date().toISOString(),
    note: 'BCF topics: multi-region fallback + scope diagnostics on 403',
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
        topics: '/api/projects/:projectId/bcf/topics → GET https://openXX.connect.trimble.com/bcf/3.0/projects/{id}/topics'
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

console.log('✅ [Vercel v5.2] Serverless function initialized');

module.exports = app;
