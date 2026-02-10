# 🚀 Guide de Déploiement Vercel - Backend Trimble Dashboard

## ✅ Pré-requis

- ✅ Backend testé et fonctionnel en local
- ✅ Compte GitHub avec le repo `trimble-dashboard`
- ✅ Credentials Trimble (Client ID + Secret) en PRODUCTION

---

## 📝 Étape 1 : Créer un compte Vercel

### 1.1 Aller sur Vercel
👉 **https://vercel.com**

### 1.2 S'inscrire avec GitHub
- Clique sur **"Sign Up"**
- Choisis **"Continue with GitHub"**
- Autorise Vercel à accéder à ton compte GitHub

---

## 📦 Étape 2 : Importer le projet

### 2.1 Créer un nouveau projet
1. Sur le dashboard Vercel, clique sur **"Add New"** → **"Project"**
2. Sélectionne le repo **`trimble-dashboard`**
3. Clique sur **"Import"**

### 2.2 Configurer le projet

**Root Directory :** Clique sur **"Edit"** et sélectionne `backend/`

**Framework Preset :** Laisse sur **"Other"**

**Build Command :** Laisse vide (pas nécessaire)

**Output Directory :** Laisse vide

**Install Command :** Laisse par défaut (`npm install`)

---

## 🔐 Étape 3 : Configurer les variables d'environnement

### 3.1 Ajouter les variables

Dans la section **"Environment Variables"**, ajoute :

| Key | Value | Notes |
|-----|-------|-------|
| `ENVIRONMENT` | `production` | Mode production |
| `TRIMBLE_CLIENT_ID` | `d31f36bf-2db2-4975-b82b-e50b00aa3fff` | Ton Client ID |
| `TRIMBLE_CLIENT_SECRET` | `8b8144d01c22470b9c7b3c7fe9119368` | Ton Client Secret |
| `TRIMBLE_REDIRECT_URI` | `https://TON-BACKEND.vercel.app/callback` | ⚠️ À METTRE À JOUR après déploiement |
| `PORT` | `3000` | Port (optionnel) |
| `NODE_ENV` | `production` | Environnement Node.js |
| `FRONTEND_URL` | `https://simontrim.github.io` | URL frontend GitHub Pages |

⚠️ **IMPORTANT** : Pour `TRIMBLE_REDIRECT_URI`, tu dois d'abord déployer, récupérer l'URL Vercel, puis mettre à jour cette variable.

### 3.2 Processus en 2 temps

**Premier déploiement (temporaire)** :
- Utilise `TRIMBLE_REDIRECT_URI=http://localhost:3000/callback` pour le moment
- Déploie
- Récupère l'URL Vercel

**Mise à jour** :
- Reviens dans les settings Vercel
- Change `TRIMBLE_REDIRECT_URI` vers `https://ton-backend.vercel.app/callback`
- Redéploie

---

## 🚀 Étape 4 : Déployer

### 4.1 Lancer le déploiement
Clique sur **"Deploy"**

Vercel va :
1. ✅ Cloner le repo
2. ✅ Installer les dépendances (`npm install`)
3. ✅ Déployer le serveur Node.js
4. ✅ Te donner une URL de production

### 4.2 Attendre la fin
Le déploiement prend environ **1-2 minutes**.

Tu verras :
```
✓ Building...
✓ Deploying...
✓ Ready! ✨
```

### 4.3 Récupérer l'URL
Ton backend sera accessible sur :
```
https://trimble-dashboard-backend-xxx.vercel.app
```

**Note cette URL !** Tu en auras besoin pour la suite.

---

## 🔧 Étape 5 : Mettre à jour la configuration

### 5.1 Mettre à jour Vercel

1. Va dans **Settings** → **Environment Variables**
2. Modifie `TRIMBLE_REDIRECT_URI` :
   ```
   https://TON-BACKEND.vercel.app/callback
   ```
3. Clique sur **"Save"**
4. Va dans l'onglet **"Deployments"**
5. Clique sur **"Redeploy"** pour le dernier déploiement

### 5.2 Mettre à jour Trimble Console

1. Va sur **https://console.trimblecloud.com**
2. Ouvre ton application **`SMA-tc-dashboard`**
3. Va dans **"Grant Types"** → **"Callback and Logout URLs"**
4. Ajoute l'URL de callback Vercel :
   ```
   https://TON-BACKEND.vercel.app/callback
   ```
5. **Garde aussi** l'URL localhost pour les tests :
   ```
   http://localhost:3000/callback
   ```
6. Clique sur **"Save"**

---

## ✅ Étape 6 : Tester le backend déployé

### 6.1 Tester l'endpoint de santé

Ouvre dans ton navigateur :
```
https://TON-BACKEND.vercel.app/health
```

Tu devrais voir :
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T14:30:00.000Z"
}
```

### 6.2 Tester le flux OAuth

Ouvre dans ton navigateur :
```
https://TON-BACKEND.vercel.app/auth/login
```

Tu devrais être redirigé vers Trimble Identity pour te connecter.

---

## 🔍 Étape 7 : Vérifier les logs

### 7.1 Voir les logs en temps réel

1. Sur Vercel, va dans ton projet
2. Clique sur l'onglet **"Deployments"**
3. Clique sur le dernier déploiement
4. Clique sur **"View Function Logs"**

Tu verras tous les logs du serveur Node.js en temps réel !

### 7.2 Logs à surveiller

✅ **Logs normaux** :
```
🚀 PRODUCTION - Trimble Dashboard Backend
✅ Server is ready!
GET /auth/login
GET /callback
✅ OAuth success, redirecting to...
```

❌ **Erreurs possibles** :
```
❌ Invalid client credentials
❌ Token exchange failed
❌ CORS error
```

---

## 🎯 Étape 8 : Mettre à jour l'extension

Une fois le backend déployé et testé, tu dois mettre à jour l'extension pour pointer vers l'URL Vercel au lieu de localhost.

**Fichiers à modifier** :
- `src/api/authService.ts` : Changer `window.BACKEND_URL`
- `public/index.html` : Mettre l'URL de production

**Instructions détaillées** dans le prochain guide.

---

## 📊 Tableau récapitulatif

| Élément | Local | Vercel Production |
|---------|-------|-------------------|
| Backend URL | `http://localhost:3000` | `https://ton-backend.vercel.app` |
| Callback URL | `http://localhost:3000/callback` | `https://ton-backend.vercel.app/callback` |
| Frontend URL | `http://localhost:8080` | `https://simontrim.github.io` |
| Trimble Auth | `https://id.trimble.com` | `https://id.trimble.com` |

---

## 🛠️ Dépannage

### Problème 1 : "Invalid redirect_uri"
**Cause** : L'URL de callback n'est pas enregistrée dans Trimble Console

**Solution** :
1. Va sur Trimble Console
2. Ajoute l'URL Vercel dans les Callback URLs
3. Réessaye

### Problème 2 : "Module not found"
**Cause** : Dépendances manquantes

**Solution** :
1. Vérifie `backend/package.json`
2. Redéploie sur Vercel

### Problème 3 : "Function timeout"
**Cause** : Le serveur met trop de temps à répondre

**Solution** :
1. Vérifie les logs Vercel
2. Regarde si l'API Trimble répond lentement

### Problème 4 : "CORS error"
**Cause** : Frontend URL non autorisée

**Solution** :
1. Vérifie la variable `FRONTEND_URL` sur Vercel
2. Vérifie la config CORS dans `server.js`

---

## 🎉 Succès !

Une fois toutes ces étapes complétées :

✅ Backend déployé sur Vercel
✅ URLs configurées dans Trimble Console
✅ Variables d'environnement en place
✅ OAuth fonctionnel en production

**Prochaine étape :** Mettre à jour l'extension pour utiliser le backend Vercel !

---

## 📞 Support

Si tu rencontres un problème :
1. Vérifie les logs Vercel
2. Vérifie la console Trimble
3. Teste chaque endpoint individuellement
4. Partage les logs d'erreur

**Bon déploiement ! 🚀**
