/**
 * Charts Manager — shadcn/ui inspired charts with Chart.js
 * Dark area chart, modern doughnuts, clean bar charts
 */

import { Chart, registerables } from 'chart.js';
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
import { logger } from '../utils/logger';

Chart.register(...registerables);

const COLORS = {
  primary: '#0063a3',
  primaryLight: 'rgba(0, 99, 163, 0.15)',
  danger: '#ef4444',
  warning: '#f59e0b',
  blue: '#3b82f6',
  success: '#10b981',
  accent: '#6366f1',
  muted: '#71717a',
  gridLight: 'rgba(0, 0, 0, 0.04)',
  gridDark: 'rgba(255, 255, 255, 0.06)',
  dark: '#09090b',
  darkMuted: '#a1a1aa',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  ifc: '#0063a3', pdf: '#ef4444', dwg: '#f59e0b', rvt: '#10b981',
  nwd: '#8b5cf6', nwc: '#a855f7', trb: '#06b6d4',
  jpg: '#ec4899', jpeg: '#ec4899', png: '#f97316',
  mp4: '#14b8a6', xlsx: '#6366f1', xls: '#6366f1',
  docx: '#3b82f6', doc: '#3b82f6', zip: '#71717a', rar: '#71717a',
};

const DEFAULT_FILE_COLOR = '#a1a1aa';

const tooltipStyle = {
  backgroundColor: 'rgba(9, 9, 11, 0.95)',
  padding: 12,
  titleColor: '#fafafa',
  bodyColor: '#d4d4d8',
  cornerRadius: 8,
  titleFont: { size: 13, weight: 'bold' as const },
  bodyFont: { size: 12, weight: 'normal' as const },
  displayColors: true,
  boxPadding: 4,
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
};

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { tooltip: tooltipStyle },
  animation: { duration: 700, easing: 'easeOutQuart' as const },
};

export class ChartsManager {
  private bcfChart: Chart | null = null;
  private filesChart: Chart | null = null;
  private fileTypeChart: Chart | null = null;
  private bcfPriorityChart: Chart | null = null;

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
            backgroundColor: [COLORS.danger, COLORS.warning, COLORS.blue, COLORS.success],
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.55,
          }],
        },
        options: {
          ...baseOpts,
          plugins: {
            ...baseOpts.plugins,
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: COLORS.muted, font: { size: 11 } },
              grid: { color: COLORS.gridLight },
              border: { display: false },
            },
            x: {
              ticks: { color: COLORS.muted, font: { size: 11, weight: 'bold' as const } },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error creating BCF chart', { error });
    }
  }

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
            backgroundColor: [COLORS.danger, COLORS.warning, COLORS.success],
            borderWidth: 0,
            spacing: 3,
          }],
        },
        options: {
          ...baseOpts,
          cutout: '68%',
          plugins: {
            ...baseOpts.plugins,
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { size: 12, weight: 'normal' as const },
                color: COLORS.muted,
              },
            },
            tooltip: {
              ...tooltipStyle,
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
    } catch (error) {
      logger.error('Error creating BCF priority chart', { error });
    }
  }

  /**
   * Dark-themed area chart (shadcn "Total Visitors" style)
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

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.filesChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Fichiers',
            data: data.map(d => d.count),
            borderColor: 'rgba(255, 255, 255, 0.8)',
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
          }],
        },
        options: {
          ...baseOpts,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            ...baseOpts.plugins,
            legend: { display: false },
            tooltip: {
              ...tooltipStyle,
              backgroundColor: 'rgba(39, 39, 42, 0.95)',
              callbacks: {
                label: (context) => {
                  const v = context.parsed.y ?? 0;
                  return ` ${v} fichier${v > 1 ? 's' : ''} uploadé${v > 1 ? 's' : ''}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              display: false,
            },
            x: {
              ticks: {
                color: COLORS.darkMuted,
                font: { size: 11 },
                maxRotation: 0,
              },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error creating files trend chart', { error });
    }
  }

  createFileTypeChart(canvasId: string, byExtension: Record<string, number>): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      if (this.fileTypeChart) this.fileTypeChart.destroy();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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
            spacing: 3,
          }],
        },
        options: {
          ...baseOpts,
          cutout: '62%',
          plugins: {
            ...baseOpts.plugins,
            legend: {
              position: 'right',
              labels: {
                padding: 14,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { size: 12, weight: 'normal' as const },
                color: COLORS.muted,
              },
            },
            tooltip: {
              ...tooltipStyle,
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
    } catch (error) {
      logger.error('Error creating file type chart', { error });
    }
  }

  destroy(): void {
    [this.bcfChart, this.filesChart, this.fileTypeChart, this.bcfPriorityChart].forEach(chart => {
      if (chart) chart.destroy();
    });
    this.bcfChart = null;
    this.filesChart = null;
    this.fileTypeChart = null;
    this.bcfPriorityChart = null;
  }
}
