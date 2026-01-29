# 🚀 Guide d'injection du Dashboard dans Trimble Connect

Ce guide explique comment charger votre Dashboard directement dans l'interface Trimble Connect For Browser.

---

## 📋 Méthode Recommandée: Script d'injection dans la console

### Étape 1: Préparer le script

1. Ouvrez ce fichier: [`public/inject-script.js`](https://raw.githubusercontent.com/SimonTrim/trimble-dashboard/main/public/inject-script.js)
2. **Copiez TOUT le contenu** (Ctrl+A puis Ctrl+C)

### Étape 2: Se connecter à Trimble Connect

1. Allez sur: **https://app.connect.trimble.com/**
2. Connectez-vous avec votre compte Trimble
3. **Ouvrez un projet** qui contient des données (Notes, BCF, Fichiers, etc.)

### Étape 3: Ouvrir la console développeur

1. Appuyez sur **F12** (ou Ctrl+Shift+I)
2. Cliquez sur l'onglet **"Console"**
3. Vous verrez une zone de texte en bas où vous pouvez taper du code

### Étape 4: Injecter le dashboard

1. **Collez le script** copié à l'Étape 1 (Ctrl+V)
2. Appuyez sur **Entrée**
3. **Attendez 2-3 secondes**

### ✅ Résultat attendu

Un panneau flottant devrait apparaître **sur le côté droit** de l'écran avec:
- 📊 Un header bleu "Dashboard - Trimble Connect"
- ⏳ Un loader pendant le chargement
- 📈 Puis vos métriques de projet en temps réel

---

## 🎯 Fonctionnalités du panneau

### Interface
- **Draggable**: Cliquez sur l'en-tête (partie bleue) et déplacez le panneau
- **Bouton ×**: Ferme le panneau
- **Scrollable**: Si le contenu est long, vous pouvez scroller

### Données affichées
- 📝 **Notes actives**: Nombre de notes en cours
- 🔧 **BCF actifs**: Nombre de BCF ouverts
- 📁 **Fichiers récents**: Fichiers uploadés dans les dernières 48h
- 👁️ **Vues créées**: Nombre de vues 3D sauvegardées
- 📊 **Graphiques**: Répartition des BCF par statut + Tendance des fichiers

---

## 🔍 Vérification dans la console

Après avoir injecté le script, vous devriez voir ces logs:

```
🚀 Chargement du Dashboard Trimble Connect...
✅ Dashboard chargé avec succès!
📍 Emplacement: Panneau sur la droite
💡 Astuce: Vous pouvez déplacer le panneau en cliquant sur l'en-tête
```

### Si l'API Trimble Connect est détectée:
```
✓ TrimbleConnectWorkspace found - Using REAL Trimble Connect API
Connected to project: [Nom de votre projet]
Loading dashboard data...
```

### Si l'API n'est pas détectée (mode mock):
```
⚠️ TrimbleConnectWorkspace not found - Using MOCK data for local testing
💡 For real data, load the extension in Trimble Connect
```

---

## ❌ Résolution de problèmes

### Le panneau n'apparaît pas
1. **Vérifiez la console**: Y a-t-il des erreurs en rouge?
2. **Rafraîchissez la page** Trimble Connect (F5)
3. **Réinjectez le script**

### Erreur 404 ou "Failed to load resource"
- Attendez 1-2 minutes que GitHub Pages se mette à jour
- Vérifiez l'URL: https://simontrim.github.io/trimble-dashboard/dist/index.js
- Si l'URL ne fonctionne pas dans votre navigateur, GitHub Pages n'a pas terminé le déploiement

### Le panneau affiche "Mode Hors Ligne"
Cela signifie que le Dashboard utilise des **données de démonstration** au lieu des vraies données de votre projet.

**Causes possibles**:
1. L'API Trimble Connect n'est pas disponible dans cette page
2. Le script est chargé depuis une page externe (pas depuis Trimble Connect)
3. Les permissions API ne sont pas accordées

**Solution**: Assurez-vous d'être bien sur `app.connect.trimble.com` avec un projet ouvert.

### "Error: Cannot read property 'project' of undefined"
L'API Trimble Connect n'a pas encore été initialisée.

**Solution**:
1. Attendez quelques secondes
2. Réinjectez le script
3. Ou rechargez la page Trimble Connect

---

## 🔄 Recharger le Dashboard

Pour recharger le dashboard sans rafraîchir la page:

1. Dans la console, tapez: `document.getElementById('trimble-dashboard-container').remove()`
2. Réinjectez le script

---

## 🌐 Liens utiles

| Resource | URL |
|----------|-----|
| **Script d'injection** | https://raw.githubusercontent.com/SimonTrim/trimble-dashboard/main/public/inject-script.js |
| **Page de test** | https://simontrim.github.io/trimble-dashboard/dist/test.html |
| **Dashboard standalone** | https://simontrim.github.io/trimble-dashboard/public/inject-trimble.html |
| **Repository GitHub** | https://github.com/SimonTrim/trimble-dashboard |

---

## 💡 Astuces

### Créer un Bookmarklet (optionnel)

Pour charger le dashboard en 1 clic:

1. Créez un nouveau favori dans votre navigateur
2. Nom: `📊 Trimble Dashboard`
3. URL: Copiez-collez ceci:

```javascript
javascript:(function(){var script=document.createElement('script');script.src='https://simontrim.github.io/trimble-dashboard/public/inject-script.js';document.body.appendChild(script);})();
```

4. Maintenant, cliquez sur ce favori quand vous êtes sur Trimble Connect!

---

## 📞 Support

Si vous rencontrez des problèmes:
1. Vérifiez les logs dans la console (F12)
2. Faites un screenshot de l'erreur
3. Vérifiez que GitHub Pages est bien actif

---

**Développé avec ❤️ pour Trimble Connect**
