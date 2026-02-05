# 🧪 Setup Mode STAGING - Guide Complet

## 📋 Pré-requis

- Compte Trimble actif
- Node.js installé (v14+)
- Accès à [Trimble Developer Portal](https://developer.trimble.com/)

---

## ÉTAPE 1 : Créer l'Application Trimble STAGING

### 1.1 - Accéder au Developer Portal

1. **Ouvre** : https://developer.trimble.com/
2. **Clique** "Sign In" (en haut à droite)
3. **Connecte-toi** avec ton compte Trimble (`simon_martin@trimble.com`)

### 1.2 - Créer une Nouvelle Application

1. **Clique** sur "My Apps" dans le menu
2. **Clique** sur "+ Create Application" ou "New Application"
3. **Remplis le formulaire** :

```
Application Name: Trimble Dashboard Backend - STAGING
Description: Backend OAuth2 proxy for Trimble Connect Dashboard Extension (Staging Environment)
Application Type: Web Application
```

### 1.3 - Configuration OAuth2

**Redirect URIs** (ajoute ces 2 URLs) :
```
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

**Scopes** (coche ces permissions) :
- ✅ `TCWEBNextgen` (OBLIGATOIRE - accès Trimble Connect)
- ✅ `openid` (si disponible)
- ✅ `read` (si disponible)
- ✅ `write` (si disponible)

### 1.4 - Récupérer les Credentials

Après avoir cliqué sur "Create", tu verras :

```
Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**⚠️ IMPORTANT :**
- **Copie immédiatement** ces 2 valeurs
- Le **Client Secret** ne sera affiché qu'**UNE SEULE FOIS**
- Si tu le perds, tu devras régénérer un nouveau secret

---

## ÉTAPE 2 : Configuration Backend Local

### 2.1 - Créer le fichier .env

Dans le dossier `backend/`, crée un fichier `.env` :

```bash
cd backend
copy .env.example .env
```

### 2.2 - Éditer .env avec tes credentials

Ouvre `backend/.env` et remplace :

```env
# ========================================
# ENVIRONMENT - MODE STAGING
# ========================================
ENVIRONMENT=staging

# ========================================
# TRIMBLE OAUTH CREDENTIALS - STAGING
# ========================================
TRIMBLE_CLIENT_ID=TON_CLIENT_ID_ICI
TRIMBLE_CLIENT_SECRET=TON_CLIENT_SECRET_ICI
TRIMBLE_REDIRECT_URI=http://localhost:3000/auth/callback

# ========================================
# APPLICATION SETTINGS
# ========================================
PORT=3000
NODE_ENV=development
FRONTEND_URL=https://simontrim.github.io
```

**Remplace uniquement** :
- `TON_CLIENT_ID_ICI` → Le Client ID que tu as copié
- `TON_CLIENT_SECRET_ICI` → Le Client Secret que tu as copié

### 2.3 - Vérifier le fichier

**Le fichier .env doit ressembler à** :
```env
ENVIRONMENT=staging
TRIMBLE_CLIENT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
TRIMBLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TRIMBLE_REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
NODE_ENV=development
FRONTEND_URL=https://simontrim.github.io
```

---

## ÉTAPE 3 : Démarrer le Backend

### 3.1 - Installer les dépendances (si pas déjà fait)

```bash
cd backend
npm install
```

### 3.2 - Démarrer le serveur

```bash
npm start
```

### 3.3 - Vérifier le démarrage

Tu devrais voir :

```
╔════════════════════════════════════════════════════════════╗
║  🧪 STAGING - Trimble Dashboard Backend                   ║
║                                                            ║
║  Port: 3000                                                 ║
║  Mode: STAGING                                              ║
║  Trimble API: app.stage.connect.trimble.com                ║
║                                                            ║
║  Auth URLs:                                                ║
║    - Auth: https://stage.id.trimble.com/oauth/authorize    ║
║    - Token: https://stage.id.trimble.com/oauth/token       ║
║                                                            ║
║  ✅ Server is ready!                                       ║
╚════════════════════════════════════════════════════════════╝
```

---

## ÉTAPE 4 : Tester l'Authentification

### 4.1 - Ouvrir le navigateur

**Ouvre** : http://localhost:3000/auth/login

### 4.2 - Flow OAuth Attendu

1. **Tu es redirigé** vers `https://stage.id.trimble.com/` (page de login Trimble Staging)
2. **Connecte-toi** avec ton compte Trimble
3. **Autorise** l'application (si demandé)
4. **Tu es redirigé** vers `https://simontrim.github.io/trimble-dashboard/?session=xxxxx&auth=success`

### 4.3 - Vérifier les logs serveur

Dans le terminal backend, tu devrais voir :
```
✅ Tokens OAuth obtenus avec succès
```

### 4.4 - Tester un endpoint API

**Dans le navigateur**, ouvre la console (F12) et tape :

```javascript
// Récupérer le sessionId depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

// Tester l'endpoint /api/projects/{projectId}/files
fetch('http://localhost:3000/api/projects/Cw3RYI17np8/files', {
  headers: {
    'X-Session-Id': sessionId
  }
})
.then(r => r.json())
.then(data => console.log('✅ Files:', data))
.catch(err => console.error('❌ Error:', err));
```

**Si ça fonctionne**, tu verras la liste des fichiers du projet dans la console !

---

## ÉTAPE 5 : Troubleshooting

### Erreur "Invalid client credentials"
- ✅ Vérifie que le Client ID et Secret sont corrects dans `.env`
- ✅ Vérifie qu'il n'y a pas d'espaces avant/après les valeurs

### Erreur "Redirect URI mismatch"
- ✅ Vérifie que `http://localhost:3000/auth/callback` est bien dans les Redirect URIs de l'app Trimble
- ✅ Vérifie que `TRIMBLE_REDIRECT_URI` dans `.env` correspond exactement

### Erreur "Invalid scope"
- ✅ Vérifie que le scope `TCWEBNextgen` est autorisé pour ton app

### Serveur ne démarre pas
- ✅ Vérifie que le port 3000 n'est pas déjà utilisé
- ✅ Vérifie que toutes les dépendances sont installées (`npm install`)

---

## 🎯 Checklist Avant de Continuer

- [ ] Application Trimble Staging créée
- [ ] Client ID et Secret copiés
- [ ] Fichier `.env` configuré
- [ ] Serveur backend démarre sans erreur
- [ ] Login OAuth fonctionne (redirection vers Trimble Staging)
- [ ] Callback reçu avec succès
- [ ] Test endpoint API retourne des données

---

## 🚀 Prochaine Étape : Déploiement Vercel

Une fois que tout fonctionne localement en Staging, on pourra déployer sur Vercel et mettre à jour l'extension pour utiliser le backend.
