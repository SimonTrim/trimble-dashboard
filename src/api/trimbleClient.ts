/**
 * Client principal pour l'API Trimble Connect
 * Gère la connexion et l'initialisation de l'API
 */

import { logger } from '../utils/logger';
import { errorHandler, ErrorCode } from '../utils/errorHandler';
import { TrimbleConnectWorkspace as MockAPI } from './trimble-api-mock';

// Type pour l'API Trimble Connect (sera importé du package officiel)
export type TrimbleAPI = any;

class TrimbleClient {
  private api: TrimbleAPI | null = null;
  private projectId: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialiser avec une API déjà connectée (pour usage avec WorkspaceAPI)
   */
  initializeWithApi(connectedApi: TrimbleAPI, projectId?: string): void {
    this.api = connectedApi;
    this.projectId = projectId || null;
    this.isInitialized = true;
    logger.info('✓ TrimbleClient initialized with connected API');
  }

  /**
   * Initialiser la connexion avec Trimble Connect
   */
  async initialize(): Promise<TrimbleAPI> {
    if (this.isInitialized && this.api) {
      logger.debug('TrimbleClient already initialized');
      return this.api;
    }

    try {
      logger.info('Initializing Trimble Connect API...');

      // Vérifier si l'API Trimble Connect est disponible (CDN chargé)
      const TrimbleConnectWorkspace = (window as any).TrimbleConnectWorkspace;
      
      if (!TrimbleConnectWorkspace) {
        // Mode développement: utiliser le mock si l'API n'est pas disponible
        logger.warn('⚠️ TrimbleConnectWorkspace not found - Using MOCK data for local testing');
        logger.warn('💡 For real data, load the extension in Trimble Connect');
        
        try {
          // Utiliser le mock importé en haut du fichier
          this.api = await MockAPI.connect();
        } catch (mockError) {
          logger.error('Mock API connection failed, using fallback', { mockError });
          // Même le mock a échoué, créer une API minimale
          this.api = this.createFallbackAPI();
        }
      } else {
        // Mode production: utiliser l'API réelle
        logger.info('✓ TrimbleConnectWorkspace found - Using REAL Trimble Connect API');
        try {
          this.api = await TrimbleConnectWorkspace.connect();
        } catch (realError) {
          logger.error('Real API connection failed, using mock fallback', { realError });
          this.api = await MockAPI.connect();
        }
      }

      // Récupérer les informations du projet (avec gestion d'erreur)
      try {
        const project = await this.api.project.get();
        this.projectId = project.id;
        logger.info(`Connected to project: ${project.name}`, { projectId: project.id });
      } catch (projectError) {
        logger.warn('Could not get project info, using default', { projectError });
        this.projectId = 'default-project-id';
      }

      this.isInitialized = true;
      return this.api;
    } catch (error) {
      logger.error('Failed to initialize Trimble Connect API', { error });
      // Ne pas throw, retourner un fallback à la place
      this.api = this.createFallbackAPI();
      this.projectId = 'fallback-project-id';
      this.isInitialized = true;
      logger.warn('Using fallback API - limited functionality');
      return this.api;
    }
  }

  /**
   * Créer une API de fallback minimale
   */
  private createFallbackAPI(): TrimbleAPI {
    return {
      project: {
        get: async () => ({
          id: 'fallback-id',
          name: 'Mode Hors Ligne',
          description: 'Données de démonstration'
        })
      },
      notes: { getAll: async () => [], get: async () => null },
      bcf: { getTopics: async () => [] },
      files: { getAll: async () => [], getRecent: async () => [] },
      views: { getAll: async () => [], get: async () => null },
    };
  }

  /**
   * Récupérer l'instance de l'API
   */
  getApi(): TrimbleAPI {
    if (!this.api || !this.isInitialized) {
      throw errorHandler.createError(
        ErrorCode.INITIALIZATION_ERROR,
        'API not initialized. Call initialize() first.'
      );
    }
    return this.api;
  }

  /**
   * Récupérer l'ID du projet actuel
   */
  getProjectId(): string {
    if (!this.projectId) {
      throw errorHandler.createError(
        ErrorCode.DATA_NOT_FOUND,
        'Project ID not available'
      );
    }
    return this.projectId;
  }

  /**
   * Vérifier si l'API est initialisée
   */
  isReady(): boolean {
    return this.isInitialized && this.api !== null;
  }

  /**
   * Mettre à jour le token d'accès sans réinitialiser le dashboard
   * Utilisé lors du refresh automatique du token par Trimble Connect
   */
  updateAccessToken(newToken: string): void {
    if (this.api && this.api.updateAccessToken) {
      this.api.updateAccessToken(newToken);
      logger.info('✅ Access token updated silently');
    } else {
      logger.warn('Cannot update token — API does not support updateAccessToken');
    }
  }

  /**
   * Réinitialiser la connexion
   */
  async reconnect(): Promise<TrimbleAPI> {
    logger.warn('Reconnecting to Trimble Connect...');
    this.isInitialized = false;
    this.api = null;
    this.projectId = null;
    return await this.initialize();
  }

  /**
   * Exécuter une opération API avec retry automatique
   */
  async executeWithRetry<T>(
    operation: (api: TrimbleAPI) => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await errorHandler.retry(async () => {
        const api = this.getApi();
        return await operation(api);
      }, 3, 1000);
    } catch (error) {
      logger.error(`API operation failed: ${context}`, { error });
      throw errorHandler.handleApiError(error, context);
    }
  }
}

// Instance singleton
export const trimbleClient = new TrimbleClient();
