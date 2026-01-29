# 📊 Trimble Dashboard Extension

Extension Trimble Connect permettant de visualiser les métriques clés de votre projet en temps réel.

## 🎯 Fonctionnalités

- **Cartes Métriques**: Affichage en temps réel des Notes actives, BCF en cours, Fichiers récents, et Vues créées
- **Graphiques Interactifs**: 
  - Répartition des BCF par statut (Bar Chart)
  - Tendance des fichiers uploadés (Line Chart)
- **Tableau des Fichiers**: Liste des 10 derniers fichiers uploadés
- **Auto-Refresh**: Rafraîchissement automatique toutes les 30 secondes
- **Design Responsive**: Interface adaptée mobile et desktop

## 🚀 Installation

### Prérequis

- Node.js 18+ 
- npm 9+
- Compte développeur Trimble Connect

### Installation des dépendances

```bash
npm install
```

## 🛠️ Développement

### Compiler en mode développement (avec watch)

```bash
npm run dev
```

### Compiler en mode production

```bash
npm run build
```

### Nettoyer le dossier dist

```bash
npm run clean
```

## 📁 Structure du Projet

```
trimble-dashboard/
├── src/
│   ├── api/              # Services API Trimble Connect
│   │   ├── trimbleClient.ts
│   │   ├── notesService.ts
│   │   ├── bcfService.ts
│   │   ├── filesService.ts
│   │   └── viewsService.ts
│   ├── ui/               # Composants UI
│   │   ├── dashboard.ts
│   │   ├── charts.ts
│   │   └── styles.css
│   ├── models/           # Types TypeScript
│   │   └── types.ts
│   ├── utils/            # Utilitaires
│   │   ├── logger.ts
│   │   └── errorHandler.ts
│   └── index.ts          # Point d'entrée
├── public/
│   ├── manifest.json     # Manifest Trimble Connect
│   └── index.html        # Page HTML
├── dist/                 # Fichiers compilés (généré)
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## 🔧 Configuration

### Configuration du Dashboard

Le dashboard peut être configuré dans `src/index.ts`:

```typescript
const dashboard = new Dashboard('app', {
  refreshInterval: 30000,        // Intervalle de rafraîchissement (ms)
  recentFilesThreshold: 48,      // Seuil fichiers récents (heures)
  maxRecentFilesDisplay: 10,     // Nombre max de fichiers affichés
  enableAutoRefresh: true,       // Activer le rafraîchissement auto
});
```

## 🎨 Charte Graphique

L'extension utilise la charte graphique officielle Trimble:

- **Primaire**: #005F9E (Bleu Trimble)
- **Secondaire**: #00A3E0 (Bleu clair)
- **Succès**: #28A745 (Vert)
- **Alerte**: #FFC107 (Jaune)
- **Erreur**: #DC3545 (Rouge)

## 📚 API Utilisées

- `@trimble/connect-workspace-api` - API Trimble Connect
- `chart.js` - Bibliothèque de graphiques

## 🐛 Débogage

En mode développement, les objets suivants sont exposés dans la console:

```javascript
window.trimbleDashboard = {
  dashboard,      // Instance du dashboard
  trimbleClient,  // Client API Trimble
  logger,         // Système de logs
}
```

### Exemples de commandes de débogage:

```javascript
// Voir les logs
window.trimbleDashboard.logger.getLogs()

// Forcer un rafraîchissement
window.trimbleDashboard.dashboard.loadData()

// Vérifier la connexion
window.trimbleDashboard.trimbleClient.isReady()
```

## 🔒 Permissions

L'extension nécessite les permissions suivantes:

- `project.read` - Lire les informations du projet
- `notes.read` - Lire les notes
- `bcf.read` - Lire les BCF
- `files.read` - Lire les fichiers
- `views.read` - Lire les vues

## 📝 Logs

Le système de logs enregistre:
- ℹ️ Info: Événements généraux
- ⚠️ Warn: Avertissements
- ❌ Error: Erreurs
- 🔍 Debug: Informations de débogage (dev uniquement)

## 🚧 Roadmap

- [ ] Filtres personnalisables
- [ ] Export PDF des métriques
- [ ] Notifications temps réel
- [ ] Mode sombre
- [ ] Intégration avec MS Teams

## 🤝 Contribution

Les contributions sont les bienvenues! Veuillez créer une issue avant de soumettre une PR.

## 📄 Licence

MIT

## 📞 Support

- Email: support@votre-entreprise.com
- Documentation: https://developer.connect.trimble.com/

---

**Développé avec ❤️ pour Trimble Connect**
