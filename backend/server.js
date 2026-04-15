/**
 * Backend Proxy pour Trimble Dashboard Extension
 * 
 * Ce serveur gère :
 * - OAuth2 avec Trimble Identity (flow Authorization Code)
 * - Appels API sécurisés vers Trimble Connect REST API
 * - Gestion des tokens (access + refresh)
 */

// Sur Vercel, dotenv n'est pas nécessaire (variables d'env configurées dans dashboard)
try {
  require('dotenv').config();
} catch (e) {
  console.log('ℹ️ dotenv non trouvé (normal sur Vercel)');
}

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

console.log('🔵 [Backend] server.js is loading...');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration (Staging ou Production selon env)
const ENVIRONMENT = process.env.ENVIRONMENT || 'staging';
const IS_STAGING = ENVIRONMENT === 'staging';

console.log('✅ [Backend] Express app créée');
console.log('ℹ️ [Backend] ENVIRONMENT:', ENVIRONMENT);
console.log('ℹ️ [Backend] IS_STAGING:', IS_STAGING);
console.log('ℹ️ [Backend] TRIMBLE_CLIENT_ID:', process.env.TRIMBLE_CLIENT_ID ? '✓ défini' : '✗ MANQUANT');

const TRIMBLE_AUTH_URL = IS_STAGING 
  ? 'https://stage.id.trimble.com/oauth/authorize'
  : 'https://id.trimble.com/oauth/authorize';

const TRIMBLE_TOKEN_URL = IS_STAGING
  ? 'https://stage.id.trimble.com/oauth/token'
  : 'https://id.trimble.com/oauth/token';

// Base URLs pour les différentes APIs Trimble Connect
// NOTE: Files/Folders utilisent v2.1, autres endpoints utilisent v2.0
const TRIMBLE_API_BASE = IS_STAGING ? {
  us: 'https://app.stage.connect.trimble.com/tc/api',
  europe: 'https://app21.stage.connect.trimble.com/tc/api',
  asia: 'https://app-asia.stage.connect.trimble.com/tc/api',
  australia: 'https://app-au.stage.connect.trimble.com/tc/api',
} : {
  us: 'https://app.connect.trimble.com/tc/api',
  europe: 'https://app21.connect.trimble.com/tc/api',
  asia: 'https://app-asia.connect.trimble.com/tc/api',
  australia: 'https://app-au.connect.trimble.com/tc/api',
};

// Note: 
// - Projects, Todos, BCF, Views: v2.0
// - Files, Folders: v2.1

// Stockage temporaire des tokens (EN PRODUCTION: utiliser Redis/Database)
const tokenStore = new Map();

// Middleware
// Configuration CORS : accepter localhost (test) et GitHub Pages (production)
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3001',
  'http://localhost:5500', // Live Server VSCode
  'https://simontrim.github.io',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permettre les requêtes sans origin (accès direct, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // Vérifier si l'origin est dans la liste autorisée
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Rejeter les origins non autorisés
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

/**
 * GET /auth/login
 * Redirige vers la page de login Trimble Identity
 */
app.get('/auth/login', (req, res) => {
  const state = generateRandomState();
  const sessionId = req.query.session || generateRandomState();
  
  // Stocker le state pour vérification CSRF
  tokenStore.set(`state_${sessionId}`, state);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TRIMBLE_CLIENT_ID,
    redirect_uri: process.env.TRIMBLE_REDIRECT_URI,
    scope: 'openid SMA-tc-dashboard', // openid + nom de l'application pour accès API
    state: `${state}:${sessionId}`
  });

  const authUrl = `${TRIMBLE_AUTH_URL}?${params.toString()}`;
  res.redirect(authUrl);
});

/**
 * GET /callback
 * Reçoit le code d'autorisation de Trimble Identity
 */
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  // Vérifier le state CSRF
  const [stateValue, sessionId] = state.split(':');
  const storedState = tokenStore.get(`state_${sessionId}`);
  
  if (!storedState || storedState !== stateValue) {
    return res.status(403).send('Invalid state - Possible CSRF attack');
  }

  try {
    // Échanger le code contre un access token
    const tokens = await exchangeCodeForToken(code);
    
    // Stocker les tokens associés à la session
    tokenStore.set(`tokens_${sessionId}`, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      region: tokens.data_region || 'us'
    });

    // Nettoyer le state
    tokenStore.delete(`state_${sessionId}`);

    // Rediriger vers l'extension avec le sessionId
    const frontendUrl = process.env.FRONTEND_URL || 'https://simontrim.github.io';
    
    // Déterminer l'URL de redirection selon l'environnement
    let redirectUrl;
    if (frontendUrl.includes('localhost')) {
      // Mode local : rediriger vers index-local.html
      redirectUrl = `${frontendUrl}/index-local.html?session=${sessionId}&auth=success`;
    } else {
      // Mode production : rediriger vers GitHub Pages
      redirectUrl = `${frontendUrl}/trimble-dashboard/?session=${sessionId}&auth=success`;
    }
    
    console.log(`✅ OAuth success, redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ OAuth callback error:', error.message);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

/**
 * Échange le code d'autorisation contre un access token
 */
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Rafraîchit l'access token avec le refresh token
 */
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.TRIMBLE_CLIENT_ID,
    client_secret: process.env.TRIMBLE_CLIENT_SECRET
  });

  const response = await fetch(TRIMBLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
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
  // Supporter deux types d'authentification:
  // 1. Bearer token (mode intégré Trimble Connect) via header Authorization
  // 2. Session ID (mode standalone avec OAuth complet) via header x-session-id
  
  const authHeader = req.headers['authorization'];
  const sessionId = req.headers['x-session-id'];

  // ====== CAS 1: Bearer Token (Mode Intégré) ======
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7); // Retirer "Bearer "
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    console.log('🔑 Using Bearer token authentication (integrated mode)');
    
    // Attacher le token à la requête (pas de refresh possible en mode intégré)
    req.accessToken = accessToken;
    req.region = req.headers['x-project-region'] || 'europe';
    return next();
  }

  // ====== CAS 2: Session ID (Mode Standalone) ======
  if (!sessionId) {
    return res.status(401).json({ error: 'Missing session ID or authorization header' });
  }

  const tokenData = tokenStore.get(`tokens_${sessionId}`);

  if (!tokenData) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Vérifier si le token a expiré (avec marge de 5 minutes)
  const now = Date.now();
  const expiryWithMargin = tokenData.expiresAt - (5 * 60 * 1000);

  if (now >= expiryWithMargin) {
    // Token expiré - Tenter un refresh
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

  // Attacher le token et la région à la requête
  req.accessToken = tokenData.accessToken;
  req.region = tokenData.region;
  next();
}

// ========================================
// API ROUTES (PROXY TRIMBLE CONNECT)
// ========================================

/**
 * GET /api/projects/:projectId/files
 * Récupère les fichiers d'un projet via l'API Search v2.0
 * Endpoint: GET /tc/api/2.0/search?projectId={projectId}&query=*&type=FILE
 * Note: Utilise l'API Search avec filter type=FILE pour récupérer tous les fichiers
 */
app.get('/api/projects/:projectId/files', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];
    
    // Utiliser l'API Search pour récupérer tous les fichiers
    const apiUrl = `${apiBase}/2.0/search?projectId=${projectId}&query=*&type=FILE`;
    
    console.log(`📡 Calling Trimble Search API: ${apiUrl}`);
    
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
    
    // L'API Search retourne un objet avec une propriété "details" contenant les résultats
    const files = data.details || [];
    
    console.log(`✅ Retrieved ${files.length} files via Search API`);
    res.json(files);
  } catch (error) {
    console.error('❌ Files API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/todos
 * Récupère les todos d'un projet via l'API v2.0
 * Note: L'API Trimble utilise ?projectId= en query parameter, pas en path
 */
app.get('/api/projects/:projectId/todos', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];
    const apiUrl = `${apiBase}/2.0/todos?projectId=${projectId}`;
    
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
    console.log(`✅ Retrieved ${data.length || 0} todos`);
    res.json(data);
  } catch (error) {
    console.error('❌ Todos API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/bcf/topics
 * Récupère les BCF topics d'un projet via l'API BCF v2.1
 * Documentation: https://app.swaggerhub.com/apis/Trimble-Connect/topic/v2
 * Endpoint: GET /tc/api/bcf/2.1/projects/{projectId}/topics
 */
app.get('/api/projects/:projectId/bcf/topics', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];
    
    // Endpoint BCF API v2.1 avec préfixe /tc/api/
    const apiUrl = `${apiBase}/bcf/2.1/projects/${projectId}/topics`;
    
    console.log(`📡 Calling BCF Topics API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ BCF Topics API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.length || 0} BCF topics`);
    res.json(data);
  } catch (error) {
    console.error('❌ BCF Topics API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/views
 * Récupère les vues d'un projet via l'API v2.0
 * Note: Endpoint à vérifier - peut utiliser ?projectId= en query parameter
 */
app.get('/api/projects/:projectId/views', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];
    // Essayer d'abord avec query parameter (pattern des todos)
    const apiUrl = `${apiBase}/2.0/views?projectId=${projectId}`;
    
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
    console.log(`✅ Retrieved ${data.length || 0} views`);
    res.json(data);
  } catch (error) {
    console.error('❌ Views API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectId/views/:viewId/thumbnail
 * Récupère la vignette d'une vue via l'API v2.0
 *
 * Strategy:
 * 1. Fetch the view details and reuse the official `thumbnail` / `image` URLs
 * 2. Fallback to the documented `/views/{viewId}/image` endpoint
 * 3. Finally try the legacy `tc/app/files/thumb` representation URL pattern
 */
app.get('/api/projects/:projectId/views/:viewId/thumbnail', requireAuth, async (req, res) => {
  try {
    const { projectId, viewId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];

    const baseUrl = `${apiBase}/2.0`;
    const baseOrigin = apiBase.replace(/\/tc\/api$/, '');
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

    pushCandidate(`${baseUrl}/views/${viewId}/image`);
    pushCandidate(`${baseOrigin}/tc/app/files/thumb?id=${viewId}&fc=REPRESENTATION&projectId=${projectId}`);

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
          const buffer = await response.buffer();
          if (buffer.length > 0) {
            console.log(`✅ Thumbnail found for view ${viewId} (${buffer.length} bytes)`);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(buffer);
          }
        }
        console.log(`⚠️ Thumbnail ${thumbnailUrl}: ${response.status}`);
      } catch (e) {
        console.log(`⚠️ Thumbnail fetch error: ${e.message}`);
      }
    }

    return res.status(404).json({ error: 'Thumbnail not available' });
  } catch (error) {
    console.error('❌ Thumbnail API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/status
 * Vérifie le statut d'authentification
 */
app.get('/api/auth/status', (req, res) => {
  // Accepter le sessionId soit en header, soit en query parameter
  const sessionId = req.headers['x-session-id'] || req.query.session;
  
  if (!sessionId) {
    console.log('❌ /api/auth/status - No session ID provided');
    return res.json({ authenticated: false });
  }

  const tokenData = tokenStore.get(`tokens_${sessionId}`);
  const authenticated = !!tokenData && Date.now() < tokenData.expiresAt;

  if (authenticated && tokenData) {
    console.log(`✅ /api/auth/status - Session ${sessionId.substring(0, 8)}... authenticated`);
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
    console.log(`❌ /api/auth/status - Session ${sessionId.substring(0, 8)}... not authenticated or expired`);
    res.json({ 
      authenticated: false 
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion (supprime les tokens)
 */
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
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: tokenStore.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Trimble Dashboard Backend',
    version: '6.0.0',
    environment: process.env.ENVIRONMENT || 'production',
    deployed: new Date().toISOString(),
    note: 'Using Trimble Connect Search API v2.0 and BCF API v2.1',
    supportedRegions: ['us', 'europe', 'asia', 'australia'],
    endpoints: {
      auth: {
        login: '/auth/login',
        callback: '/callback',
        status: '/api/auth/status',
        logout: '/api/auth/logout'
      },
      api: {
        files: '/api/projects/:projectId/files (Search API with type=FILE)',
        todos: '/api/projects/:projectId/todos (v2.0)',
        topics: '/api/projects/:projectId/bcf/topics (BCF v2.1)',
        views: '/api/projects/:projectId/views (v2.0)'
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

// ========================================
// DÉMARRAGE DU SERVEUR
// ========================================

// Détecter si on est sur Vercel (serverless) ou en local
const isServerless = !!process.env.VERCEL;

if (!isServerless) {
  // Mode développement local : écouter sur un port
  app.listen(PORT, () => {
    const envLabel = IS_STAGING ? '🧪 STAGING' : '🚀 PRODUCTION';
    const apiUrl = IS_STAGING ? 'app.stage.connect.trimble.com' : 'app.connect.trimble.com';
    
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  ${envLabel} - Trimble Dashboard Backend                    ║
║                                                            ║
║  Port: ${PORT}                                              ║
║  Mode: ${ENVIRONMENT.toUpperCase()}                         ║
║  Node ENV: ${process.env.NODE_ENV || 'development'}        ║
║  Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}    ║
║  Trimble API: ${apiUrl}                                     ║
║                                                            ║
║  Auth URLs:                                                ║
║    - Auth: ${TRIMBLE_AUTH_URL}                              ║
║    - Token: ${TRIMBLE_TOKEN_URL}                            ║
║                                                            ║
║  Endpoints:                                                ║
║    - GET  /                   API info                     ║
║    - GET  /health             Health check                 ║
║    - GET  /auth/login         Start OAuth flow            ║
║    - GET  /auth/callback      OAuth callback              ║
║    - GET  /api/auth/status    Check auth status           ║
║    - GET  /api/projects/:id/files       (v2.1 folders)    ║
║    - GET  /api/projects/:id/todos       (v2.0)            ║
║    - GET  /api/projects/:id/bcf/topics  (v2.0)            ║
║    - GET  /api/projects/:id/views       (v2.0)            ║
║                                                            ║
║  ✅ Server is ready!                                       ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
} else {
  // Mode serverless (Vercel) : juste logger
  console.log('🚀 Serverless function ready on Vercel');
}

// Gestion des erreurs globales
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (!isServerless) {
    process.exit(1);
  }
});

// Export pour Vercel (serverless)
console.log('✅ [Backend] Exporting Express app for Vercel...');
module.exports = app;
console.log('✅ [Backend] Export complete!');
