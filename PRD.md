# Product Requirements Document (PRD)
## Trimble Connect Dashboard Extension

**Version:** 1.0.0  
**Date:** 2025-01-XX  
**Auteur:** [Votre Nom]  
**Plateforme Cible:** Trimble Connect for Browser

---

## 🎯 OBJECTIF DU PROJET

Développer une extension Trimble Connect qui affiche un tableau de bord interactif permettant aux utilisateurs de visualiser en temps réel les métriques clés de leur projet :
- Nombre de Notes actives
- Nombre de BCF (BIM Collaboration Format) en cours
- Fichiers récemment déposés (dernières 48h)
- Vues 3D créées
- Graphiques de tendances

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Stack Technologique
- **Langage:** TypeScript 5.x
- **Framework UI:** Vanilla JS + Chart.js 4.x (graphiques)
- **API:** Trimble Connect Workspace API + Viewer API
- **Build Tool:** Webpack 5.x
- **Package Manager:** npm

### Structure des Fichiers
trimble-dashboard-extension/ ├── src/ │ ├── index.ts # Point d'entrée principal │ ├── api/ │ │ ├── trimbleClient.ts # Wrapper API Trimble Connect │ │ ├── notesService.ts # Gestion des Notes │ │ ├── bcfService.ts # Gestion des BCF │ │ ├── filesService.ts # Gestion des fichiers │ │ └── viewsService.ts # Gestion des vues │ ├── ui/ │ │ ├── dashboard.ts # Composant Dashboard principal │ │ ├── charts.ts # Gestion des graphiques Chart.js │ │ └── styles.css # Styles CSS │ ├── models/ │ │ └── types.ts # Interfaces TypeScript │ └── utils/ │ ├── logger.ts # Système de logs │ └── errorHandler.ts # Gestion centralisée des erreurs ├── public/ │ ├── manifest.json # Manifest Trimble Connect │ └── icon.png # Icône de l'extension ├── dist/ # Fichiers compilés (généré) ├── package.json ├── tsconfig.json ├── webpack.config.js └── PRD.md # Ce fichier

--- ## 📊 FONCTIONNALITÉS DÉTAILLÉES ### F1: Affichage des Métriques en Temps Réel **Priorité:** P0 (Critique) **Description:** Afficher 4 cartes (cards) principales avec : 1. **Notes Actives** : Nombre total de notes non archivées 2. **BCF En Cours** : Nombre de BCF avec statut != "Closed" 3. **Fichiers Récents** : Nombre de fichiers uploadés dans les dernières 48h 4. **Vues Créées** : Nombre total de vues sauvegardées **API Utilisées:** - `TrimbleConnectWorkspace.Notes.getAll()` - `TrimbleConnectWorkspace.BCF.getTopics()` - `TrimbleConnectWorkspace.Files.getRecent()` - `TrimbleConnectWorkspace.Views.getAll()` **Critères d'Acceptation:** - [ ] Les données se rafraîchissent toutes les 30 secondes - [ ] Affichage d'un loader pendant le chargement - [ ] Gestion des erreurs avec message utilisateur clair - [ ] Design responsive (mobile/desktop) --- ### F2: Graphiques de Tendances **Priorité:** P1 (Important) **Description:** Afficher 2 graphiques Chart.js : 1. **Graphique en barres** : Répartition des BCF par statut (Open, In Progress, Closed) 2. **Graphique en ligne** : Évolution du nombre de fichiers uploadés (7 derniers jours) **Bibliothèque:** Chart.js 4.x (CDN ou npm) **Critères d'Acceptation:** - [ ] Graphiques interactifs (tooltips au survol) - [ ] Couleurs conformes à la charte Trimble (bleu #005F9E) - [ ] Animation fluide au chargement --- ### F3: Liste des Fichiers Récents **Priorité:** P2 (Nice to have) **Description:** Tableau listant les 10 derniers fichiers uploadés avec : - Nom du fichier - Date d'upload - Auteur - Lien de téléchargement **API Utilisée:** `TrimbleConnectWorkspace.Files.getRecent({ limit: 10, since: Date.now() - 48*3600*1000 })` **Critères d'Acceptation:** - [ ] Tri par date décroissante - [ ] Clic sur le nom ouvre le fichier dans Trimble Connect - [ ] Affichage d'une icône selon le type de fichier (.ifc, .pdf, .dwg) --- ## 🔌 INTÉGRATION TRIMBLE CONNECT ### Manifest.json ```json { "name": "Project Dashboard", "version": "1.0.0", "description": "Tableau de bord des métriques projet", "author": "Votre Entreprise", "api": "1.0", "extensions": [ { "type": "panel", "id": "dashboard-panel", "title": "Dashboard", "icon": "icon.png", "entryPoint": "dist/index.js" } ], "permissions": [ "project.read", "notes.read", "bcf.read", "files.read", "views.read" ] }

Initialisation de l'Extension
// src/index.ts
import { TrimbleConnectWorkspace } from '@trimble/connect-workspace-api';

async function initialize() {
  try {
    const api = await TrimbleConnectWorkspace.connect();
    const project = await api.project.get();
    
    console.log(`Extension chargée pour le projet: ${project.name}`);
    
    // Initialiser le dashboard
    const dashboard = new Dashboard(api);
    await dashboard.render();
    
  } catch (error) {
    console.error('Erreur d\'initialisation:', error);
  }
}

initialize();

🎨 DESIGN & UX
Charte Graphique
Couleur Primaire: #005F9E (Bleu Trimble)
Couleur Secondaire: #00A3E0 (Bleu clair)
Couleur Succès: #28A745
Couleur Alerte: #FFC107
Couleur Erreur: #DC3545
Police: Roboto, sans-serif
┌─────────────────────────────────────────┐ │ 🏠 Project Dashboard │ ├─────────────────────────────────────────┤ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │ │ │ 42 │ │ 15 │ │ 8 │ │ 23 │ │ │ │Notes│ │ BCF │ │Files│ │Views│ │ │ └─────┘ └─────┘ └─────┘ └─────┘ │ ├─────────────────────────────────────────┤ │ 📊 BCF Status 📈 Files Trend │ │ [Bar Chart] [Line Chart] │ ├─────────────────────────────────────────┤ │ 📁 Recent Files │ │ • file1.ifc - 2h ago - John Doe │ │ • file2.pdf - 5h ago - Jane Smith │ └─────────────────────────────────────────┘

🔒 GESTION DES ERREURS
Scénarios à Gérer
Pas de connexion réseau → Afficher "Mode hors ligne"
Permissions insuffisantes → Message "Accès refusé"
API Trimble indisponible → Retry automatique (3 tentatives)
Données corrompues → Afficher valeur par défaut (0)
Logging
Utiliser console.error() pour les erreurs critiques et console.warn() pour les avertissements.

📦 DÉPENDANCES NPM
{
  "dependencies": {
    "@trimble/connect-workspace-api": "^2.0.0",
    "chart.js": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "ts-loader": "^9.5.0",
    "css-loader": "^6.8.1",
    "style-loader": "^3.3.3"
  }
}

🚀 CRITÈRES DE SUCCÈS
Métriques de Performance
 Temps de chargement initial < 2 secondes
 Rafraîchissement des données < 500ms
 Pas de fuite mémoire après 1h d'utilisation
Tests à Effectuer
 Test sur Chrome 120+
 Test sur Firefox 120+
 Test sur Edge 120+
 Test avec projet contenant 1000+ fichiers
 Test avec connexion lente (3G simulé)
📅 ROADMAP
Phase 1 (MVP) - Semaine 1-2
 Setup projet TypeScript + Webpack
 Implémentation des 4 cartes métriques
 Intégration API Trimble Connect
 Gestion des erreurs basique
Phase 2 - Semaine 3
 Ajout des graphiques Chart.js
 Liste des fichiers récents
 Optimisation des performances
Phase 3 - Semaine 4
 Tests utilisateurs
 Corrections de bugs
 Documentation utilisateur

 🛠️ INSTRUCTIONS POUR CURSOR AI
Contexte
Tu es en train de développer une extension Trimble Connect. Utilise UNIQUEMENT les API officielles Trimble Connect Workspace API.

Règles Strictes
Vérification API : Avant d'utiliser une méthode, vérifie qu'elle existe dans la documentation Trimble Connect
Gestion Asynchrone : Toutes les API Trimble sont asynchrones → utilise async/await
Typage Fort : Utilise TypeScript avec interfaces strictes
Pas d'Hallucination : Si une fonctionnalité n'existe pas dans l'API, propose un workaround

Exemple de Code Attendu
// ✅ BON
async function getNotes(api: TrimbleConnectWorkspace.API) {
  try {
    const notes = await api.notes.getAll();
    return notes.filter(n => !n.archived);
  } catch (error) {
    console.error('Erreur récupération notes:', error);
    return [];
  }
}

// ❌ MAUVAIS (méthode inventée)
const notes = api.notes.getActive(); // N'existe pas !

Commandes Utiles
# Installation
npm install

# Développement
npm run dev

# Build production
npm run build

# Test
npm test

📞 CONTACT & SUPPORT
Développeur Principal: [Votre Email]
Documentation API: https://developer.connect.trimble.com/
Support Trimble: support@connect.trimble.com