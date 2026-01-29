/**
 * Système de logging pour l'extension
 * Permet de tracer les événements et faciliter le débogage
 */
import { LogLevel, LogEntry } from '../models/types';
declare class Logger {
    private logs;
    private readonly maxLogs;
    private isDevelopment;
    constructor();
    /**
     * Log d'information générale
     */
    info(message: string, context?: Record<string, any>): void;
    /**
     * Log d'avertissement
     */
    warn(message: string, context?: Record<string, any>): void;
    /**
     * Log d'erreur
     */
    error(message: string, context?: Record<string, any>): void;
    /**
     * Log de débogage (uniquement en dev)
     */
    debug(message: string, context?: Record<string, any>): void;
    /**
     * Méthode privée pour enregistrer un log
     */
    private log;
    /**
     * Récupérer tous les logs
     */
    getLogs(): LogEntry[];
    /**
     * Récupérer les logs par niveau
     */
    getLogsByLevel(level: LogLevel): LogEntry[];
    /**
     * Nettoyer les logs
     */
    clearLogs(): void;
    /**
     * Exporter les logs au format JSON
     */
    exportLogs(): string;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map