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

/**
 * Animation config for circular charts (pie/doughnut):
 * Sweeps cleanly from 0° to 360° (rotate). `animateScale` is disabled so that
 * the rotation is clearly visible (otherwise the arcs grow from the center at
 * the same time as they rotate, which hides the sweep effect).
 *
 * `startDelay` delays the whole animation. Used to synchronize the sweep with
 * the tile's CSS fade-in animation so the user always sees the full rotation.
 */
function getCircularAnimation(startDelay: number = 0) {
  return {
    duration: 1600,
    delay: startDelay,
    easing: 'easeOutQuart' as const,
    animateRotate: true,
    animateScale: false,
  };
}

/**
 * Animation config for bar charts:
 * Each bar appears with a delay based on its index, creating a left-to-right sweep effect.
 * Bars grow from the bottom (y from 0 to value).
 */
function getBarAnimation(startDelay: number = 0): any {
  return {
    duration: 800,
    easing: 'easeOutCubic',
    delay: (context: any) => {
      if (context.type === 'data' && context.mode === 'default' && !context.dropped) {
        return startDelay + context.dataIndex * 60;
      }
      return startDelay;
    },
  };
}

/**
 * Animation config for line/area charts:
 * Sweeps from left to right, drawing the line progressively.
 */
function getLineAnimation(startDelay: number = 0): any {
  return {
    x: {
      type: 'number',
      easing: 'easeOutCubic',
      duration: 1200,
      from: NaN,
      delay(ctx: any) {
        if (ctx.type !== 'data' || ctx.xStarted) return 0;
        ctx.xStarted = true;
        return startDelay + ctx.index * (1200 / Math.max(1, ctx.dataset.data.length));
      },
    },
    y: {
      type: 'number',
      easing: 'easeOutCubic',
      duration: 1200,
      from: (ctx: any) => {
        if (ctx.index === 0) return ctx.chart.scales.y.getPixelForValue(100);
        return ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1]?.getProps(['y'], true).y || 0;
      },
      delay(ctx: any) {
        if (ctx.type !== 'data' || ctx.yStarted) return 0;
        ctx.yStarted = true;
        return startDelay + ctx.index * (1200 / Math.max(1, ctx.dataset.data.length));
      },
    },
  };
}

function withAnimation(opts: any, animation: any): any {
  return { ...opts, animation, animations: undefined };
}

function withLineAnimations(opts: any, startDelay: number = 0): any {
  return { ...opts, animation: { duration: 0 }, animations: getLineAnimation(startDelay) };
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

  createBCFChart(canvasId: string, data: BCFStatusData, startDelay: number = 0): void {
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
          ...withAnimation(getBaseOpts(), getBarAnimation(startDelay)),
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

  createBCFPriorityChart(canvasId: string, data: BCFPriorityData, chartType: string = 'doughnut', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('bcfPriority');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const total = data.high + data.medium + data.low;
      const tc = themeColors();
      const labels = ['Haute', 'Moyenne', 'Basse'];
      const values = [data.high, data.medium, data.low];
      const colors = [COLORS.danger, COLORS.warning, COLORS.success];
      const pctCallback = (ctx: any) => { const v = ctx.parsed || ctx.parsed.y; const pct = total > 0 ? Math.round(((typeof v === 'number' ? v : ctx.parsed) / total) * 100) : 0; return ` ${ctx.label}: ${typeof v === 'number' ? v : ctx.parsed} (${pct}%)`; };

      if (chartType === 'bar') {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Topics', data: values, backgroundColor: colors, borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }] },
          options: { ...withAnimation(getBaseOpts(), getBarAnimation(startDelay)), plugins: { ...getBaseOpts().plugins, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } }, x: { ticks: { color: tc.muted, font: { size: 11 } }, grid: { display: false }, border: { display: false } } } },
        });
        this.setChart('bcfPriority', chart);
      } else {
        const chart = new Chart(ctx, {
          type: chartType as any,
          data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, spacing: 3 }] },
          options: { ...withAnimation(getBaseOpts(), getCircularAnimation(startDelay)), cutout: chartType === 'doughnut' ? '68%' : undefined, plugins: { ...getBaseOpts().plugins, legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle', font: { size: 12 }, color: tc.muted } }, tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } } } },
        });
        this.setChart('bcfPriority', chart);
      }
    } catch (error) { logger.error('Error creating BCF priority chart', { error }); }
  }

  createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[], startDelay: number = 0): void {
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
          ...withLineAnimations(getBaseOpts(), startDelay),
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

  createFileTypeChart(canvasId: string, byExtension: Record<string, number>, chartType: string = 'pie', startDelay: number = 0): void {
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
      const pctCallback = (ctx: any) => { const v = ctx.parsed || ctx.parsed.y; const pct = total > 0 ? Math.round(((typeof v === 'number' ? v : ctx.parsed) / total) * 100) : 0; return ` ${ctx.label}: ${typeof v === 'number' ? v : ctx.parsed} (${pct}%)`; };

      if (chartType === 'bar') {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Fichiers', data: counts, backgroundColor: colors, borderRadius: 6, borderSkipped: false, barPercentage: 0.6 }] },
          options: { ...withAnimation(getBaseOpts(), getBarAnimation(startDelay)), plugins: { ...getBaseOpts().plugins, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } }, x: { ticks: { color: tc.muted, font: { size: 10 }, maxRotation: 45 }, grid: { display: false }, border: { display: false } } } },
        });
        this.setChart('fileType', chart);
      } else {
        const chart = new Chart(ctx, {
          type: chartType as any,
          data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0, spacing: 2 }] },
          options: { ...withAnimation(getBaseOpts(), getCircularAnimation(startDelay)), cutout: chartType === 'doughnut' ? '60%' : undefined, plugins: { ...getBaseOpts().plugins, legend: { position: 'right', labels: { padding: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11 }, color: tc.muted } }, tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } } } },
        });
        this.setChart('fileType', chart);
      }
    } catch (error) { logger.error('Error creating file type chart', { error }); }
  }

  createCumulativeChart(canvasId: string, data: { label: string; cumulative: number }[], chartType: string = 'line', startDelay: number = 0): void {
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

      const dataset = chartType === 'bar' ? {
        label: 'Total cumulé',
        data: data.map(d => d.cumulative),
        backgroundColor: lineColor,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.6,
      } : {
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
      };

      const animOpts = chartType === 'bar'
        ? withAnimation(getBaseOpts(), getBarAnimation(startDelay))
        : withLineAnimations(getBaseOpts(), startDelay);

      const chart = new Chart(ctx, {
        type: chartType as any,
        data: { labels: data.map(d => d.label), datasets: [dataset as any] },
        options: {
          ...animOpts,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            ...getBaseOpts().plugins,
            legend: { display: false },
            tooltip: { ...getTooltipStyle(), callbacks: { label: (context: any) => ` Total cumulé : ${context.parsed.y}` } },
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

  createDepositFrequencyChart(canvasId: string, data: { label: string; count: number }[], chartType: string = 'bar', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('depositFreq');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      const lineColor = isDark() ? '#10b981' : '#059669';
      const dataset = chartType === 'line' ? {
        label: 'Fichiers déposés',
        data: data.map(d => d.count),
        borderColor: lineColor,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: lineColor,
      } : {
        label: 'Fichiers déposés',
        data: data.map(d => d.count),
        backgroundColor: COLORS.success,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.6,
      };

      const animOpts = chartType === 'line'
        ? withLineAnimations(getBaseOpts(), startDelay)
        : withAnimation(getBaseOpts(), getBarAnimation(startDelay));

      const chart = new Chart(ctx, {
        type: chartType as any,
        data: { labels: data.map(d => d.label), datasets: [dataset as any] },
        options: {
          ...animOpts,
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

  createBCFCreatedResolvedChart(canvasId: string, data: { label: string; created: number; resolved: number }[], startDelay: number = 0): void {
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
          ...withLineAnimations(getBaseOpts(), startDelay),
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

  createBCFStatusDonutChart(canvasId: string, data: BCFStatusData, chartType: string = 'doughnut', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      this.destroyChart('bcfStatusDonut');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();
      const total = data.open + data.inProgress + data.resolved + data.closed;
      const labels = ['Closed', 'New', 'Waiting', 'En cours'];
      const values = [data.closed, data.open, data.resolved, data.inProgress];
      const colors = [COLORS.success, COLORS.blue, COLORS.warning, COLORS.accent];
      const pctCallback = (ctx: any) => { const v = ctx.parsed || ctx.parsed.y; const pct = total > 0 ? Math.round(((typeof v === 'number' ? v : ctx.parsed) / total) * 100) : 0; return ` ${ctx.label}: ${typeof v === 'number' ? v : ctx.parsed} (${pct}%)`; };

      if (chartType === 'bar') {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Topics', data: values, backgroundColor: colors, borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }] },
          options: { ...withAnimation(getBaseOpts(), getBarAnimation(startDelay)), plugins: { ...getBaseOpts().plugins, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } }, x: { ticks: { color: tc.muted, font: { size: 11 } }, grid: { display: false }, border: { display: false } } } },
        });
        this.setChart('bcfStatusDonut', chart);
      } else {
        const chart = new Chart(ctx, {
          type: chartType as any,
          data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, spacing: 3 }] },
          options: { ...withAnimation(getBaseOpts(), getCircularAnimation(startDelay)), cutout: chartType === 'doughnut' ? '65%' : undefined, plugins: { ...getBaseOpts().plugins, legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: tc.muted } }, tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } } } },
        });
        this.setChart('bcfStatusDonut', chart);
      }
    } catch (error) { logger.error('Error creating BCF status donut chart', { error }); }
  }

  destroy(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }
}
