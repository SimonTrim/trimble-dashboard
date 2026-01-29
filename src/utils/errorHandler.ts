/**
 * Gestion centralisée des erreurs
 * Fournit des méthodes pour gérer et formater les erreurs
 */

import { AppError } from '../models/types';
import { logger } from './logger';

/**
 * Codes d'erreur standardisés
 */
export enum ErrorCode {
  // Erreurs réseau
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_UNAVAILABLE = 'API_UNAVAILABLE',

  // Erreurs d'authentification
  AUTH_FAILED = 'AUTH_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Erreurs de données
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_INVALID = 'DATA_INVALID',
  DATA_CORRUPTED = 'DATA_CORRUPTED',

  // Erreurs générales
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
}

/**
 * Messages d'erreur utilisateur (en français)
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Erreur de connexion réseau. Vérifiez votre connexion internet.',
  [ErrorCode.API_TIMEOUT]: 'Le serveur met trop de temps à répondre. Veuillez réessayer.',
  [ErrorCode.API_UNAVAILABLE]: 'Le service Trimble Connect est temporairement indisponible.',
  [ErrorCode.AUTH_FAILED]: 'Échec de l\'authentification. Veuillez vous reconnecter.',
  [ErrorCode.PERMISSION_DENIED]: 'Vous n\'avez pas les permissions nécessaires pour cette action.',
  [ErrorCode.DATA_NOT_FOUND]: 'Les données demandées sont introuvables.',
  [ErrorCode.DATA_INVALID]: 'Les données reçues sont invalides.',
  [ErrorCode.DATA_CORRUPTED]: 'Les données sont corrompues ou incomplètes.',
  [ErrorCode.UNKNOWN_ERROR]: 'Une erreur inattendue s\'est produite.',
  [ErrorCode.INITIALIZATION_ERROR]: 'Erreur lors de l\'initialisation de l\'extension.',
};

class ErrorHandler {
  /**
   * Créer une erreur applicative
   */
  createError(code: ErrorCode, details?: any): AppError {
    const error: AppError = {
      code,
      message: ERROR_MESSAGES[code],
      details,
      timestamp: new Date(),
    };

    logger.error(`Error: ${code}`, { details });
    return error;
  }

  /**
   * Gérer une erreur API
   */
  handleApiError(error: any, context: string): AppError {
    logger.error(`API Error in ${context}`, { error });

    // Déterminer le type d'erreur
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return this.createError(ErrorCode.API_TIMEOUT, error);
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return this.createError(ErrorCode.PERMISSION_DENIED, error);
    }

    if (error.response?.status === 404) {
      return this.createError(ErrorCode.DATA_NOT_FOUND, error);
    }

    if (error.code === 'ERR_NETWORK' || !navigator.onLine) {
      return this.createError(ErrorCode.NETWORK_ERROR, error);
    }

    return this.createError(ErrorCode.UNKNOWN_ERROR, error);
  }

  /**
   * Retry une opération asynchrone
   */
  async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxAttempts}`);
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed`, { error });

        if (attempt < maxAttempts) {
          // Attendre avant de réessayer
          await this.delay(delayMs * attempt); // Backoff exponentiel
        }
      }
    }

    throw lastError;
  }

  /**
   * Utilitaire pour créer un délai
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Afficher un message d'erreur à l'utilisateur
   */
  displayError(error: AppError, containerId: string = 'error-container'): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Error container not found');
      return;
    }

    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <strong>Erreur:</strong> ${error.message}
        <button type="button" class="close" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    `;

    // Auto-fermeture après 5 secondes
    setTimeout(() => {
      container.innerHTML = '';
    }, 5000);
  }

  /**
   * Nettoyer les messages d'erreur
   */
  clearErrors(containerId: string = 'error-container'): void {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }
}

// Instance singleton
export const errorHandler = new ErrorHandler();
