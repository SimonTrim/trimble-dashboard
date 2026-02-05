# 🔐 Trimble Dashboard Backend

Backend proxy sécurisé pour l'extension Trimble Connect Dashboard.

## 📋 Fonctionnalités

- ✅ OAuth2 avec Trimble Identity (Authorization Code flow)
- ✅ Gestion sécurisée des tokens (access + refresh)
- ✅ Proxy API vers Trimble Connect REST API
- ✅ Support multi-régions (US, Europe, Asia, Australia)
- ✅ Protection CORS et CSRF

## 🚀 Démarrage Local (Mode STAGING)

### 1. Créer une Application Trimble STAGING

1. Va sur [Trimble Developer Portal](https://developer.trimble.com/)
2. **Connecte-toi** avec ton compte Trimble
3. **Va dans** "My Apps" ou "Applications"
4. **Clique** sur "+ Create Application"
5. **Remplis** :
   - **Name** : `Trimble Dashboard Backend - STAGING`
   - **Description** : `Backend proxy for Trimble Connect Dashboard (Staging)`
   - **Application Type** : `Web Application`
   - **Redirect URIs** : 
     ```
     http://localhost:3000/auth/callback
     ```
   - **Scopes** : 
     - ✅ `TCWEBNextgen` (obligatoire)
     - ✅ `openid` (si disponible)
6. **Clique** "Create"
7. **Note le `Client ID` et `Client Secret`** (affichés après création)

### 2. Configuration

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env et remplir :
# - TRIMBLE_CLIENT_ID
# - TRIMBLE_CLIENT_SECRET
```

### 3. Installation et Démarrage

```bash
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000`

### 4. Tester l'Authentification

1. Ouvre `http://localhost:3000/auth/login` dans le navigateur
2. Connecte-toi avec ton compte Trimble
3. Tu seras redirigé vers l'extension avec un `sessionId`

## 🌐 Déploiement sur Vercel

### 1. Préparer le Projet

```bash
npm install -g vercel
vercel login
```

### 2. Configurer `vercel.json`

Créer `vercel.json` :

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "TRIMBLE_CLIENT_ID": "@trimble-client-id",
    "TRIMBLE_CLIENT_SECRET": "@trimble-client-secret",
    "TRIMBLE_REDIRECT_URI": "https://your-backend.vercel.app/auth/callback",
    "FRONTEND_URL": "https://simontrim.github.io",
    "NODE_ENV": "production"
  }
}
```

### 3. Ajouter les Secrets Vercel

```bash
vercel secrets add trimble-client-id "YOUR_CLIENT_ID"
vercel secrets add trimble-client-secret "YOUR_CLIENT_SECRET"
```

### 4. Déployer

```bash
vercel --prod
```

### 5. Mettre à Jour l'Application Trimble

Retourne sur Trimble Cloud Console et ajoute le redirect URI de production :
- `https://your-backend.vercel.app/auth/callback`

## 📡 Endpoints API

### Authentification

- `GET /auth/login` - Démarre le flow OAuth
- `GET /auth/callback` - Callback OAuth
- `GET /api/auth/status` - Vérifie le statut d'authentification
- `POST /api/auth/logout` - Déconnexion

### Trimble Connect API Proxy

Tous les endpoints nécessitent le header `X-Session-Id`.

- `GET /api/projects/:projectId/files` - Liste des fichiers
- `GET /api/projects/:projectId/todos` - Liste des todos
- `GET /api/projects/:projectId/topics` - Liste des BCF topics
- `GET /api/projects/:projectId/views` - Liste des vues

### Exemple d'Appel

```javascript
fetch('https://your-backend.vercel.app/api/projects/abc123/files', {
  headers: {
    'X-Session-Id': 'session_id_from_auth'
  }
})
```

## 🔒 Sécurité

- ✅ Client Secret **JAMAIS** exposé côté client
- ✅ Tokens stockés uniquement côté serveur
- ✅ Vérification CSRF avec `state` parameter
- ✅ Auto-refresh des tokens expirés
- ✅ CORS configuré pour l'extension uniquement

## 🐛 Troubleshooting

### Erreur "Invalid state"
- Le sessionId est manquant ou invalide
- Recommence le flow OAuth depuis `/auth/login`

### Erreur "Token expired"
- Le serveur tente automatiquement un refresh
- Si ça échoue, reconnecte-toi via `/auth/login`

### Erreur CORS
- Vérifie que `FRONTEND_URL` est correctement configuré
- Vérifie que l'extension appelle le bon backend URL

## 📝 Logs

Les logs incluent :
- Toutes les requêtes HTTP
- Succès/échecs d'authentification
- Rafraîchissements de tokens
- Erreurs API Trimble Connect

## 🔄 Workflow OAuth Complet

```
1. Extension → Backend /auth/login
2. Backend → Redirect vers Trimble Identity
3. User → Login sur Trimble
4. Trimble → Redirect vers Backend /auth/callback?code=...
5. Backend → Exchange code for tokens
6. Backend → Redirect vers Extension ?session=...
7. Extension → Stocke sessionId
8. Extension → Appelle API avec X-Session-Id header
```

## 📚 Documentation Trimble

- [OAuth2 Guide](https://developer.trimble.com/docs/authentication)
- [Core API](https://developer.trimble.com/docs/connect/core)
- [Topics API](https://developer.trimble.com/docs/connect/tools/api/topics/)
