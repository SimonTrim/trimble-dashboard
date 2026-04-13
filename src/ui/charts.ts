/**
 * Charts Manager — Chart.js charts with dark/light theme support
 * Area, bar, doughnut, line, horizontal bar charts
 */

import { Chart, registerables } from 'chart.js';
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
import { logger } from '../utils/logger';

Chart.register(...registerables);

function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function themeColors() {
  const dark = isDark();
  return {
    text: dark ? '#e2e8f0' : '#09090b',
    muted: dark ? '#94a3b8' : '#71717a',
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    tooltipBg: dark ? 'rgba(15,23,42,0.95)' : 'rgba(9,9,11,0.95)',
  };
}

const COLORS = {
  primary: '#0063a3',
  primaryLight: 'rgba(0, 99, 163, 0.15)',
  danger: '#ef4444',
  warning: '#f59e0b',
  blue: '#3b82f6',
  success: '#10b981',
  accent: '#6366f1',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  orange: '#f97316',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  ifc: '#0063a3', pdf: '#ef4444', dwg: '#f59e0b', rvt: '#10b981',
  nwd: '#8b5cf6', nwc: '#a855f7', trb: '#06b6d4',
  jpg: '#ec4899', jpeg: '#ec4899', png: '#f97316',
  mp4: '#14b8a6', xlsx: '#6366f1', xls: '#6366f1',
  docx: '#3b82f6', doc: '#3b82f6', zip: '#71717a', rar: '#71717a',
  html: '#f97316', txt: '#71717a', mne: '#0ea5e9',
};

const DEFAULT_FILE_COLOR = '#a1a1aa';

function getTooltipStyle() {
  const tc = themeColors();
  return {
    backgroundColor: tc.tooltipBg,
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
}

function getBaseOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { tooltip: getTooltipStyle() },
    animation: { duration: 700, easing: 'easeOutQuart' as const },
  };
}

export class ChartsManager {
  private charts: Map<string, Chart> = new Map();

  private destroyChart(key: string): void {
    const c = this.charts.get(key);
    if (c) { c.destroy(); this.charts.delete(key); }
  }

  private setChart(key: string, chart: Chart): void {
    this.charts.set(key, chart);
  }

  createBCFChart(canvasId: string, data: BCFStatusData): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('bcf');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const chart = new Chart(ctx, {
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
          ...getBaseOpts(),
          plugins: { ...getBaseOpts().plugins, legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 11, weight: 'bold' as const } }, grid: { display: false }, border: { display: false } },
          },
        },
      });
      this.setChart('bcf', chart);
    } catch (error) { logger.error('Error creating BCF chart', { error }); }
  }

  createBCFPriorityChart(canvasId: string, data: BCFPriorityData): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('bcfPriority');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const total = data.high + data.medium + data.low;
      const tc = themeColors();

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Haute', 'Moyenne', 'Basse'],
          datasets: [{ data: [data.high, data.medium, data.low], backgroundColor: [COLORS.danger, COLORS.warning, COLORS.success], borderWidth: 0, spacing: 3 }],
        },
        options: {
          ...getBaseOpts(), cutout: '68%',
          plugins: {
            ...getBaseOpts().plugins,
            legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle', font: { size: 12 }, color: tc.muted } },
            tooltip: { ...getTooltipStyle(), callbacks: { label: (ctx: any) => { const v = ctx.parsed; const pct = total > 0 ? Math.round((v / total) * 100) : 0; return ` ${ctx.label}: ${v} (${pct}%)`; } } },
          },
        },
      });
      this.setChart('bcfPriority', chart);
    } catch (error) { logger.error('Error creating BCF priority chart', { error }); }
  }

  createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('filesTrend');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      });

      const lineColor = isDark() ? 'rgba(14, 165, 233, 0.9)' : 'rgba(0, 99, 163, 0.9)';
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
      if (isDark()) {
        gradient.addColorStop(0, 'rgba(14, 165, 233, 0.25)');
        gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(0, 99, 163, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 99, 163, 0)');
      }

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Fichiers',
            data: data.map(d => d.count),
            borderColor: lineColor,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: lineColor,
            pointHoverBorderColor: lineColor,
            pointHoverBorderWidth: 2,
          }],
        },
        options: {
          ...getBaseOpts(),
          interaction: { mode: 'index', intersect: false },
          plugins: { ...getBaseOpts().plugins, legend: { display: false } },
          scales: {
            y: { beginAtZero: true, display: false },
            x: { ticks: { color: tc.muted, font: { size: 11 }, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
          },
        },
      });
      this.setChart('filesTrend', chart);
    } catch (error) { logger.error('Error creating files trend chart', { error }); }
  }

  createFileTypeChart(canvasId: string, byExtension: Record<string, number>): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('fileType');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const entries = Object.entries(byExtension).sort((a, b) => b[1] - a[1]);
      const topEntries = entries.slice(0, 10);
      const otherCount = entries.slice(10).reduce((sum, [, count]) => sum + count, 0);

      const labels = topEntries.map(([ext]) => ext.toUpperCase());
      const counts = topEntries.map(([, count]) => count);
      const colors = topEntries.map(([ext]) => FILE_TYPE_COLORS[ext.toLowerCase()] || DEFAULT_FILE_COLOR);

      if (otherCount > 0) { labels.push('Autres'); counts.push(otherCount); colors.push(DEFAULT_FILE_COLOR); }
      const total = counts.reduce((s, c) => s + c, 0);

      const chart = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0, spacing: 2 }] },
        options: {
          ...getBaseOpts(),
          plugins: {
            ...getBaseOpts().plugins,
            legend: { position: 'right', labels: { padding: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11 }, color: tc.muted } },
            tooltip: { ...getTooltipStyle(), callbacks: { label: (ctx: any) => { const v = ctx.parsed; const pct = total > 0 ? Math.round((v / total) * 100) : 0; return ` ${ctx.label}: ${v} (${pct}%)`; } } },
          },
        },
      });
      this.setChart('fileType', chart);
    } catch (error) { logger.error('Error creating file type chart', { error }); }
  }

  createCumulativeChart(canvasId: string, data: { label: string; cumulative: number }[]): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('cumulative');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
      if (isDark()) {
        gradient.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
        gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(0, 99, 163, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 99, 163, 0)');
      }
      const lineColor = isDark() ? '#0ea5e9' : '#0063a3';

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            label: 'Total cumulé',
            data: data.map(d => d.cumulative),
            borderColor: lineColor,
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: lineColor,
            pointBorderColor: isDark() ? '#111827' : '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
          }],
        },
        options: {
          ...getBaseOpts(),
          interaction: { mode: 'index', intersect: false },
          plugins: {
            ...getBaseOpts().plugins,
            legend: { display: false },
            tooltip: { ...getTooltipStyle(), callbacks: { label: (context) => ` Total cumulé : ${context.parsed.y}` } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 11 }, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
          },
        },
      });
      this.setChart('cumulative', chart);
    } catch (error) { logger.error('Error creating cumulative chart', { error }); }
  }

  createDepositFrequencyChart(canvasId: string, data: { label: string; count: number }[]): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('depositFreq');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            label: 'Fichiers déposés',
            data: data.map(d => d.count),
            backgroundColor: COLORS.success,
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.6,
          }],
        },
        options: {
          ...getBaseOpts(),
          plugins: { ...getBaseOpts().plugins, legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 10 }, maxRotation: 45 }, grid: { display: false }, border: { display: false } },
          },
        },
      });
      this.setChart('depositFreq', chart);
    } catch (error) { logger.error('Error creating deposit frequency chart', { error }); }
  }

  createBCFCreatedResolvedChart(canvasId: string, data: { label: string; created: number; resolved: number }[]): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('bcfCreatedResolved');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.label),
          datasets: [
            {
              label: 'Créés',
              data: data.map(d => d.created),
              borderColor: COLORS.danger,
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: COLORS.danger,
            },
            {
              label: 'Résolus',
              data: data.map(d => d.resolved),
              borderColor: COLORS.success,
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: COLORS.success,
            },
          ],
        },
        options: {
          ...getBaseOpts(),
          interaction: { mode: 'index', intersect: false },
          plugins: {
            ...getBaseOpts().plugins,
            legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'line', font: { size: 12 }, color: tc.muted } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 10 } }, grid: { display: false }, border: { display: false } },
          },
        },
      });
      this.setChart('bcfCreatedResolved', chart);
    } catch (error) { logger.error('Error creating BCF created/resolved chart', { error }); }
  }

  createBCFStatusDonutChart(canvasId: string, data: BCFStatusData): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('bcfStatusDonut');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();
      const total = data.open + data.inProgress + data.resolved + data.closed;

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Closed', 'New', 'Waiting', 'en cours'],
          datasets: [{ data: [data.closed, data.open, data.resolved, data.inProgress], backgroundColor: [COLORS.success, COLORS.blue, COLORS.warning, COLORS.accent], borderWidth: 0, spacing: 3 }],
        },
        options: {
          ...getBaseOpts(), cutout: '65%',
          plugins: {
            ...getBaseOpts().plugins,
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: tc.muted } },
            tooltip: { ...getTooltipStyle(), callbacks: { label: (ctx: any) => { const v = ctx.parsed; const pct = total > 0 ? Math.round((v / total) * 100) : 0; return ` ${ctx.label}: ${v} (${pct}%)`; } } },
          },
        },
      });
      this.setChart('bcfStatusDonut', chart);
    } catch (error) { logger.error('Error creating BCF status donut chart', { error }); }
  }

  destroy(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }
}
