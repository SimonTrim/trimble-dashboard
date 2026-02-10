/**
 * Vercel Serverless Function - Trimble Dashboard Backend
 * 
 * Version autonome pour Vercel (ne dépend pas de backend/server.js)
 * Last updated: 2026-02-10
 */

console.log('🔵 [Vercel v2.1] Starting serverless function...');
console.log('🔵 [Vercel] Timestamp:', new Date().toISOString());

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

console.log('✅ [Vercel] Dependencies loaded');

const app = express();

// Configuration (Staging ou Production selon env)
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';
const IS_STAGING = ENVIRONMENT === 'staging';

console.log('ℹ️ [Vercel] ENVIRONMENT:', ENVIRONMENT);
console.log('ℹ️ [Vercel] IS_STAGING:', IS_STAGING);
console.log('ℹ️ [Vercel] CLIENT_ID:', process.env.TRIMBLE_CLIENT_ID ? '✓ SET' : '✗ MISSING');
console.log('ℹ️ [Vercel] CLIENT_SECRET:', process.env.TRIMBLE_CLIENT_SECRET ? '✓ SET' : '✗ MISSING');
console.log('ℹ️ [Vercel] REDIRECT_URI:', process.env.TRIMBLE_REDIRECT_URI ? '✓ SET' : '✗ MISSING');

const TRIMBLE_AUTH_URL = IS_STAGING 
  ? 'https://stage.id.trimble.com/oauth/authorize'
  : 'https://id.trimble.com/oauth/authorize';

const TRIMBLE_TOKEN_URL = IS_STAGING
  ? 'https://stage.id.trimble.com/oauth/token'
  : 'https://id.trimble.com/oauth/token';

// Base URLs pour les différentes APIs Trimble Connect
const TRIMBLE_CORE_API = IS_STAGING ? {
  us: 'https://app.stage.connect.trimble.com/tc/api/2.0',
  europe: 'https://app21.stage.connect.trimble.com/tc/api/2.0',
  asia: 'https://app-asia.stage.connect.trimble.com/tc/api/2.0',
  australia: 'https://app-au.stage.connect.trimble.com/tc/api/2.0',
} : {
  us: 'https://app.connect.trimble.com/tc/api/2.0',
  europe: 'https://app21.connect.trimble.com/tc/api/2.0',
  asia: 'https://app-asia.connect.trimble.com/tc/api/2.0',
  australia: 'https://app-au.connect.trimble.com/tc/api/2.0',
};

// Stockage temporaire des tokens
const tokenStore = new Map();

// Configuration CORS
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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========================================
// ROUTES D'AUTHENTIFICATION OAuth2
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

  const authUrl = `${TRIMBLE_AUTH_URL}?${params.toString()}`;
  res.redirect(authUrl);
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
// MIDDLEWARE D'AUTHENTIFICATION
// ========================================

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const sessionId = req.headers['x-session-id'];

  // Mode Bearer Token (intégré)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    console.log('🔑 Using Bearer token authentication');
    req.accessToken = accessToken;
    req.region = 'europe';
    return next();
  }

  // Mode Session ID
  if (!sessionId) {
    return res.status(401).json({ error: 'Missing session ID or authorization header' });
  }

  const tokenData = tokenStore.get(`tokens_${sessionId}`);

  if (!tokenData) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Vérifier expiration
  const now = Date.now();
  const expiryWithMargin = tokenData.expiresAt - (5 * 60 * 1000);

  if (now >= expiryWithMargin) {
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
      return res.status(401).json({ error: 'Token refresh failed - Please re-authenticate' });
    }
  }

  req.accessToken = tokenData.accessToken;
  req.region = tokenData.region;
  next();
}

// ========================================
// API ROUTES (PROXY TRIMBLE CONNECT)
// ========================================

app.get('/api/projects/:projectId/files', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiUrl = `${TRIMBLE_CORE_API[req.region]}/projects/${projectId}/files`;
    
    console.log(`📡 Calling Trimble API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trimble API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Files API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:projectId/todos', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiUrl = `${TRIMBLE_CORE_API[req.region]}/projects/${projectId}/todos`;
    
    console.log(`📡 Calling Trimble API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trimble API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Todos API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:projectId/topics', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiUrl = `${TRIMBLE_CORE_API[req.region]}/projects/${projectId}/topics`;
    
    console.log(`📡 Calling Trimble API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trimble API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Topics API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:projectId/views', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiUrl = `${TRIMBLE_CORE_API[req.region]}/projects/${projectId}/views`;
    
    console.log(`📡 Calling Trimble API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trimble API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Views API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/status', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.session;
  
  if (!sessionId) {
    console.log('❌ /api/auth/status - No session ID provided');
    return res.json({ authenticated: false });
  }

  const tokenData = tokenStore.get(`tokens_${sessionId}`);
  const authenticated = !!tokenData && Date.now() < tokenData.expiresAt;

  if (authenticated && tokenData) {
    console.log(`✅ /api/auth/status - Session authenticated`);
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
    console.log(`❌ /api/auth/status - Session not authenticated`);
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
// ROUTES DE SANTÉ
// ========================================

app.get('/health', (req, res) => {
  console.log('✅ Health check called');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    activeSessions: tokenStore.size
  });
});

app.get('/', (req, res) => {
  console.log('✅ Root endpoint called');
  res.json({
    name: 'Trimble Dashboard Backend',
    version: '2.1.0',
    environment: ENVIRONMENT,
    deployed: new Date().toISOString(),
    endpoints: {
      auth: {
        login: '/auth/login',
        callback: '/callback',
        status: '/api/auth/status',
        logout: '/api/auth/logout'
      },
      api: {
        files: '/api/projects/:projectId/files',
        todos: '/api/projects/:projectId/todos',
        topics: '/api/projects/:projectId/topics',
        views: '/api/projects/:projectId/views'
      }
    }
  });
});

// ========================================
// UTILITAIRES
// ========================================

function generateRandomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

console.log('✅ [Vercel] Serverless function initialized successfully');

// Export pour Vercel
module.exports = app;
