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
    req.region = 'europe'; // Région par défaut, peut être modifiée selon besoin
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
 * Récupère les fichiers d'un projet via l'API v2.1 folders
 * 1. Récupère d'abord le projet pour obtenir le rootId
 * 2. Liste les items du dossier racine
 */
app.get('/api/projects/:projectId/files', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];
    
    // Étape 1: Récupérer le projet pour obtenir le rootId
    console.log(`📡 Step 1: Getting project info for ${projectId}`);
    const projectUrl = `${apiBase}/2.0/projects/${projectId}`;
    
    const projectResponse = await fetch(projectUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      console.error(`❌ Project API Error: ${projectResponse.status} - ${errorText}`);
      return res.status(projectResponse.status).json({ error: errorText });
    }

    const projectData = await projectResponse.json();
    const rootId = projectData.rootId;
    
    if (!rootId) {
      console.error('❌ No rootId found in project data');
      return res.status(500).json({ error: 'Project rootId not found' });
    }

    // Étape 2: Récupérer les items du dossier racine
    console.log(`📡 Step 2: Getting files from root folder ${rootId}`);
    const filesUrl = `${apiBase}/2.1/folders/${rootId}/items`;
    
    const filesResponse = await fetch(filesUrl, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!filesResponse.ok) {
      const errorText = await filesResponse.text();
      console.error(`❌ Files API Error: ${filesResponse.status} - ${errorText}`);
      return res.status(filesResponse.status).json({ error: errorText });
    }

    const data = await filesResponse.json();
    console.log(`✅ Retrieved ${data.length || 0} items from root folder`);
    res.json(data);
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
 * Récupère les BCF topics d'un projet via l'API BCF v2.1 (buildingSMART standard)
 * Note: BCF Topics utilise la spécification buildingSMART BCF API v2.1/v3.0
 */
app.get('/api/projects/:projectId/bcf/topics', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiBase = TRIMBLE_API_BASE[req.region];
    
    // BCF API standard: /bcf/2.1/projects/{projectId}/topics
    // Essayer différentes variantes connues
    const possibleEndpoints = [
      `${apiBase}/bcf/2.1/projects/${projectId}/topics`,
      `${apiBase}/2.0/projects/${projectId}/bcf/2.1/topics`,
      `${apiBase}/2.0/topics?projectId=${projectId}`,
    ];
    
    let lastError = null;
    
    for (const apiUrl of possibleEndpoints) {
      try {
        console.log(`📡 Trying BCF endpoint: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Retrieved ${data.length || 0} BCF topics from: ${apiUrl}`);
          return res.json(data);
        }
        
        lastError = await response.text();
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }
    
    // Si aucun endpoint ne fonctionne
    console.error(`❌ All BCF endpoints failed. Last error: ${lastError}`);
    return res.status(404).json({ 
      error: 'BCF Topics endpoint not found', 
      message: 'Tried multiple BCF API versions without success',
      details: lastError 
    });
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
    version: '5.0.0',
    environment: process.env.ENVIRONMENT || 'production',
    deployed: new Date().toISOString(),
    note: 'Using Trimble Connect Core API v2.0 and v2.1 (region-aware)',
    supportedRegions: ['us', 'europe', 'asia', 'australia'],
    endpoints: {
      auth: {
        login: '/auth/login',
        callback: '/callback',
        status: '/api/auth/status',
        logout: '/api/auth/logout'
      },
      api: {
        files: '/api/projects/:projectId/files (v2.1 folders/items)',
        todos: '/api/projects/:projectId/todos (v2.0)',
        topics: '/api/projects/:projectId/bcf/topics (v2.0)',
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
