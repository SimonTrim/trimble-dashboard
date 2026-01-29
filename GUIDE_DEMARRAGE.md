# 🚀 Guide de Démarrage Rapide - Trimble Dashboard

## ✅ Ce qui a été créé

Votre extension Trimble Connect est prête! Voici ce qui a été généré:

### 📁 Structure complète du projet

```
trimble-dashboard/
├── src/                    # Code source TypeScript
│   ├── api/               # Services API Trimble
│   │   ├── trimbleClient.ts
│   │   ├── notesService.ts
│   │   ├── bcfService.ts
│   │   ├── filesService.ts
│   │   ├── viewsService.ts
│   │   └── trimble-api-mock.ts  # ⚠️ Mock pour développement
│   ├── ui/                # Interface utilisateur
│   │   ├── dashboard.ts
│   │   ├── charts.ts
│   │   └── styles.css
│   ├── models/            # Types TypeScript
│   │   └── types.ts
│   ├── utils/             # Utilitaires
│   │   ├── logger.ts
│   │   └── errorHandler.ts
│   └── index.ts           # Point d'entrée
├── dist/                  # ✅ Fichiers compilés (prêts)
├── public/
│   ├── manifest.json      # Configuration Trimble
│   └── index.html         # Page HTML
├── package.json           # Dépendances
├── tsconfig.json          # Config TypeScript
└── webpack.config.js      # Config Webpack
```

## 🎯 Prochaines Étapes

### 1️⃣ Configurer l'API Trimble Connect (IMPORTANT)

Actuellement, le projet utilise des **données mock** pour le développement. Pour utiliser la vraie API Trimble:

#### Option A: Installer le package officiel

Si vous avez accès au registre npm privé de Trimble:

```bash
# Configurer le registre npm Trimble
npm config set @trimble:registry https://registry.trimble.com/

# Installer le package officiel
npm install @trimble/connect-workspace-api@^2.0.0
```

Puis modifier `src/api/trimbleClient.ts` ligne 26:

```typescript
// Remplacer:
const { TrimbleConnectWorkspace } = await import('./trimble-api-mock');

// Par:
const { TrimbleConnectWorkspace } = await import('@trimble/connect-workspace-api');
```

#### Option B: Package local

Si Trimble vous a fourni un fichier `.tgz`:

```bash
npm install /chemin/vers/connect-workspace-api-2.0.0.tgz
```

### 2️⃣ Tester en mode développement

```bash
# Compiler avec watch (recompile automatiquement)
npm run dev
```

Ouvrez `public/index.html` dans votre navigateur pour voir le dashboard.

### 3️⃣ Intégrer dans Trimble Connect

Une fois prêt, vous pouvez charger l'extension dans Trimble Connect:

1. Aller dans **Trimble Connect for Browser**
2. Ouvrir votre projet
3. Cliquer sur **Extensions** > **Charger une extension**
4. Pointer vers `public/manifest.json`

### 4️⃣ Build de production

```bash
npm run build
```

Les fichiers optimisés seront dans `dist/`.

## 🎨 Personnalisation

### Modifier l'intervalle de rafraîchissement

Dans `src/index.ts` (ligne 22):

```typescript
const dashboard = new Dashboard('app', {
  refreshInterval: 30000,        // 30 secondes (modifiable)
  recentFilesThreshold: 48,      // 48 heures (modifiable)
  maxRecentFilesDisplay: 10,     // 10 fichiers (modifiable)
  enableAutoRefresh: true,
});
```

### Modifier les couleurs

Dans `src/ui/styles.css` (lignes 6-13):

```css
:root {
  --trimble-primary: #005F9E;     /* Bleu principal */
  --trimble-secondary: #00A3E0;   /* Bleu secondaire */
  --trimble-success: #28A745;     /* Vert */
  --trimble-warning: #FFC107;     /* Jaune */
  --trimble-danger: #DC3545;      /* Rouge */
}
```

## 🐛 Débogage

### Ouvrir la console développeur

Dans le navigateur: **F12** ou **Ctrl+Shift+I**

### Accéder aux outils de débogage

En mode développement, tapez dans la console:

```javascript
// Voir tous les logs
window.trimbleDashboard.logger.getLogs()

// Voir les logs d'erreur uniquement
window.trimbleDashboard.logger.getLogsByLevel('error')

// Forcer un rafraîchissement des données
window.trimbleDashboard.dashboard.loadData()

// Vérifier la connexion API
window.trimbleDashboard.trimbleClient.isReady()
```

## 📊 Fonctionnalités actuelles

### ✅ Implémentées

- ✅ 4 cartes métriques (Notes, BCF, Fichiers, Vues)
- ✅ Graphique de répartition des BCF (Bar Chart)
- ✅ Graphique de tendance des fichiers (Line Chart)
- ✅ Tableau des 10 derniers fichiers
- ✅ Auto-refresh toutes les 30 secondes
- ✅ Gestion des erreurs
- ✅ Système de logs
- ✅ Design responsive
- ✅ Charte graphique Trimble

### 🚧 À venir (Roadmap)

- ⏳ Filtres personnalisables
- ⏳ Export PDF
- ⏳ Notifications temps réel
- ⏳ Mode sombre

## 📚 Commandes utiles

```bash
# Installer les dépendances
npm install

# Mode développement (watch)
npm run dev

# Build production
npm run build

# Nettoyer le dossier dist
npm run clean
```

## ⚠️ Points importants

1. **API Mock**: Actuellement, le projet utilise des données fictives. Remplacez par la vraie API Trimble pour la production.

2. **Permissions**: Vérifiez que vous avez les bonnes permissions dans `public/manifest.json`:
   - `project.read`
   - `notes.read`
   - `bcf.read`
   - `files.read`
   - `views.read`

3. **Taille du bundle**: Le fichier `dist/index.js` fait 249 KB (normal avec Chart.js). Pour optimiser:
   ```bash
   # Analyser le bundle
   npm install --save-dev webpack-bundle-analyzer
   ```

## 🆘 Support

### Problèmes courants

#### Build échoue
```bash
# Nettoyer et réinstaller
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### L'extension ne se charge pas
1. Vérifier la console navigateur (F12)
2. Vérifier les permissions dans manifest.json
3. Vérifier que l'API Trimble est configurée

#### Données ne s'affichent pas
1. Ouvrir la console: `window.trimbleDashboard.logger.getLogs()`
2. Vérifier la connexion: `window.trimbleDashboard.trimbleClient.isReady()`
3. Forcer le refresh: `window.trimbleDashboard.dashboard.loadData()`

## 📞 Ressources

- **Documentation Trimble**: https://developer.connect.trimble.com/
- **Chart.js**: https://www.chartjs.org/
- **TypeScript**: https://www.typescriptlang.org/

---

**🎉 Félicitations! Votre extension Trimble Dashboard est prête!**

Pour toute question, n'hésitez pas à consulter le README.md ou la documentation Trimble.
