# ⚡ Démarrage Rapide - Déploiement en 15 minutes

## 🎯 Objectif

Déployer votre extension Trimble Dashboard et la tester dans Trimble Connect en **15 minutes**.

---

## 📋 Option recommandée: GitHub Pages (GRATUIT)

### Étape 1: Préparer Git (2 minutes)

```powershell
# Ouvrez PowerShell dans le dossier du projet
cd "C:\Users\smartin1\Desktop\IA PROD\Extensions_TC\trimble-dashboard"

# Initialiser Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit - Trimble Dashboard Extension v1.0.0"
```

---

### Étape 2: Créer le repository GitHub (3 minutes)

1. **Aller sur GitHub.com:**
   - https://github.com/new

2. **Créer le repository:**
   ```
   Repository name: trimble-dashboard-extension
   Description: Dashboard pour Trimble Connect - Métriques projet
   Public ✅
   Ne cochez RIEN d'autre
   ```

3. **Cliquez sur "Create repository"**

---

### Étape 3: Pousser le code (2 minutes)

```powershell
# Remplacez VOTRE_USERNAME par votre nom d'utilisateur GitHub
git remote add origin https://github.com/VOTRE_USERNAME/trimble-dashboard-extension.git
git branch -M main
git push -u origin main
```

Si on vous demande de vous connecter:
- Username: votre nom d'utilisateur GitHub
- Password: votre Personal Access Token (créez-en un si nécessaire)

---

### Étape 4: Activer GitHub Pages (3 minutes)

1. **Dans votre repository GitHub:**
   - Cliquez sur "Settings" (en haut)

2. **Dans le menu latéral:**
   - Cliquez sur "Pages"

3. **Configuration:**
   ```
   Source: Deploy from a branch
   Branch: main
   Folder: / (root)
   ```

4. **Cliquez sur "Save"**

5. **Attendez 1-2 minutes** (GitHub déploie votre site)

6. **Votre URL sera:**
   ```
   https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/
   ```

---

### Étape 5: Tester que l'extension est accessible (1 minute)

Ouvrez dans votre navigateur:

```
https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/dist/test.html
```

✅ **Si vous voyez le dashboard** → Parfait! C'est hébergé!

---

### Étape 6: Créer le manifest pour GitHub Pages (2 minutes)

Créez ce fichier: `public/manifest-production.json`

```json
{
  "name": "Project Dashboard",
  "version": "1.0.0",
  "description": "Tableau de bord des métriques projet pour Trimble Connect",
  "author": "Votre Nom",
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

⚠️ **IMPORTANT:** Remplacez `VOTRE_USERNAME` par votre vrai nom d'utilisateur GitHub!

Puis commitez et poussez:

```powershell
git add public/manifest-production.json
git commit -m "Add production manifest for GitHub Pages"
git push
```

---

### Étape 7: Charger dans Trimble Connect (2 minutes)

1. **Ouvrir Trimble Connect:**
   - https://connect.trimble.com/
   - Connectez-vous

2. **Ouvrir un projet de test:**
   - Sélectionnez un projet existant avec des données
   - Ou créez-en un nouveau

3. **Accéder aux Extensions:**
   - Cliquez sur l'icône "Extensions" (puzzle 🧩) dans la barre latérale
   - Ou Menu > Extensions

4. **Charger votre extension:**
   - Cliquez sur "Add Extension" ou "+"
   - Collez l'URL de votre manifest:
     ```
     https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/public/manifest-production.json
     ```
   - Cliquez sur "Load" ou "Add"

5. **Votre extension apparaît!**
   - Un nouveau panneau "Dashboard" dans la liste
   - Cliquez dessus

---

### Étape 8: Vérifier avec vraies données (Test final)

✅ **Vérifications:**

1. **Dans la console (F12):**
   ```
   Vous devriez voir:
   ✅ "Using REAL Trimble Connect API" (pas Mock!)
   ✅ "Connected to project: [nom de votre projet]"
   ✅ Pas d'erreur rouge
   ```

2. **Dans le dashboard:**
   ```
   ✅ Les chiffres correspondent à votre projet (pas 2, 3, 4, 3)
   ✅ Les graphiques montrent vos vraies données
   ✅ Le tableau liste vos vrais fichiers
   ```

3. **Test d'interaction:**
   ```
   ✅ Uploader un fichier → Le compteur augmente après 30s
   ✅ Créer un BCF → Le graphique se met à jour
   ```

---

## 🎉 C'EST TERMINÉ!

Votre extension est maintenant:
- ✅ Hébergée sur GitHub Pages (HTTPS)
- ✅ Chargée dans Trimble Connect
- ✅ Fonctionnelle avec vraies données
- ✅ Accessible depuis n'importe où

---

## 🔄 Pour mettre à jour l'extension

Quand vous modifiez le code:

```powershell
# 1. Recompiler
npm run build

# 2. Commiter et pousser
git add .
git commit -m "Update: description des changements"
git push

# 3. Attendre 1-2 minutes que GitHub Pages redéploie

# 4. Rafraîchir dans Trimble Connect (F5)
```

---

## ⚠️ Dépannage Rapide

### L'extension ne se charge pas dans Trimble Connect

**Vérifiez:**

1. **L'URL du manifest est correcte:**
   ```
   https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/public/manifest-production.json
   ```

2. **Le fichier est accessible:**
   - Ouvrez l'URL dans votre navigateur
   - Vous devriez voir le JSON

3. **index.js est accessible:**
   ```
   https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/dist/index.js
   ```
   - Vous devriez voir du code JavaScript

### "Using MOCK data" au lieu de vraies données

**Cause:** L'extension n'arrive pas à se connecter à l'API Trimble

**Solutions:**
- Assurez-vous d'être DANS Trimble Connect (pas en local)
- Vérifiez la console pour les erreurs
- Rechargez la page (F5)

### Les chiffres ne se mettent pas à jour

**Solution:** Attendez 30 secondes (auto-refresh) ou rechargez la page

---

## 📊 URLs Importantes

Sauvegardez ces URLs (remplacez VOTRE_USERNAME):

```
Dashboard de test:
https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/dist/test.html

Manifest production:
https://VOTRE_USERNAME.github.io/trimble-dashboard-extension/public/manifest-production.json

Repository GitHub:
https://github.com/VOTRE_USERNAME/trimble-dashboard-extension
```

---

## 🎯 Prochaines Étapes

Maintenant que votre extension fonctionne:

1. **Partagez avec votre équipe:**
   - Donnez-leur l'URL du manifest
   - Ils peuvent charger l'extension dans leurs projets

2. **Ajoutez des fonctionnalités:**
   - Filtres
   - Export PDF
   - Notifications
   - Voir `NOTES_TECHNIQUES.md`

3. **Publiez sur le Marketplace Trimble** (optionnel):
   - Contactez connect-support@trimble.com

---

## ✅ Checklist de Déploiement

- [ ] Code compilé (`npm run build`)
- [ ] Repository GitHub créé
- [ ] Code poussé sur GitHub
- [ ] GitHub Pages activé
- [ ] `manifest-production.json` créé avec la bonne URL
- [ ] Extension chargée dans Trimble Connect
- [ ] Test avec vraies données réussi
- [ ] Console sans erreur
- [ ] Dashboard fonctionnel

---

**Félicitations! Votre extension est déployée!** 🎊
