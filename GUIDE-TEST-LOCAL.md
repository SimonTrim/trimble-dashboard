# 🧪 Guide de Test Local - Trimble Dashboard

## ✅ Configuration actuelle

- ✅ Backend OAuth2 configuré en **PRODUCTION**
- ✅ Backend tourne sur `http://localhost:3000`
- ✅ Frontend configuré pour `http://localhost:8080`
- ✅ Extension compilée avec authentification intégrée

---

## 📋 Étapes pour tester localement

### 1. Vérifier que le backend tourne

Le backend devrait déjà tourner. Sinon, démarre-le :

```powershell
cd backend
npm start
```

Tu devrais voir :
```
🚀 PRODUCTION - Trimble Dashboard Backend
Port: 3000
Mode: PRODUCTION
Frontend URL: http://localhost:8080
✅ Server is ready!
```

### 2. Lancer le serveur frontend

Ouvre un **NOUVEAU terminal** PowerShell et lance :

```powershell
# Depuis la racine du projet
npm run serve
```

Tu devrais voir :
```
Starting up http-server, serving public
Available on:
  http://localhost:8080
```

### 3. Ouvrir l'extension dans le navigateur

Ouvre ton navigateur et va sur :
```
http://localhost:8080/index-local.html
```

### 4. Tester le flux d'authentification

Tu devrais voir :

#### ✅ **Écran de connexion**
- Un bel écran bleu avec le logo Trimble
- Un bouton "🔐 Se connecter avec Trimble ID"
- Badge "LOCAL TEST" en haut à droite

#### ✅ **Cliquer sur le bouton de connexion**
1. Clique sur "Se connecter avec Trimble ID"
2. Tu seras redirigé vers `https://id.trimble.com` (page de login Trimble)
3. Entre tes credentials Trimble
4. Tu seras redirigé vers `http://localhost:8080/index-local.html?session=...&auth=success`
5. L'extension devrait charger le dashboard avec les **vraies données** !

---

## 🔍 Vérifications

### Backend logs (terminal backend)

Tu devrais voir :
```
2026-02-05T12:XX:XX.XXX - GET /auth/login
2026-02-05T12:XX:XX.XXX - GET /callback
```

### Console navigateur (F12)

Tu devrais voir :
```
🚀 Initializing Trimble Dashboard Extension
✅ User authenticated - loading dashboard
✅ Extension ready in standalone mode!
```

---

## 🛠️ Dépannage

### Problème 1 : "Origin not allowed by CORS"

**Solution** : Le backend accepte maintenant plusieurs origines (localhost:8080, 3001, 5500).

### Problème 2 : "Token expiré"

**Solution** : Reconnecte-toi en cliquant sur le bouton de connexion.

### Problème 3 : Page vide après connexion

**Solution** : 
1. Ouvre la console (F12)
2. Vérifie les erreurs
3. Vérifie que le backend tourne sur port 3000

### Problème 4 : "Backend non accessible"

**Solution** :
```powershell
cd backend
npm start
```

---

## 📊 Ce qui devrait fonctionner

Une fois authentifié, tu devrais voir :

✅ **Dashboard avec vraies données** :
- Métriques projet (Fichiers, Todos, BCF Topics, Views)
- Statistiques de l'équipe
- Activité récente
- Charts interactifs

✅ **Appels API réels** :
- Le backend proxy fait les appels à Trimble Connect REST API
- Les données sont récupérées depuis ton compte Trimble
- Pas de données mock !

---

## 🎯 Prochaines étapes après le test local

Une fois que tout fonctionne localement :

1. ✅ Valider que les données sont correctes
2. ✅ Tester différents projets Trimble Connect
3. 🚀 **Déployer le backend sur Vercel/Railway**
4. 🚀 **Mettre à jour l'extension GitHub Pages**
5. 🎉 **Publier l'extension sur Trimble Connect Developer Console**

---

## 📞 Besoin d'aide ?

Si tu rencontres un problème :
1. Vérifie les logs backend (terminal)
2. Vérifie la console navigateur (F12)
3. Vérifie que les deux serveurs tournent (3000 et 8080)
4. Partage les logs d'erreur

---

**Bon test ! 🚀**
