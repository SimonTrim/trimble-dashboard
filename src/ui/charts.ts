/**
 * Charts Manager — Chart.js charts with dark/light theme support
 * Area, bar, doughnut, line, horizontal bar charts
 */

import { Chart, registerables } from 'chart.js';
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
import { logger } from '../utils/logger';

Chart.register(...registerables);

/**
 * Clip-based left-to-right reveal plugin for line / area charts.
 *
 * Why not use Chart.js per-point animations? The built-in progressive animation
 * animates each point's x/y independently, which creates a visible "stepped"
 * feeling (each segment pops in with its own easing). A clipping rectangle
 * that grows from left to right gives a perfectly smooth wipe-in effect that
 * is independent of the number of data points.
 */
const lineRevealPlugin = {
  id: 'lineReveal',
  defaults: {
    enabled: false,
    duration: 1400,
    delay: 0,
  },
  beforeDatasetsDraw(chart: any, _args: any, opts: any): void {
    if (!opts || !opts.enabled) return;

    const state = chart.$lineReveal ?? (chart.$lineReveal = {
      progress: 0,
      startedAt: null,
      done: false,
      clippedThisDraw: false,
    });
    // Must reset every draw cycle so `afterDatasetsDraw` only restores when we
    // actually saved. Without this, a draw that short-circuits (because the
    // animation has finished) would still try to restore, unbalancing the
    // canvas state and breaking other plugins.
    state.clippedThisDraw = false;
    if (state.done) return;

    if (state.startedAt === null) {
      state.startedAt = performance.now() + (opts.delay || 0);
    }

    const duration = opts.duration || 1400;
    const elapsed = performance.now() - state.startedAt;

    if (elapsed < 0) {
      state.progress = 0;
    } else if (elapsed >= duration) {
      state.progress = 1;
      state.done = true;
    } else {
      const t = elapsed / duration;
      state.progress = 1 - Math.pow(1 - t, 3);
    }

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    const width = (chartArea.right - chartArea.left) * state.progress;
    ctx.rect(
      chartArea.left - 1,
      chartArea.top - 12,
      width + 2,
      chartArea.bottom - chartArea.top + 24,
    );
    ctx.clip();
    state.clippedThisDraw = true;

    if (!state.done) {
      requestAnimationFrame(() => {
        try { chart.draw(); } catch { /* chart destroyed */ }
      });
    }
  },
  afterDatasetsDraw(chart: any): void {
    const state = chart.$lineReveal;
    if (state && state.clippedThisDraw) {
      chart.ctx.restore();
      state.clippedThisDraw = false;
    }
  },
};

Chart.register(lineRevealPlugin);

/**
 * Clip-based left-to-right reveal plugin for bar charts.
 *
 * Using a growing clip rectangle matches the "wipe-in" behavior of the
 * reference dashboard more closely than Chart.js's default bar grow
 * animation, which animates each bar independently.
 */
const barRevealPlugin = {
  id: 'barReveal',
  defaults: {
    enabled: false,
    duration: 1300,
    delay: 0,
  },
  beforeDatasetsDraw(chart: any, _args: any, opts: any): void {
    if (!opts || !opts.enabled) return;

    const state = chart.$barReveal ?? (chart.$barReveal = {
      progress: 0,
      startedAt: null,
      done: false,
      clippedThisDraw: false,
    });
    state.clippedThisDraw = false;
    if (state.done) return;

    if (state.startedAt === null) {
      state.startedAt = performance.now() + (opts.delay || 0);
    }

    const duration = opts.duration || 1300;
    const elapsed = performance.now() - state.startedAt;

    if (elapsed < 0) {
      state.progress = 0;
    } else if (elapsed >= duration) {
      state.progress = 1;
      state.done = true;
    } else {
      const t = elapsed / duration;
      state.progress = 1 - Math.pow(1 - t, 3);
    }

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    const width = (chartArea.right - chartArea.left) * state.progress;
    ctx.rect(
      chartArea.left - 6,
      chartArea.top - 14,
      width + 12,
      chartArea.bottom - chartArea.top + 28,
    );
    ctx.clip();
    state.clippedThisDraw = true;

    if (!state.done) {
      requestAnimationFrame(() => {
        try { chart.draw(); } catch { /* chart destroyed */ }
      });
    }
  },
  afterDatasetsDraw(chart: any): void {
    const state = chart.$barReveal;
    if (state && state.clippedThisDraw) {
      chart.ctx.restore();
      state.clippedThisDraw = false;
    }
  },
};

Chart.register(barRevealPlugin);

/**
 * Clip-based rotation reveal plugin for pie / doughnut charts.
 *
 * Why not use Chart.js's built-in `animateRotate`? With a `delay` it's
 * inconsistent: Chart.js can draw the final rotated state immediately and
 * skip the interpolation entirely when the options object changes between
 * creation and first draw (which happens on our dashboard because the tile
 * fade-in CSS runs concurrently). The user then sees no rotation at all.
 *
 * This plugin takes full control: Chart.js draws the final doughnut on every
 * frame, and we reveal it through a rotating wedge clip. Importantly, the
 * chart itself does not get canvas-rotated anymore: only the clip path moves.
 * That preserves the final placement/order of every slice and avoids the
 * "désordonné" effect where pieces seem to drift before snapping into place.
 */
const donutRevealPlugin = {
  id: 'donutReveal',
  defaults: {
    enabled: false,
    duration: 2000,
    delay: 0,
  },
  beforeDatasetsDraw(chart: any, _args: any, opts: any): void {
    if (!opts || !opts.enabled) return;

    const state = chart.$donutReveal ?? (chart.$donutReveal = {
      progress: 0,
      startedAt: null,
      done: false,
      clippedThisDraw: false,
    });
    state.clippedThisDraw = false;
    if (state.done) return;

    if (state.startedAt === null) {
      state.startedAt = performance.now() + (opts.delay || 0);
    }

    const duration = opts.duration || 2000;
    const elapsed = performance.now() - state.startedAt;

    if (elapsed < 0) {
      state.progress = 0;
    } else if (elapsed >= duration) {
      state.progress = 1;
      state.done = true;
      return;
    } else {
      const t = elapsed / duration;
      state.progress = 1 - Math.pow(1 - t, 3);
    }

    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    // Radius must cover the entire chart area diagonally so the clip wedge
    // can never be smaller than the drawn arcs.
    const r = Math.ceil(Math.hypot(
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top,
    )) + 20;

    ctx.save();
    ctx.beginPath();
    if (state.progress <= 0) {
      ctx.rect(cx, cy, 0, 0);
    } else {
      const leadOffset = (1 - state.progress) * Math.PI * 0.72;
      const startAngle = -Math.PI / 2 - leadOffset;
      const endAngle = startAngle + state.progress * 2 * Math.PI;
      ctx.moveTo(cx, cy);
      // The wedge itself sweeps into place, which reads as a smooth rotation
      // while keeping the actual slice geometry stable on screen.
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
    }
    ctx.clip();
    ctx.globalAlpha = 0.45 + (state.progress * 0.55);
    state.clippedThisDraw = true;

    requestAnimationFrame(() => {
      try { chart.draw(); } catch { /* chart destroyed */ }
    });
  },
  afterDatasetsDraw(chart: any): void {
    const state = chart.$donutReveal;
    if (state && state.clippedThisDraw) {
      chart.ctx.restore();
      state.clippedThisDraw = false;
    }
  },
};

Chart.register(donutRevealPlugin);

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
 * Returns options configured for the clip-based bar reveal plugin.
 * Bars are fully drawn by Chart.js and revealed with a smooth wipe from the
 * left edge, matching the progressive behavior of the line charts.
 */
function withBarReveal(opts: any, startDelay: number = 0, duration: number = 1300): any {
  const basePlugins = (opts && opts.plugins) || {};
  return {
    ...opts,
    animation: { duration: 0 },
    animations: { colors: false, numbers: false },
    plugins: {
      ...basePlugins,
      barReveal: { enabled: true, duration, delay: startDelay },
    },
  };
}

/**
 * Applies an animation config onto a base options object.
 *
 * We only set `animation` (singular). We do NOT touch `animations` (plural) so
 * Chart.js keeps its per-property defaults — which are required for doughnut
 * rotation to play.
 */
function withAnimation(opts: any, animation: any): any {
  return { ...opts, animation };
}

/**
 * Returns options configured for the clip-based line reveal plugin.
 * Chart.js's own animation is disabled so only the smooth wipe plays.
 */
function withLineReveal(opts: any, startDelay: number = 0, duration: number = 1400): any {
  const basePlugins = (opts && opts.plugins) || {};
  return {
    ...opts,
    animation: { duration: 0 },
    animations: { colors: false, numbers: false },
    plugins: {
      ...basePlugins,
      lineReveal: { enabled: true, duration, delay: startDelay },
    },
  };
}

/**
 * Returns options configured for the clip-based donut/pie reveal plugin.
 * Chart.js's own rotation animation is disabled so only our wedge-clip reveal
 * plays, giving a guaranteed, smooth 0 -> 360 degrees sweep.
 */
function withDonutReveal(
  opts: any,
  startDelay: number = 0,
  duration: number = 2000,
): any {
  const basePlugins = (opts && opts.plugins) || {};
  return {
    ...opts,
    animation: { duration: 0, animateRotate: false, animateScale: false },
    animations: { colors: false, numbers: false },
    plugins: {
      ...basePlugins,
      donutReveal: { enabled: true, duration, delay: startDelay },
    },
  };
}

export class ChartsManager {
  private charts: Map<string, Chart> = new Map();
  private animationsEnabled: boolean = true;

  /**
   * Toggle chart animations. Called with `false` during background refresh so
   * charts refresh silently (no animation replay) when fresh data arrives
   * from the API after the first render.
   */
  setAnimationsEnabled(enabled: boolean): void {
    this.animationsEnabled = enabled;
  }

  /**
   * Line reveal helper: returns a smooth-reveal config when animations are
   * enabled, or a plain no-animation config during silent refresh.
   */
  private lineOpts(opts: any, startDelay: number = 0, duration: number = 1400): any {
    return this.animationsEnabled
      ? withLineReveal(opts, startDelay, duration)
      : withAnimation(opts, false);
  }

  /**
   * Donut reveal helper: returns a smooth wedge-clip config when animations
   * are enabled, or a plain no-animation config during silent refresh.
   */
  private donutOpts(opts: any, startDelay: number = 0, duration: number = 2000): any {
    return this.animationsEnabled
      ? withDonutReveal(opts, startDelay, duration)
      : withAnimation(opts, false);
  }

  /**
   * Bar reveal helper: returns the same left-to-right wipe style used by the
   * line charts, or disables animation entirely during silent refresh.
   */
  private barOpts(opts: any, startDelay: number = 0, duration: number = 1300): any {
    return this.animationsEnabled
      ? withBarReveal(opts, startDelay, duration)
      : withAnimation(opts, false);
  }

  private destroyChart(key: string): void {
    const c = this.charts.get(key);
    if (c) { c.destroy(); this.charts.delete(key); }
  }

  destroyChartByKey(key: string): void {
    this.destroyChart(key);
  }

  /**
   * During silent background refresh we update matching charts in place to
   * avoid the visible "flash / reload" caused by destroy+recreate.
   */
  private mountChart(key: string, ctx: CanvasRenderingContext2D, config: any): void {
    const existing = this.charts.get(key);
    const canUpdateInPlace = !this.animationsEnabled
      && !!existing
      && existing.canvas === ctx.canvas
      && (existing.config as any).type === config.type;

    if (canUpdateInPlace && existing) {
      existing.data = config.data;
      existing.options = config.options;
      existing.update('none');
      return;
    }

    this.destroyChart(key);
    this.charts.set(key, new Chart(ctx, config));
  }

  createBCFChart(canvasId: string, data: BCFStatusData, startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      this.mountChart('bcf', ctx, {
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
          ...this.barOpts(getBaseOpts(), startDelay),
          plugins: { ...getBaseOpts().plugins, legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 11, weight: 'bold' as const } }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    } catch (error) { logger.error('Error creating BCF chart', { error }); }
  }

  createBCFPriorityChart(canvasId: string, data: BCFPriorityData, chartType: string = 'doughnut', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const total = data.high + data.medium + data.low;
      const tc = themeColors();
      const labels = ['Haute', 'Moyenne', 'Basse'];
      const values = [data.high, data.medium, data.low];
      const colors = [COLORS.danger, COLORS.warning, COLORS.success];
      const pctCallback = (ctx: any) => { const v = ctx.parsed || ctx.parsed.y; const pct = total > 0 ? Math.round(((typeof v === 'number' ? v : ctx.parsed) / total) * 100) : 0; return ` ${ctx.label}: ${typeof v === 'number' ? v : ctx.parsed} (${pct}%)`; };

      if (chartType === 'bar') {
        this.mountChart('bcfPriority', ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Topics', data: values, backgroundColor: colors, borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }] },
          options: { ...this.barOpts(getBaseOpts(), startDelay), plugins: { ...getBaseOpts().plugins, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } }, x: { ticks: { color: tc.muted, font: { size: 11 } }, grid: { display: false }, border: { display: false } } } },
        });
      } else {
        const baseCircular = this.donutOpts(getBaseOpts(), startDelay);
        this.mountChart('bcfPriority', ctx, {
          type: chartType as any,
          data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, spacing: 3 }] },
          options: {
            ...baseCircular,
            cutout: chartType === 'doughnut' ? '68%' : undefined,
            plugins: {
              ...baseCircular.plugins,
              legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle', font: { size: 12 }, color: tc.muted } },
              tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } },
            },
          },
        });
      }
    } catch (error) { logger.error('Error creating BCF priority chart', { error }); }
  }

  createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[], startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
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

      this.mountChart('filesTrend', ctx, {
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
          ...this.lineOpts(getBaseOpts(), startDelay),
          interaction: { mode: 'index', intersect: false },
          plugins: { ...getBaseOpts().plugins, legend: { display: false } },
          scales: {
            y: { beginAtZero: true, display: false },
            x: { ticks: { color: tc.muted, font: { size: 11 }, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    } catch (error) { logger.error('Error creating files trend chart', { error }); }
  }

  createFileTypeChart(canvasId: string, byExtension: Record<string, number>, chartType: string = 'pie', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
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
        this.mountChart('fileType', ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Fichiers', data: counts, backgroundColor: colors, borderRadius: 6, borderSkipped: false, barPercentage: 0.6 }] },
          options: { ...this.barOpts(getBaseOpts(), startDelay), plugins: { ...getBaseOpts().plugins, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } }, x: { ticks: { color: tc.muted, font: { size: 10 }, maxRotation: 45 }, grid: { display: false }, border: { display: false } } } },
        });
      } else {
        const baseCircular = this.donutOpts(getBaseOpts(), startDelay);
        this.mountChart('fileType', ctx, {
          type: chartType as any,
          data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0, spacing: 2 }] },
          options: {
            ...baseCircular,
            cutout: chartType === 'doughnut' ? '60%' : undefined,
            plugins: {
              ...baseCircular.plugins,
              legend: { position: 'right', labels: { padding: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11 }, color: tc.muted } },
              tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } },
            },
          },
        });
      }
    } catch (error) { logger.error('Error creating file type chart', { error }); }
  }

  createCumulativeChart(canvasId: string, data: { label: string; cumulative: number }[], chartType: string = 'area', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();
      const resolvedChartType = chartType === 'bar' || chartType === 'column' ? 'bar' : 'line';
      const isAreaChart = chartType === 'area';

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
      if (isDark()) {
        gradient.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
        gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(0, 99, 163, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 99, 163, 0)');
      }
      const lineColor = isDark() ? '#0ea5e9' : '#0063a3';

      const dataset = resolvedChartType === 'bar' ? {
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
        fill: isAreaChart,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: lineColor,
        pointBorderColor: isDark() ? '#111827' : '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      };

      const animOpts = resolvedChartType === 'bar'
        ? this.barOpts(getBaseOpts(), startDelay)
        : this.lineOpts(getBaseOpts(), startDelay);

      this.mountChart('cumulative', ctx, {
        type: resolvedChartType as any,
        data: { labels: data.map(d => d.label), datasets: [dataset as any] },
        options: {
          ...animOpts,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            ...(animOpts.plugins || getBaseOpts().plugins),
            legend: { display: false },
            tooltip: { ...getTooltipStyle(), callbacks: { label: (context: any) => ` Total cumulé : ${context.parsed.y}` } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 11 }, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    } catch (error) { logger.error('Error creating cumulative chart', { error }); }
  }

  createDepositFrequencyChart(canvasId: string, data: { label: string; count: number }[], chartType: string = 'bar', startDelay: number = 0): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
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
        ? this.lineOpts(getBaseOpts(), startDelay)
        : this.barOpts(getBaseOpts(), startDelay);

      this.mountChart('depositFreq', ctx, {
        type: chartType as any,
        data: { labels: data.map(d => d.label), datasets: [dataset as any] },
        options: {
          ...animOpts,
          plugins: { ...(animOpts.plugins || getBaseOpts().plugins), legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 10 }, maxRotation: 45 }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    } catch (error) { logger.error('Error creating deposit frequency chart', { error }); }
  }

  createBCFCreatedResolvedChart(
    canvasId: string,
    data: { label: string; created: number; resolved: number }[],
    chartType: string = 'line',
    startDelay: number = 0,
  ): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();

      if (chartType === 'bar') {
        this.mountChart('bcfCreatedResolved', ctx, {
          type: 'bar',
          data: {
            labels: data.map(d => d.label),
            datasets: [
              {
                label: 'Créés',
                data: data.map(d => d.created),
                backgroundColor: COLORS.danger,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.55,
              },
              {
                label: 'Résolus',
                data: data.map(d => d.resolved),
                backgroundColor: COLORS.success,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.55,
              },
            ],
          },
          options: {
            ...this.barOpts(getBaseOpts(), startDelay),
            interaction: { mode: 'index', intersect: false },
            plugins: {
              ...(this.barOpts(getBaseOpts(), startDelay).plugins || {}),
              legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 12 }, color: tc.muted } },
            },
            scales: {
              y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
              x: { ticks: { color: tc.muted, font: { size: 10 } }, grid: { display: false }, border: { display: false } },
            },
          },
        });
        return;
      }

      this.mountChart('bcfCreatedResolved', ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.label),
          datasets: [
            {
              label: 'Créés',
              data: data.map(d => d.created),
              borderColor: COLORS.danger,
              backgroundColor: chartType === 'area' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: COLORS.danger,
              fill: chartType === 'area',
            },
            {
              label: 'Résolus',
              data: data.map(d => d.resolved),
              borderColor: COLORS.success,
              backgroundColor: chartType === 'area' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: COLORS.success,
              fill: chartType === 'area',
            },
          ],
        },
        options: {
          ...this.lineOpts(getBaseOpts(), startDelay),
          interaction: { mode: 'index', intersect: false },
          plugins: {
            ...this.lineOpts(getBaseOpts(), startDelay).plugins,
            legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'line', font: { size: 12 }, color: tc.muted } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
            x: { ticks: { color: tc.muted, font: { size: 10 } }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    } catch (error) { logger.error('Error creating BCF created/resolved chart', { error }); }
  }

  createBCFStatusDonutChart(
    canvasId: string,
    data: BCFStatusData,
    chartType: string = 'doughnut',
    startDelay: number = 0,
    customColors?: Partial<Record<'open' | 'inProgress' | 'resolved' | 'closed', string>>,
  ): void {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tc = themeColors();
      const total = data.open + data.inProgress + data.resolved + data.closed;
      const labels = ['Closed', 'New', 'Waiting', 'En cours'];
      const values = [data.closed, data.open, data.resolved, data.inProgress];
      const colors = [
        customColors?.closed || COLORS.success,
        customColors?.open || COLORS.blue,
        customColors?.resolved || COLORS.warning,
        customColors?.inProgress || COLORS.accent,
      ];
      const pctCallback = (ctx: any) => { const v = ctx.parsed || ctx.parsed.y; const pct = total > 0 ? Math.round(((typeof v === 'number' ? v : ctx.parsed) / total) * 100) : 0; return ` ${ctx.label}: ${typeof v === 'number' ? v : ctx.parsed} (${pct}%)`; };

      if (chartType === 'column' || chartType === 'bar') {
        const horizontal = chartType === 'bar';
        this.mountChart('bcfStatusDonut', ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Topics', data: values, backgroundColor: colors, borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }] },
          options: {
            ...this.barOpts(getBaseOpts(), startDelay),
            indexAxis: horizontal ? 'y' : 'x',
            plugins: { ...getBaseOpts().plugins, legend: { display: false } },
            scales: horizontal
              ? {
                x: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
                y: { ticks: { color: tc.muted, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
              }
              : {
                y: { beginAtZero: true, ticks: { color: tc.muted, font: { size: 11 } }, grid: { color: tc.grid }, border: { display: false } },
                x: { ticks: { color: tc.muted, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
              },
          },
        });
      } else if (chartType === 'radar') {
        const baseRadar = this.animationsEnabled ? getBaseOpts() : withAnimation(getBaseOpts(), false);
        this.mountChart('bcfStatusDonut', ctx, {
          type: 'radar',
          data: {
            labels,
            datasets: [{
              label: 'Topics',
              data: values,
              borderColor: colors[0],
              backgroundColor: isDark() ? 'rgba(76, 175, 80, 0.18)' : 'rgba(76, 175, 80, 0.12)',
              pointBackgroundColor: colors,
              pointBorderColor: colors,
              pointRadius: 3,
              borderWidth: 2,
            }],
          },
          options: {
            ...baseRadar,
            plugins: { ...(baseRadar.plugins || {}), legend: { display: false }, tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } } },
            scales: {
              r: {
                beginAtZero: true,
                angleLines: { color: tc.grid },
                grid: { color: tc.grid },
                pointLabels: { color: tc.muted, font: { size: 11 } },
                ticks: { color: tc.muted, backdropColor: 'transparent' },
              },
            },
          },
        });
      } else {
        const baseCircular = this.donutOpts(getBaseOpts(), startDelay);
        this.mountChart('bcfStatusDonut', ctx, {
          type: chartType as any,
          data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, spacing: 3 }] },
          options: {
            ...baseCircular,
            cutout: chartType === 'doughnut' ? '65%' : undefined,
            plugins: {
              ...baseCircular.plugins,
              legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: tc.muted } },
              tooltip: { ...getTooltipStyle(), callbacks: { label: pctCallback } },
            },
          },
        });
      }
    } catch (error) { logger.error('Error creating BCF status donut chart', { error }); }
  }

  destroy(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }
}
