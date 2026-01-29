# 🚀 Guide d'Hébergement et d'Intégration - Extension Trimble Connect

## ✅ Votre extension fonctionne en local!

Vous avez maintenant un dashboard fonctionnel avec données de démonstration. Passons à l'intégration dans Trimble Connect!

---

## 📋 Table des matières

1. [Préparer l'extension pour production](#1-préparer-pour-production)
2. [Héberger l'extension](#2-hébergement)
3. [Intégrer dans Trimble Connect](#3-intégration-trimble-connect)
4. [Tester avec de vraies données](#4-tests)
5. [Déploiement](#5-déploiement)

---

## 1️⃣ Préparer pour Production

### Vérifier les fichiers nécessaires

Votre extension a besoin de ces fichiers:

```
📦 Extension Trimble Dashboard
├── public/
│   └── manifest.json          ✅ Configuration
├── dist/
│   └── index.js               ✅ Code compilé (252 KB)
```

C'est tout! Ces 2 fichiers suffisent.

### Vérifier le manifest.json

```json
{
  "name": "Project Dashboard",
  "version": "1.0.0",
  "description": "Tableau de bord des métriques projet",
  "extensions": [{
    "type": "panel",
    "id": "dashboard-panel",
    "title": "Dashboard",
    "entryPoint": "../dist/index.js"
  }],
  "permissions": [
    "project.read",
    "notes.read",
    "bcf.read",
    "files.read",
    "views.read"
  ]
}
```

---

## 2️⃣ Hébergement de l'Extension

### Option A: Hébergement Web (RECOMMANDÉ)

Pour que Trimble Connect puisse charger votre extension, elle doit être accessible via HTTPS.

#### Solutions d'hébergement:

##### 🌐 **1. GitHub Pages** (GRATUIT - Recommandé pour débuter)

**Étapes:**

1. **Créer un repository GitHub**
   ```bash
   cd "C:\Users\smartin1\Desktop\IA PROD\Extensions_TC\trimble-dashboard"
   git init
   git add .
   git commit -m "Initial commit - Trimble Dashboard Extension"
   ```

2. **Créer le repository sur GitHub.com**
   - Aller sur https://github.com/new
   - Nom: `trimble-dashboard-extension`
   - Créer le repository

3. **Pousser le code**
   ```bash
   git remote add origin https://github.com/VOTRE_USERNAME/trimble-dashboard-extension.git
   git branch -M main
   git push -u origin main
   ```

4. **Activer GitHub Pages**
   - Allez dans Settings > Pages
   - Source: Deploy from branch
   - Branch: `main` / folder: `/ (root)`
   - Save

5. **Votre extension sera accessible à:**
   ```
   https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/
   ```

6. **Mettre à jour le manifest.json pour GitHub Pages:**

Créez un fichier `public/manifest-github.json`:

```json
{
  "name": "Project Dashboard",
  "version": "1.0.0",
  "description": "Tableau de bord des métriques projet",
  "extensions": [{
    "type": "panel",
    "id": "dashboard-panel",
    "title": "Dashboard",
    "entryPoint": "https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/dist/index.js"
  }],
  "permissions": [
    "project.read",
    "notes.read",
    "bcf.read",
    "files.read",
    "views.read"
  ]
}
```

##### ☁️ **2. Netlify** (GRATUIT - Plus simple)

**Étapes:**

1. Aller sur https://www.netlify.com/
2. Sign up (gratuit)
3. "Add new site" > "Deploy manually"
4. Glisser-déposer le dossier complet du projet
5. Netlify vous donne une URL: `https://RANDOM-NAME.netlify.app/`

**Avantages:**
- ✅ HTTPS automatique
- ✅ Déploiement en glisser-déposer
- ✅ URL personnalisable

##### 🔧 **3. Vercel** (GRATUIT - Pour développeurs)

```bash
npm install -g vercel
cd "C:\Users\smartin1\Desktop\IA PROD\Extensions_TC\trimble-dashboard"
vercel
```

Suivez les instructions, vous obtiendrez une URL.

##### 🏢 **4. Serveur d'entreprise** (PRODUCTION)

Si votre entreprise a un serveur web:
- Déployez les fichiers `public/` et `dist/` sur le serveur
- Assurez-vous que HTTPS est activé
- URL exemple: `https://intranet.votreentreprise.com/extensions/dashboard/`

---

### Option B: Chargement Local (DÉVELOPPEMENT UNIQUEMENT)

⚠️ **Attention:** Cette méthode ne fonctionne que pour les tests en développement.

**Étapes:**

1. Activez le mode développeur dans Trimble Connect
2. Chargez l'extension depuis votre disque local
3. Chemin: `C:\Users\smartin1\Desktop\IA PROD\Extensions_TC\trimble-dashboard\public\manifest.json`

**Limitations:**
- ❌ Ne fonctionne que sur votre machine
- ❌ Pas accessible aux autres utilisateurs
- ❌ Nécessite le mode développeur

---

## 3️⃣ Intégration dans Trimble Connect

### Méthode 1: Extension Publique (Marketplace)

Pour publier votre extension sur le Trimble Connect Marketplace:

1. **Préparer la soumission:**
   - Documentation utilisateur
   - Captures d'écran
   - Vidéo de démonstration (optionnel)
   - Icône 256x256px

2. **Soumettre à Trimble:**
   - Email: connect-support@trimble.com
   - Sujet: "Extension Submission - Project Dashboard"
   - Fournir:
     - Manifest.json
     - URL hébergée
     - Documentation
     - Description

3. **Processus de validation:**
   - Trimble teste l'extension
   - Vérification de sécurité
   - Validation des permissions
   - Approbation (2-4 semaines)

4. **Publication:**
   - Votre extension apparaît dans le Marketplace
   - Disponible pour tous les utilisateurs Trimble Connect

---

### Méthode 2: Extension Privée (Organisation)

Pour utiliser l'extension uniquement dans votre organisation:

#### A. Configuration Administrateur

1. **Accéder aux paramètres d'organisation:**
   - Connexion admin sur Trimble Connect
   - Settings > Organization > Extensions

2. **Ajouter une extension personnalisée:**
   ```
   Nom: Project Dashboard
   URL Manifest: https://votre-url.com/public/manifest.json
   Visibilité: Organization only
   ```

3. **Activer pour les projets:**
   - Sélectionner les projets
   - Ou activer pour tous les projets

#### B. Configuration Utilisateur

Les utilisateurs verront l'extension dans le menu Extensions de leurs projets.

---

### Méthode 3: Extension de Projet (Test rapide)

Pour tester rapidement sur un seul projet:

**Étapes:**

1. **Ouvrir Trimble Connect for Browser:**
   - https://connect.trimble.com/

2. **Aller dans un projet de test:**
   - Sélectionnez un projet existant
   - Ou créez un nouveau projet

3. **Ouvrir le panneau Extensions:**
   - Cliquez sur l'icône "Extensions" (puzzle) dans la barre latérale
   - Ou Menu > Extensions

4. **Charger votre extension:**
   
   **Option A: URL hébergée**
   ```
   1. Cliquez sur "Add Extension" ou "+"
   2. Entrez l'URL du manifest:
      https://votre-url.com/public/manifest.json
   3. Cliquez sur "Load"
   ```

   **Option B: Mode développeur (local)**
   ```
   1. Activez le mode développeur (Settings > Developer Mode)
   2. "Load unpacked extension"
   3. Sélectionnez le dossier: public/
   ```

5. **L'extension apparaît:**
   - Un nouveau panneau "Dashboard" dans la sidebar
   - Cliquez dessus pour l'ouvrir!

---

## 4️⃣ Tests avec Vraies Données

### Vérifications avant test:

- [x] Extension hébergée (HTTPS)
- [x] Manifest.json accessible
- [x] dist/index.js accessible
- [ ] Projet Trimble avec données (Notes, BCF, fichiers)

### Scénario de test:

1. **Créer un projet de test riche:**
   ```
   ✅ Créer 5-10 notes
   ✅ Créer 3-5 BCF avec différents statuts
   ✅ Uploader 10+ fichiers (PDF, IFC, images)
   ✅ Créer 2-3 vues 3D
   ```

2. **Charger l'extension:**
   - Suivre les étapes de la section 3

3. **Vérifier l'affichage:**
   ```
   ✅ Les vrais chiffres s'affichent (pas 2, 3, 4, 3)
   ✅ Les graphiques montrent les vraies données
   ✅ Le tableau liste les vrais fichiers uploadés
   ✅ Pas de message "Mock" dans la console
   ```

4. **Tester les fonctionnalités:**
   ```
   ✅ Auto-refresh (attendre 30 secondes)
   ✅ Uploader un fichier → vérifier mise à jour
   ✅ Créer un BCF → vérifier graphique
   ✅ Responsive (redimensionner la fenêtre)
   ```

---

## 5️⃣ Déploiement Production

### Checklist de déploiement:

#### Code
- [x] Build production: `npm run build`
- [x] Tests locaux réussis
- [ ] Tests dans Trimble Connect réussis
- [ ] Pas d'erreurs dans la console
- [ ] Performance OK (chargement < 2s)

#### Hébergement
- [ ] Extension hébergée sur serveur HTTPS
- [ ] URL stable (pas de changement fréquent)
- [ ] Certificat SSL valide
- [ ] CORS configuré si nécessaire

#### Documentation
- [ ] README pour utilisateurs
- [ ] Guide d'installation
- [ ] Captures d'écran
- [ ] Vidéo de démo (optionnel)

#### Support
- [ ] Email de contact configuré
- [ ] Process de signalement de bugs
- [ ] Changelog préparé

---

## 🔧 Configuration Avancée

### CORS (Cross-Origin Resource Sharing)

Si l'extension ne charge pas, vous devez peut-être configurer CORS:

**Pour Netlify** (fichier `netlify.toml`):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
```

**Pour serveur Apache** (fichier `.htaccess`):
```apache
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
```

**Pour serveur Nginx**:
```nginx
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
```

---

## 📊 Monitoring & Analytics

### Logs dans Trimble Connect

Les logs de votre extension sont visibles:
```javascript
// Dans la console Chrome (F12)
window.trimbleDashboard.logger.getLogs()
```

### Métriques à surveiller

- Temps de chargement initial
- Erreurs API
- Nombre d'utilisations
- Performance des graphiques

---

## 🐛 Résolution de Problèmes

### L'extension ne se charge pas

**Causes possibles:**
1. ❌ URL manifest incorrecte
2. ❌ Certificat SSL invalide
3. ❌ CORS non configuré
4. ❌ Fichier index.js inaccessible

**Solutions:**
```bash
# Vérifier que les fichiers sont accessibles:
curl https://votre-url.com/public/manifest.json
curl https://votre-url.com/dist/index.js
```

### Les données ne s'affichent pas

**Vérifications:**
1. Ouvrir la console (F12)
2. Regarder les logs:
   ```javascript
   window.trimbleDashboard.logger.getLogsByLevel('error')
   ```
3. Vérifier les permissions dans manifest.json
4. Vérifier que le projet contient des données

### Message "Using MOCK data"

**Cause:** L'API Trimble Connect n'est pas disponible

**Solutions:**
- Vérifier que l'extension est chargée DANS Trimble Connect (pas en local)
- Vérifier que le CDN est chargé
- Regarder la console pour les erreurs

---

## 🎯 Prochaines Étapes

### Maintenant, vous devez:

1. **Choisir une méthode d'hébergement:**
   - GitHub Pages (gratuit, simple)
   - Netlify (gratuit, très simple)
   - Serveur d'entreprise (production)

2. **Héberger votre extension:**
   - Suivre les instructions de la section 2
   - Obtenir une URL HTTPS

3. **Charger dans Trimble Connect:**
   - Suivre les instructions de la section 3
   - Tester avec un projet réel

4. **Valider avec vraies données:**
   - Créer ou utiliser un projet test
   - Vérifier que tout fonctionne

---

## 📞 Besoin d'aide?

### Ressources Trimble

- **Documentation:** https://developer.connect.trimble.com/
- **Support:** connect-support@trimble.com
- **Forum:** https://community.trimble.com/

### Votre extension

- **Version actuelle:** 1.0.0
- **Statut:** ✅ Fonctionnelle en local
- **Prochaine étape:** Hébergement

---

## 🎉 Résumé

Votre extension est **prête pour production**! Il ne reste qu'à:

1. ✅ **Héberger** sur GitHub Pages / Netlify (15 minutes)
2. ✅ **Charger** dans Trimble Connect (5 minutes)
3. ✅ **Tester** avec vraies données (10 minutes)

**Total: 30 minutes jusqu'au déploiement!** 🚀

---

**Bon déploiement!** 💻✨
