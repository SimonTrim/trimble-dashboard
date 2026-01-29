/**
 * Gestion des graphiques avec Chart.js
 */

import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BCFStatusData, FileTrendDataPoint, TRIMBLE_COLORS } from '../models/types';
import { logger } from '../utils/logger';

// Enregistrer tous les composants Chart.js
Chart.register(...registerables);

export class ChartsManager {
  private bcfChart: Chart | null = null;
  private filesChart: Chart | null = null;

  /**
   * Créer le graphique de répartition des BCF (Bar Chart)
   */
  createBCFChart(canvasId: string, data: BCFStatusData): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) {
        logger.error(`Canvas ${canvasId} not found`);
        return;
      }

      // Détruire le graphique existant si présent
      if (this.bcfChart) {
        this.bcfChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        logger.error('Could not get 2D context');
        return;
      }

      const config: ChartConfiguration = {
        type: 'bar',
        data: {
          labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
          datasets: [{
            label: 'Nombre de BCF',
            data: [data.open, data.inProgress, data.resolved, data.closed],
            backgroundColor: [
              TRIMBLE_COLORS.danger,      // Open - Rouge
              TRIMBLE_COLORS.warning,     // In Progress - Jaune
              TRIMBLE_COLORS.secondary,   // Resolved - Bleu clair
              TRIMBLE_COLORS.success,     // Closed - Vert
            ],
            borderColor: [
              TRIMBLE_COLORS.danger,
              TRIMBLE_COLORS.warning,
              TRIMBLE_COLORS.secondary,
              TRIMBLE_COLORS.success,
            ],
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: TRIMBLE_COLORS.dark,
              padding: 12,
              titleColor: '#fff',
              bodyColor: '#fff',
              cornerRadius: 6,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                color: TRIMBLE_COLORS.dark,
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
              },
            },
            x: {
              ticks: {
                color: TRIMBLE_COLORS.dark,
              },
              grid: {
                display: false,
              },
            },
          },
          animation: {
            duration: 1000,
            easing: 'easeInOutQuart',
          },
        },
      };

      this.bcfChart = new Chart(ctx, config);
      logger.info('BCF chart created successfully');
    } catch (error) {
      logger.error('Error creating BCF chart', { error });
    }
  }

  /**
   * Créer le graphique de tendance des fichiers (Line Chart)
   */
  createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) {
        logger.error(`Canvas ${canvasId} not found`);
        return;
      }

      // Détruire le graphique existant si présent
      if (this.filesChart) {
        this.filesChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        logger.error('Could not get 2D context');
        return;
      }

      const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      });
      const counts = data.map(d => d.count);

      const config: ChartConfiguration = {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Fichiers uploadés',
            data: counts,
            borderColor: TRIMBLE_COLORS.primary,
            backgroundColor: `${TRIMBLE_COLORS.primary}20`, // 20 = transparence en hex
            borderWidth: 3,
            fill: true,
            tension: 0.4, // Courbe lisse
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: TRIMBLE_COLORS.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: TRIMBLE_COLORS.dark,
              padding: 12,
              titleColor: '#fff',
              bodyColor: '#fff',
              cornerRadius: 6,
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y ?? 0;
                  return `${value} fichier${value > 1 ? 's' : ''}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                color: TRIMBLE_COLORS.dark,
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
              },
            },
            x: {
              ticks: {
                color: TRIMBLE_COLORS.dark,
              },
              grid: {
                display: false,
              },
            },
          },
          animation: {
            duration: 1000,
            easing: 'easeInOutQuart',
          },
        },
      };

      this.filesChart = new Chart(ctx, config);
      logger.info('Files trend chart created successfully');
    } catch (error) {
      logger.error('Error creating files trend chart', { error });
    }
  }

  /**
   * Mettre à jour le graphique BCF avec de nouvelles données
   */
  updateBCFChart(data: BCFStatusData): void {
    if (!this.bcfChart) {
      logger.warn('BCF chart not initialized');
      return;
    }

    this.bcfChart.data.datasets[0].data = [
      data.open,
      data.inProgress,
      data.resolved,
      data.closed,
    ];
    this.bcfChart.update('active');
    logger.debug('BCF chart updated');
  }

  /**
   * Mettre à jour le graphique de tendance avec de nouvelles données
   */
  updateFilesTrendChart(data: FileTrendDataPoint[]): void {
    if (!this.filesChart) {
      logger.warn('Files trend chart not initialized');
      return;
    }

    const labels = data.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    });
    const counts = data.map(d => d.count);

    this.filesChart.data.labels = labels;
    this.filesChart.data.datasets[0].data = counts;
    this.filesChart.update('active');
    logger.debug('Files trend chart updated');
  }

  /**
   * Détruire tous les graphiques
   */
  destroy(): void {
    if (this.bcfChart) {
      this.bcfChart.destroy();
      this.bcfChart = null;
    }
    if (this.filesChart) {
      this.filesChart.destroy();
      this.filesChart = null;
    }
    logger.info('All charts destroyed');
  }
}
