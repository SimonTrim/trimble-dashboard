/**
 * Système de logging pour l'extension
 * Permet de tracer les événements et faciliter le débogage
 */

import { LogLevel, LogEntry } from '../models/types';

class Logger {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000;
  private isDevelopment: boolean;

  constructor() {
    // Active les logs en mode développement
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Log d'information générale
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log d'avertissement
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
    console.warn(`⚠️ ${message}`, context);
  }

  /**
   * Log d'erreur
   */
  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
    console.error(`❌ ${message}`, context);
  }

  /**
   * Log de débogage (uniquement en dev)
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
      console.debug(`🔍 ${message}`, context);
    }
  }

  /**
   * Méthode privée pour enregistrer un log
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    };

    this.logs.push(entry);

    // Limiter la taille du tableau de logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Afficher dans la console en développement
    if (this.isDevelopment && level === 'info') {
      console.log(`ℹ️ ${message}`, context || '');
    }
  }

  /**
   * Récupérer tous les logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Récupérer les logs par niveau
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Nettoyer les logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info('Logs cleared');
  }

  /**
   * Exporter les logs au format JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Instance singleton
export const logger = new Logger();
