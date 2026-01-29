/**
 * Gestion centralisée des erreurs
 * Fournit des méthodes pour gérer et formater les erreurs
 */
import { AppError } from '../models/types';
/**
 * Codes d'erreur standardisés
 */
export declare enum ErrorCode {
    NETWORK_ERROR = "NETWORK_ERROR",
    API_TIMEOUT = "API_TIMEOUT",
    API_UNAVAILABLE = "API_UNAVAILABLE",
    AUTH_FAILED = "AUTH_FAILED",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    DATA_NOT_FOUND = "DATA_NOT_FOUND",
    DATA_INVALID = "DATA_INVALID",
    DATA_CORRUPTED = "DATA_CORRUPTED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    INITIALIZATION_ERROR = "INITIALIZATION_ERROR"
}
declare class ErrorHandler {
    /**
     * Créer une erreur applicative
     */
    createError(code: ErrorCode, details?: any): AppError;
    /**
     * Gérer une erreur API
     */
    handleApiError(error: any, context: string): AppError;
    /**
     * Retry une opération asynchrone
     */
    retry<T>(operation: () => Promise<T>, maxAttempts?: number, delayMs?: number): Promise<T>;
    /**
     * Utilitaire pour créer un délai
     */
    private delay;
    /**
     * Afficher un message d'erreur à l'utilisateur
     */
    displayError(error: AppError, containerId?: string): void;
    /**
     * Nettoyer les messages d'erreur
     */
    clearErrors(containerId?: string): void;
}
export declare const errorHandler: ErrorHandler;
export {};
//# sourceMappingURL=errorHandler.d.ts.map