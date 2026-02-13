/**
 * Point d'entrée principal de l'extension Trimble Dashboard
 * Utilise le Workspace API pour s'intégrer dans Trimble Connect
 */

import * as WorkspaceAPI from 'trimble-connect-workspace-api';
import { Dashboard } from './ui/dashboard';
import { logger } from './utils/logger';
import { errorHandler, ErrorCode } from './utils/errorHandler';
import { trimbleClient } from './api/trimbleClient';
import { createWorkspaceAPIAdapter } from './api/workspaceAPIAdapter';
import { authService } from './api/authService';

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
let isStandaloneMode = false;
let isInitialized = false;

/**
 * Détecter si nous sommes en mode standalone (lien direct) ou intégré (iframe Trimble Connect)
 */
function isRunningInTrimbleConnect(): boolean {
  // Si nous sommes dans un iframe, nous sommes dans Trimble Connect
  // (Trimble Connect charge les extensions dans des iframes)
  if (window.self !== window.parent) {
    logger.info('Detected: Running in iframe (Trimble Connect)');
    return true;
  }
  
  // Si pas dans un iframe, c'est un accès direct (standalone)
  logger.info('Detected: Running standalone (direct access)');
  return false;
}

/**
 * Fonction d'initialisation principale
 */
async function initialize(): Promise<void> {
  try {
    logger.info('🚀 Initializing Trimble Dashboard Extension');

    // Détecter le mode d'exécution
    isStandaloneMode = !isRunningInTrimbleConnect();
    
    if (isStandaloneMode) {
      logger.info('🌐 Running in STANDALONE mode (direct link)');
      await initializeStandalone();
    } else {
      logger.info('📦 Running in INTEGRATED mode (Trimble Connect)');
      await initializeIntegrated();
    }

  } catch (error) {
    logger.error('❌ Extension Failed to Load', { error });
    displayInitializationError(error);
  }
}

/**
 * Initialisation en mode standalone (lien direct)
 */
async function initializeStandalone(): Promise<void> {
  logger.info('Checking authentication status...');
  
  // Vérifier si l'utilisateur est authentifié
  const isAuth = await authService.isAuthenticated();
  
  if (!isAuth) {
    // Afficher l'écran de connexion
    logger.info('❌ User not authenticated - showing login screen');
    displayLoginScreen();
    return;
  }
  
  logger.info('✅ User authenticated - loading dashboard');
  
  // Initialiser le TrimbleClient avec les vraies données
  logger.info('Initializing TrimbleClient with API data...');
  await trimbleClient.initialize();
  
  // Créer et afficher le dashboard
  logger.info('Creating dashboard...');
  dashboard = new Dashboard('app', {
    refreshInterval: 0,
    recentFilesThreshold: 48,
    maxRecentFilesDisplay: 10,
    enableAutoRefresh: false,
  });

  // Afficher le dashboard
  await dashboard.render();
  
  logger.info('✅ Extension ready in standalone mode!');
}

/**
 * Initialisation en mode intégré (Trimble Connect)
 */
async function initializeIntegrated(): Promise<void> {
  // Étape 1: Se connecter à Trimble Connect via WorkspaceAPI
  logger.info('Connecting to Trimble Connect Workspace API...');
  
  workspaceAPI = await WorkspaceAPI.connect(
    window.parent,
    handleWorkspaceEvents
  );
  
  logger.info('✓ Connected to Workspace API');

  // Étape 2: Obtenir les infos du projet
  let projectId: string | undefined;
  let projectInfo: any;
  if (workspaceAPI) {
    projectInfo = await workspaceAPI.project.getCurrentProject();
    projectId = projectInfo.id;
    logger.info(`✅ Connected to project: ${projectInfo.name}`, { 
      projectId, 
      projectName: projectInfo.name,
      location: projectInfo.location 
    });

    // Étape 3: Demander l'access token à Trimble Connect
    logger.info('Requesting access token from Trimble Connect...');
    
    try {
      const tokenResponse = await workspaceAPI.extension.requestPermission('accesstoken');
      
      if (tokenResponse === 'pending') {
        logger.info('⏳ Waiting for user consent...');
        // Le token sera reçu via l'événement extension.accessToken
      } else if (tokenResponse === 'denied') {
        logger.error('❌ User denied access token permission');
        displayAuthError('Permission refusée. Veuillez autoriser l\'accès dans les paramètres de l\'extension.');
        return;
      } else {
        // Token reçu directement (l'utilisateur a déjà donné son consentement)
        logger.info('✅ Access token received');
        await initializeWithToken(tokenResponse as string, projectInfo);
      }
    } catch (error) {
      logger.error('❌ Failed to request access token:', error as any);
      displayAuthError('Impossible de récupérer le token d\'authentification.');
    }
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
    title: 'Dashboard',
    icon: 'https://simontrim.github.io/trimble-dashboard/public/icon-white-48.png',
    command: 'show_dashboard',
    subMenus: [
      {
        title: 'Vue d\'ensemble',
        icon: 'https://simontrim.github.io/trimble-dashboard/public/icon-white-48.png',
        command: 'show_overview',
      },
      {
        title: 'Actualiser',
        icon: 'https://simontrim.github.io/trimble-dashboard/public/icon-white-48.png',
        command: 'refresh_data',
      }
    ],
  };

  // Mettre à jour le menu Trimble Connect
  workspaceAPI.ui.setMenu(mainMenuObject);
  logger.info('✓ Sidebar menu created');
  // Ne PAS appeler setActiveMenuItem ici — laisser l'utilisateur naviguer librement
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
      // Token reçu de Trimble Connect (après consentement utilisateur ou refresh)
      logger.info('Access token received from Trimble Connect');
      if (args.data && typeof args.data === 'string' && args.data !== 'pending' && args.data !== 'denied') {
        if (isInitialized) {
          // Dashboard déjà initialisé — juste mettre à jour le token sans re-render
          logger.info('Updating access token (dashboard already initialized)');
          trimbleClient.updateAccessToken(args.data);
        } else {
          // Première initialisation — lancer le dashboard
          getCurrentProjectInfo().then(projectInfo => {
            if (projectInfo) {
              initializeWithToken(args.data, projectInfo);
            }
          });
        }
      }
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

  try {
    logger.info('Showing/refreshing dashboard...');
    await dashboard.render();
    logger.info('✓ Dashboard displayed/refreshed');
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
 * Afficher l'écran de connexion OAuth
 */
function displayLoginScreen(): void {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: linear-gradient(135deg, #005F9E 0%, #004a7c 100%);
      color: white;
      font-family: 'Roboto', sans-serif;
      text-align: center;
      padding: 20px;
    ">
      <div style="
        background: white;
        color: #333;
        border-radius: 12px;
        padding: 40px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        max-width: 500px;
        width: 100%;
      ">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style="margin-bottom: 20px;">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#005F9E"/>
          <path d="M2 17L12 22L22 17" stroke="#005F9E" stroke-width="2" fill="none"/>
          <path d="M2 12L12 17L22 12" stroke="#005F9E" stroke-width="2" fill="none"/>
        </svg>
        
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 16px;
          color: #005F9E;
        ">
          Trimble Connect Dashboard
        </h1>
        
        <p style="
          font-size: 16px;
          color: #666;
          margin-bottom: 32px;
          line-height: 1.6;
        ">
          Connectez-vous avec votre compte Trimble Identity pour accéder à vos données de projet en temps réel.
        </p>
        
        <button 
          id="login-btn"
          style="
            background: #005F9E;
            color: white;
            border: none;
            padding: 16px 48px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,95,158,0.3);
          "
          onmouseover="this.style.background='#004a7c'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,95,158,0.4)'"
          onmouseout="this.style.background='#005F9E'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,95,158,0.3)'"
        >
          🔐 Se connecter avec Trimble ID
        </button>
        
        <div style="
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e0e0e0;
          font-size: 12px;
          color: #999;
        ">
          <p>Sécurisé par OAuth 2.0</p>
          <p style="margin-top: 8px;">Backend: ${(window as any).BACKEND_URL || 'Production'}</p>
        </div>
      </div>
    </div>
  `;

  // Ajouter l'event listener pour le bouton de connexion
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      logger.info('🔐 User clicked login button');
      loginBtn.textContent = '⏳ Redirection...';
      loginBtn.setAttribute('disabled', 'true');
      
      try {
        await authService.login();
      } catch (error) {
        logger.error('❌ Login error:', error as any);
        loginBtn.textContent = '❌ Erreur - Réessayer';
        loginBtn.removeAttribute('disabled');
      }
    });
  }
}

/**
 * Afficher une erreur d'authentification
 */
function displayAuthError(message: string): void {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found');
    return;
  }

  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 20px;
      text-align: center;
      font-family: 'Roboto', sans-serif;
    ">
      <div style="
        background: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        max-width: 500px;
      ">
        <div style="font-size: 60px; margin-bottom: 20px;">🔒</div>
        <h2 style="color: #d32f2f; margin-bottom: 16px;">Erreur d'authentification</h2>
        <p style="color: #666; margin-bottom: 24px;">${message}</p>
        <button 
          onclick="location.reload()" 
          style="
            background: #005F9E;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
          "
        >
          🔄 Réessayer
        </button>
      </div>
    </div>
  `;
}

/**
 * Obtenir les infos du projet actuel
 */
async function getCurrentProjectInfo(): Promise<any> {
  if (!workspaceAPI) {
    logger.error('WorkspaceAPI not initialized');
    return null;
  }
  
  try {
    const projectInfo = await workspaceAPI.project.getCurrentProject();
    return projectInfo;
  } catch (error) {
    logger.error('Failed to get current project', error as any);
    return null;
  }
}

/**
 * Initialiser avec le token reçu de Trimble Connect
 */
async function initializeWithToken(accessToken: string, projectInfo: any): Promise<void> {
  logger.info('Initializing with Trimble Connect token...');
  
  // Créer un adaptateur avec le token
  const apiAdapter = createWorkspaceAPIAdapter({
    workspaceAPI: workspaceAPI as any,
    projectInfo: projectInfo,
    accessToken: accessToken,
    baseUrl: (window as any).BACKEND_URL || 'https://trimble-dashboard.vercel.app'
  });
  
  // Initialiser le client Trimble avec l'adaptateur
  trimbleClient.initializeWithApi(apiAdapter);
  
  // Créer le menu dans le panneau latéral
  createSidebarMenu();
  
  // Créer et afficher le dashboard
  logger.info('Creating dashboard...');
  dashboard = new Dashboard('app', {
    refreshInterval: 0,
    recentFilesThreshold: 48,
    maxRecentFilesDisplay: 10,
    enableAutoRefresh: false,
  });

  await dashboard.render();
  
  isInitialized = true;
  logger.info('✅ Extension ready with Trimble Connect authentication!');
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
