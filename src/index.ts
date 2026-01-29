/**
 * Point d'entrée principal de l'extension Trimble Dashboard
 * Utilise le Workspace API pour s'intégrer dans Trimble Connect
 */

import * as WorkspaceAPI from 'trimble-connect-workspace-api';
import { Dashboard } from './ui/dashboard';
import { logger } from './utils/logger';
import { errorHandler, ErrorCode } from './utils/errorHandler';
import { trimbleClient } from './api/trimbleClient';

// Type pour l'API Workspace
interface WorkspaceAPIInstance {
  ui: {
    setMenu: (menu: any) => void;
    setActiveMenuItem: (command: string) => void;
  };
  project: {
    getCurrentProject: () => Promise<any>;
  };
  user: {
    getUserSettings: () => Promise<any>;
  };
  extension: {
    requestPermission: (permission: 'accesstoken') => Promise<string>;
  };
}

let workspaceAPI: WorkspaceAPIInstance | null = null;
let dashboard: Dashboard | null = null;
let isDashboardVisible = false;

/**
 * Fonction d'initialisation principale
 */
async function initialize(): Promise<void> {
  try {
    logger.info('🚀 Initializing Trimble Dashboard Extension');

    // Étape 1: Se connecter à Trimble Connect via WorkspaceAPI
    logger.info('Connecting to Trimble Connect Workspace API...');
    
    workspaceAPI = await WorkspaceAPI.connect(
      window.parent,
      handleWorkspaceEvents
    );
    
    logger.info('✓ Connected to Workspace API');

    // Étape 2: Obtenir les infos du projet
    let projectId: string | undefined;
    if (workspaceAPI) {
      const projectInfo = await workspaceAPI.project.getCurrentProject();
      projectId = projectInfo.id;
      logger.info(`Connected to project: ${projectInfo.name}`, { projectId });
    }

    // Étape 3: Initialiser le TrimbleClient (avec mock pour l'instant)
    logger.info('Initializing TrimbleClient...');
    logger.warn('⚠️ Using MOCK data - Real data access requires REST API implementation');
    await trimbleClient.initialize(); // Utilisera automatiquement le mock
    
    // Étape 4: Créer le menu dans le panneau latéral
    logger.info('Creating sidebar menu...');
    createSidebarMenu();

    // Étape 5: Créer l'instance du dashboard (masquée au départ)
    logger.info('Initializing dashboard...');
    dashboard = new Dashboard('app', {
      refreshInterval: 30000,
      recentFilesThreshold: 48,
      maxRecentFilesDisplay: 10,
      enableAutoRefresh: true,
    });

    logger.info('✅ Extension ready!');

  } catch (error) {
    logger.error('❌ Extension Failed to Load', { error });
    displayInitializationError(error);
  }
}

/**
 * Créer le menu dans le panneau latéral de Trimble Connect
 */
function createSidebarMenu(): void {
  if (!workspaceAPI) {
    logger.error('WorkspaceAPI not initialized');
    return;
  }

  const mainMenuObject = {
    title: 'Project Dashboard',
    icon: 'https://simontrim.github.io/trimble-dashboard/public/icon.svg',
    command: 'show_dashboard',
    subMenus: [
      {
        title: 'Vue d\'ensemble',
        icon: 'https://simontrim.github.io/trimble-dashboard/public/icon.svg',
        command: 'show_overview',
      },
      {
        title: 'Actualiser',
        icon: 'https://simontrim.github.io/trimble-dashboard/public/icon.svg',
        command: 'refresh_data',
      }
    ],
  };

  // Mettre à jour le menu Trimble Connect
  workspaceAPI.ui.setMenu(mainMenuObject);
  logger.info('✓ Sidebar menu created');
  
  // Activer le premier sous-menu par défaut
  workspaceAPI.ui.setActiveMenuItem('show_overview');
}

/**
 * Gérer les événements du Workspace API
 */
function handleWorkspaceEvents(event: string, args: any): void {
  logger.info(`Workspace event: ${event}`, args);

  switch (event) {
    case 'extension.command':
      handleCommand(args.data);
      break;
      
    case 'extension.accessToken':
      logger.info('Access token received', { status: args.data });
      break;
      
    case 'extension.userSettingsChanged':
      logger.info('User settings changed');
      break;
      
    default:
      logger.debug(`Unhandled event: ${event}`, args);
  }
}

/**
 * Gérer les commandes du menu
 */
async function handleCommand(command: string): Promise<void> {
  logger.info(`Command received: ${command}`);

  if (!workspaceAPI) {
    logger.error('WorkspaceAPI not initialized');
    return;
  }

  switch (command) {
    case 'show_dashboard':
    case 'show_overview':
      // Afficher le dashboard
      await showDashboard();
      workspaceAPI.ui.setActiveMenuItem(command);
      break;
      
    case 'refresh_data':
      // Rafraîchir les données
      await refreshDashboard();
      break;
      
    default:
      logger.warn(`Unknown command: ${command}`);
  }
}

/**
 * Afficher le dashboard
 */
async function showDashboard(): Promise<void> {
  if (!dashboard) {
    logger.error('Dashboard not initialized');
    return;
  }

  if (isDashboardVisible) {
    logger.info('Dashboard already visible');
    return;
  }

  try {
    logger.info('Showing dashboard...');
    await dashboard.render();
    isDashboardVisible = true;
    logger.info('✓ Dashboard displayed');
  } catch (error) {
    logger.error('Failed to show dashboard', { error });
  }
}

/**
 * Rafraîchir les données du dashboard
 */
async function refreshDashboard(): Promise<void> {
  if (!dashboard) {
    logger.error('Dashboard not initialized');
    return;
  }

  try {
    logger.info('Refreshing dashboard data...');
    await dashboard.render(); // Re-render pour rafraîchir les données
    logger.info('✓ Data refreshed');
  } catch (error) {
    logger.error('Failed to refresh data', { error });
  }
}

/**
 * Afficher une erreur d'initialisation à l'utilisateur
 */
function displayInitializationError(error: any): void {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found');
    return;
  }

  const appError = errorHandler.createError(ErrorCode.INITIALIZATION_ERROR, error);
  
  container.innerHTML = `
    <div style="
      max-width: 600px;
      margin: 50px auto;
      padding: 30px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      font-family: 'Roboto', sans-serif;
    ">
      <h1 style="color: #DC3545; margin-bottom: 20px;">
        ⚠️ Erreur d'Initialisation
      </h1>
      <p style="color: #212529; margin-bottom: 15px; line-height: 1.6;">
        L'extension Trimble Dashboard n'a pas pu se charger correctement.
      </p>
      <div style="
        background: #F8D7DA;
        border: 1px solid #F5C6CB;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 20px;
      ">
        <strong style="color: #721C24;">Message:</strong>
        <p style="color: #721C24; margin-top: 8px;">${appError.message}</p>
      </div>
      <h3 style="color: #212529; margin-bottom: 10px;">Solutions possibles:</h3>
      <ul style="color: #6C757D; line-height: 1.8;">
        <li>Vérifiez votre connexion internet</li>
        <li>Actualisez la page (F5)</li>
        <li>Vérifiez que vous êtes connecté à Trimble Connect</li>
        <li>Contactez le support si le problème persiste</li>
      </ul>
      <button 
        onclick="location.reload()" 
        style="
          background: #005F9E;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          margin-top: 20px;
        "
        onmouseover="this.style.background='#004a7c'"
        onmouseout="this.style.background='#005F9E'"
      >
        🔄 Réessayer
      </button>
    </div>
  `;
}

/**
 * Gérer les erreurs globales
 */
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', {
    message: event.error?.message,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason,
  });
});

/**
 * Démarrer l'extension quand le DOM est prêt
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // Le DOM est déjà chargé
  initialize();
}

/**
 * Nettoyer avant de quitter
 */
window.addEventListener('beforeunload', () => {
  logger.info('Extension unloading...');
  // Cleanup si nécessaire
});

// Exporter pour utilisation externe si nécessaire
export { initialize };
