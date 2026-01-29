/**
 * Composant Dashboard principal
 * Gère l'affichage et le rafraîchissement des données
 */

import { DashboardMetrics, DashboardConfig, ProjectFile } from '../models/types';
import { notesService } from '../api/notesService';
import { bcfService } from '../api/bcfService';
import { filesService } from '../api/filesService';
import { viewsService } from '../api/viewsService';
import { ChartsManager } from './charts';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import './styles.css';

export class Dashboard {
  private chartsManager: ChartsManager;
  private config: DashboardConfig;
  private refreshInterval: number | null = null;
  private containerId: string;

  constructor(containerId: string = 'app', config?: Partial<DashboardConfig>) {
    this.containerId = containerId;
    this.chartsManager = new ChartsManager();
    
    // Configuration par défaut
    this.config = {
      refreshInterval: 30000, // 30 secondes
      recentFilesThreshold: 48, // 48 heures
      maxRecentFilesDisplay: 10,
      enableAutoRefresh: true,
      ...config,
    };

    logger.info('Dashboard initialized', this.config);
  }

  /**
   * Initialiser et afficher le dashboard
   */
  async render(): Promise<void> {
    try {
      const container = document.getElementById(this.containerId);
      if (!container) {
        throw new Error(`Container #${this.containerId} not found`);
      }

      // Créer la structure HTML
      container.innerHTML = this.getTemplate();

      // Charger les données
      await this.loadData();

      // Démarrer le rafraîchissement automatique
      if (this.config.enableAutoRefresh) {
        this.startAutoRefresh();
      }

      logger.info('Dashboard rendered successfully');
    } catch (error) {
      logger.error('Error rendering dashboard', { error });
      errorHandler.displayError(
        errorHandler.createError('INITIALIZATION_ERROR' as any, error),
        'error-container'
      );
    }
  }

  /**
   * Charger toutes les données du dashboard
   */
  private async loadData(): Promise<void> {
    this.showLoader();

    try {
      // Charger les métriques en parallèle
      const [notesCount, bcfCount, recentFilesCount, viewsCount] = await Promise.all([
        notesService.countActiveNotes(),
        bcfService.countActiveTopics(),
        filesService.countRecentFiles(this.config.recentFilesThreshold),
        viewsService.countViews(),
      ]);

      // Afficher les métriques
      this.updateMetrics({
        activeNotes: notesCount,
        activeBCF: bcfCount,
        recentFiles: recentFilesCount,
        totalViews: viewsCount,
      });

      // Charger les graphiques
      await this.loadCharts();

      // Charger le tableau des fichiers
      await this.loadFilesTable();

      this.hideLoader();
      logger.info('Dashboard data loaded successfully');
    } catch (error) {
      this.hideLoader();
      logger.error('Error loading dashboard data', { error });
      errorHandler.displayError(
        errorHandler.handleApiError(error, 'loadData'),
        'error-container'
      );
    }
  }

  /**
   * Mettre à jour les cartes de métriques
   */
  private updateMetrics(metrics: DashboardMetrics): void {
    this.updateMetricCard('notes-count', metrics.activeNotes);
    this.updateMetricCard('bcf-count', metrics.activeBCF);
    this.updateMetricCard('files-count', metrics.recentFiles);
    this.updateMetricCard('views-count', metrics.totalViews);

    logger.debug('Metrics updated', metrics);
  }

  /**
   * Mettre à jour une carte métrique individuelle
   */
  private updateMetricCard(elementId: string, value: number): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value.toString();
    }
  }

  /**
   * Charger les graphiques
   */
  private async loadCharts(): Promise<void> {
    try {
      // Graphique BCF
      const bcfData = await bcfService.getStatusDistribution();
      this.chartsManager.createBCFChart('bcf-chart', bcfData);

      // Graphique de tendance des fichiers
      const filesTrend = await filesService.getFileTrend(7);
      this.chartsManager.createFilesTrendChart('files-chart', filesTrend);

      logger.debug('Charts loaded successfully');
    } catch (error) {
      logger.error('Error loading charts', { error });
    }
  }

  /**
   * Charger le tableau des fichiers récents
   */
  private async loadFilesTable(): Promise<void> {
    try {
      const files = await filesService.getLastUploadedFiles(this.config.maxRecentFilesDisplay);
      
      const tbody = document.getElementById('files-table-body');
      if (!tbody) return;

      if (files.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" class="text-center">Aucun fichier récent</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = files.map(file => this.getFileRowTemplate(file)).join('');
      logger.debug(`Files table loaded with ${files.length} files`);
    } catch (error) {
      logger.error('Error loading files table', { error });
    }
  }

  /**
   * Template HTML pour une ligne de fichier
   */
  private getFileRowTemplate(file: ProjectFile): string {
    const icon = this.getFileIcon(file.extension);
    const date = new Date(file.uploadedAt);
    const dateStr = this.formatRelativeDate(date);

    return `
      <tr>
        <td>
          <span class="file-icon">${icon}</span>
          <a href="#" class="file-name" title="${file.name}">${file.name}</a>
        </td>
        <td class="file-date">${dateStr}</td>
        <td>${file.uploadedBy}</td>
      </tr>
    `;
  }

  /**
   * Obtenir l'icône selon l'extension du fichier
   */
  private getFileIcon(extension: string): string {
    const icons: Record<string, string> = {
      'ifc': '🏗️',
      'pdf': '📄',
      'dwg': '📐',
      'rvt': '🏢',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'xlsx': '📊',
      'docx': '📝',
      'zip': '📦',
    };
    return icons[extension.toLowerCase()] || '📎';
  }

  /**
   * Formater une date relative (ex: "il y a 2 heures")
   */
  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `il y a ${diffMins} min`;
    } else if (diffHours < 24) {
      return `il y a ${diffHours}h`;
    } else if (diffDays < 7) {
      return `il y a ${diffDays}j`;
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  }

  /**
   * Démarrer le rafraîchissement automatique
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = window.setInterval(() => {
      logger.debug('Auto-refreshing dashboard...');
      this.loadData();
    }, this.config.refreshInterval);

    logger.info(`Auto-refresh enabled (interval: ${this.config.refreshInterval}ms)`);
  }

  /**
   * Arrêter le rafraîchissement automatique
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.info('Auto-refresh disabled');
    }
  }

  /**
   * Afficher le loader
   */
  private showLoader(): void {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.display = 'flex';
    }
  }

  /**
   * Masquer le loader
   */
  private hideLoader(): void {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }

  /**
   * Template HTML du dashboard
   */
  private getTemplate(): string {
    return `
      <div class="dashboard-container">
        <!-- Header -->
        <div class="dashboard-header">
          <h1>🏠 Project Dashboard</h1>
          <p>Vue d'ensemble de votre projet Trimble Connect</p>
        </div>

        <!-- Conteneur d'erreurs -->
        <div id="error-container"></div>

        <!-- Loader -->
        <div id="loader" class="loader-container" style="display: none;">
          <div class="spinner"></div>
        </div>

        <!-- Cartes de métriques -->
        <div class="metrics-grid">
          <div class="metric-card notes">
            <div class="metric-label">Notes Actives</div>
            <div class="metric-value" id="notes-count">0</div>
            <div class="metric-description">Notes non archivées</div>
          </div>
          
          <div class="metric-card bcf">
            <div class="metric-label">BCF En Cours</div>
            <div class="metric-value" id="bcf-count">0</div>
            <div class="metric-description">Topics non fermés</div>
          </div>
          
          <div class="metric-card files">
            <div class="metric-label">Fichiers Récents</div>
            <div class="metric-value" id="files-count">0</div>
            <div class="metric-description">Dernières ${this.config.recentFilesThreshold}h</div>
          </div>
          
          <div class="metric-card views">
            <div class="metric-label">Vues Créées</div>
            <div class="metric-value" id="views-count">0</div>
            <div class="metric-description">Vues sauvegardées</div>
          </div>
        </div>

        <!-- Graphiques -->
        <div class="charts-grid">
          <div class="chart-card">
            <h3>📊 Répartition des BCF</h3>
            <div class="chart-container">
              <canvas id="bcf-chart"></canvas>
            </div>
          </div>
          
          <div class="chart-card">
            <h3>📈 Tendance des Fichiers (7 jours)</h3>
            <div class="chart-container">
              <canvas id="files-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Tableau des fichiers récents -->
        <div class="files-table-container">
          <h3>📁 Fichiers Récents</h3>
          <table class="files-table">
            <thead>
              <tr>
                <th>Nom du fichier</th>
                <th>Date</th>
                <th>Auteur</th>
              </tr>
            </thead>
            <tbody id="files-table-body">
              <tr>
                <td colspan="3" class="text-center">Chargement...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Nettoyer et détruire le dashboard
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.chartsManager.destroy();
    logger.info('Dashboard destroyed');
  }
}
