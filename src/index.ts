/**
 * Point d'entrée principal de l'extension Trimble Dashboard
 * Initialise l'extension et lance le dashboard
 */

import { trimbleClient } from './api/trimbleClient';
import { Dashboard } from './ui/dashboard';
import { logger } from './utils/logger';
import { errorHandler, ErrorCode } from './utils/errorHandler';

/**
 * Fonction d'initialisation principale
 */
async function initialize(): Promise<void> {
  try {
    logger.info('=== Trimble Dashboard Extension Starting ===');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Vérifier si l'API Trimble est disponible
    const isTrimbleAPIAvailable = typeof (window as any).TrimbleConnectWorkspace !== 'undefined';
    
    if (!isTrimbleAPIAvailable) {
      logger.warn('🧪 MODE TEST LOCAL - API Trimble non disponible');
      logger.warn('📊 Utilisation de données de démonstration (Mock)');
      logger.warn('💡 Pour les vraies données, chargez l\'extension dans Trimble Connect');
    }

    // Étape 1: Initialiser la connexion à Trimble Connect
    logger.info('Step 1: Connecting to Trimble Connect API...');
    await trimbleClient.initialize();
    logger.info('✓ Connected to Trimble Connect');

    // Étape 2: Créer et afficher le dashboard
    logger.info('Step 2: Initializing dashboard...');
    const dashboard = new Dashboard('app', {
      refreshInterval: 30000,        // 30 secondes
      recentFilesThreshold: 48,      // 48 heures
      maxRecentFilesDisplay: 10,     // 10 fichiers max
      enableAutoRefresh: true,
    });

    await dashboard.render();
    logger.info('✓ Dashboard rendered successfully');

    logger.info('=== Extension Loaded Successfully ===');

    // Exposer le dashboard globalement pour le débogage (uniquement en dev)
    if (process.env.NODE_ENV !== 'production') {
      (window as any).trimbleDashboard = {
        dashboard,
        trimbleClient,
        logger,
      };
      logger.debug('Debug objects exposed on window.trimbleDashboard');
    }

  } catch (error) {
    logger.error('=== Extension Failed to Load ===', { error });
    
    // Afficher un message d'erreur à l'utilisateur
    displayInitializationError(error);
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
