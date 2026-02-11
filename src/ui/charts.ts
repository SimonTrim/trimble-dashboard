/**
 * Gestion des graphiques avec Chart.js
 * shadcn-inspired color scheme + Trimble branding
 */

import { Chart, registerables } from 'chart.js';
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
import { logger } from '../utils/logger';

// Enregistrer tous les composants Chart.js
Chart.register(...registerables);

// shadcn-inspired chart colors
const CHART_COLORS = {
  primary: '#005F9E',
  primaryLight: '#005F9E20',
  danger: '#ef4444',
  warning: '#f59e0b',
  blue: '#3b82f6',
  success: '#22c55e',
  dark: '#0f172a',
  muted: '#64748b',
  gridLine: 'rgba(0, 0, 0, 0.04)',
  border: '#e2e8f0',
};

// File type colors (muted, professional palette)
const FILE_TYPE_COLORS: Record<string, string> = {
  ifc: '#005F9E',
  pdf: '#ef4444',
  dwg: '#f59e0b',
  rvt: '#22c55e',
  nwd: '#8b5cf6',
  nwc: '#a855f7',
  trb: '#06b6d4',
  jpg: '#ec4899',
  jpeg: '#ec4899',
  png: '#f97316',
  mp4: '#14b8a6',
  xlsx: '#6366f1',
  xls: '#6366f1',
  docx: '#3b82f6',
  doc: '#3b82f6',
  zip: '#64748b',
  rar: '#64748b',
};

const DEFAULT_FILE_COLOR = '#94a3b8';

// Shared chart options for consistent look
const sharedOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      backgroundColor: CHART_COLORS.dark,
      padding: 10,
      titleColor: '#fff',
      bodyColor: '#fff',
      cornerRadius: 8,
      titleFont: { size: 12, weight: 'bold' as const },
      bodyFont: { size: 12 },
      displayColors: true,
      boxPadding: 4,
    },
  },
  animation: { duration: 800, easing: 'easeOutQuart' as const },
};

export class ChartsManager {
  private bcfChart: Chart | null = null;
  private filesChart: Chart | null = null;
  private fileTypeChart: Chart | null = null;
  private bcfPriorityChart: Chart | null = null;

  /**
   * Créer le graphique de répartition des BCF par statut (Bar Chart)
   */
  createBCFChart(canvasId: string, data: BCFStatusData): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      if (this.bcfChart) this.bcfChart.destroy();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      this.bcfChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
          datasets: [{
            label: 'Topics',
            data: [data.open, data.inProgress, data.resolved, data.closed],
            backgroundColor: [
              CHART_COLORS.danger,
              CHART_COLORS.warning,
              CHART_COLORS.blue,
              CHART_COLORS.success,
            ],
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.6,
          }],
        },
        options: {
          ...sharedOptions,
          plugins: {
            ...sharedOptions.plugins,
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: CHART_COLORS.muted, font: { size: 11 } },
              grid: { color: CHART_COLORS.gridLine },
              border: { display: false },
            },
            x: {
              ticks: { color: CHART_COLORS.muted, font: { size: 11 } },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      });
      logger.debug('BCF status chart created');
    } catch (error) {
      logger.error('Error creating BCF chart', { error });
    }
  }

  /**
   * Créer le graphique de priorité BCF (Doughnut)
   */
  createBCFPriorityChart(canvasId: string, data: BCFPriorityData): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      if (this.bcfPriorityChart) this.bcfPriorityChart.destroy();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const total = data.high + data.medium + data.low;

      this.bcfPriorityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Haute', 'Moyenne', 'Basse'],
          datasets: [{
            data: [data.high, data.medium, data.low],
            backgroundColor: [CHART_COLORS.danger, CHART_COLORS.warning, CHART_COLORS.success],
            borderWidth: 0,
            spacing: 2,
          }],
        },
        options: {
          ...sharedOptions,
          cutout: '65%',
          plugins: {
            ...sharedOptions.plugins,
            legend: {
              position: 'bottom',
              labels: {
                padding: 16,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { size: 11, weight: 'normal' as const },
                color: CHART_COLORS.muted,
              },
            },
            tooltip: {
              ...sharedOptions.plugins.tooltip,
              callbacks: {
                label: (ctx: any) => {
                  const value = ctx.parsed;
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return ` ${ctx.label}: ${value} (${pct}%)`;
                },
              },
            },
          },
        },
      });
      logger.debug('BCF priority chart created');
    } catch (error) {
      logger.error('Error creating BCF priority chart', { error });
    }
  }

  /**
   * Créer le graphique de tendance des fichiers (Line Chart - area)
   */
  createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      if (this.filesChart) this.filesChart.destroy();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      });

      this.filesChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Fichiers',
            data: data.map(d => d.count),
            borderColor: CHART_COLORS.primary,
            backgroundColor: CHART_COLORS.primaryLight,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: CHART_COLORS.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }],
        },
        options: {
          ...sharedOptions,
          plugins: {
            ...sharedOptions.plugins,
            legend: { display: false },
            tooltip: {
              ...sharedOptions.plugins.tooltip,
              callbacks: {
                label: (context) => {
                  const v = context.parsed.y ?? 0;
                  return ` ${v} fichier${v > 1 ? 's' : ''}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: CHART_COLORS.muted, font: { size: 11 } },
              grid: { color: CHART_COLORS.gridLine },
              border: { display: false },
            },
            x: {
              ticks: { color: CHART_COLORS.muted, font: { size: 11 } },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      });
      logger.debug('Files trend chart created');
    } catch (error) {
      logger.error('Error creating files trend chart', { error });
    }
  }

  /**
   * Créer le graphique de distribution des types de fichiers (Doughnut)
   */
  createFileTypeChart(canvasId: string, byExtension: Record<string, number>): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      if (this.fileTypeChart) this.fileTypeChart.destroy();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Sort by count descending, keep top 8, group rest as "Autres"
      const entries = Object.entries(byExtension).sort((a, b) => b[1] - a[1]);
      const topEntries = entries.slice(0, 8);
      const otherCount = entries.slice(8).reduce((sum, [, count]) => sum + count, 0);

      const labels = topEntries.map(([ext]) => ext.toUpperCase());
      const counts = topEntries.map(([, count]) => count);
      const colors = topEntries.map(([ext]) => FILE_TYPE_COLORS[ext.toLowerCase()] || DEFAULT_FILE_COLOR);

      if (otherCount > 0) {
        labels.push('Autres');
        counts.push(otherCount);
        colors.push(DEFAULT_FILE_COLOR);
      }

      const total = counts.reduce((s, c) => s + c, 0);

      this.fileTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderWidth: 0,
            spacing: 2,
          }],
        },
        options: {
          ...sharedOptions,
          cutout: '60%',
          plugins: {
            ...sharedOptions.plugins,
            legend: {
              position: 'right',
              labels: {
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { size: 11, weight: 'normal' as const },
                color: CHART_COLORS.muted,
              },
            },
            tooltip: {
              ...sharedOptions.plugins.tooltip,
              callbacks: {
                label: (ctx: any) => {
                  const value = ctx.parsed;
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return ` ${ctx.label}: ${value} (${pct}%)`;
                },
              },
            },
          },
        },
      });
      logger.debug('File type chart created');
    } catch (error) {
      logger.error('Error creating file type chart', { error });
    }
  }

  /**
   * Détruire tous les graphiques
   */
  destroy(): void {
    [this.bcfChart, this.filesChart, this.fileTypeChart, this.bcfPriorityChart].forEach(chart => {
      if (chart) chart.destroy();
    });
    this.bcfChart = null;
    this.filesChart = null;
    this.fileTypeChart = null;
    this.bcfPriorityChart = null;
    logger.debug('All charts destroyed');
  }
}
