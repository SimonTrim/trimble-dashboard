/**
 * Dashboard principal — Modus 2.0 design, dark/light theme
 * 4-column grid, draggable tiles, 8 KPI metrics, 6 charts,
 * tables with pagination, contributor bars, BCF age tracking
 */

import {
  ProjectFile, BCFTopic, TrimbleNote, ProjectView,
  BCFStatusData, BCFPriorityData,
  ActivityItem, TeamMember, TrendData,
} from '../models/types';
import { notesService } from '../api/notesService';
import { bcfService } from '../api/bcfService';
import { filesService } from '../api/filesService';
import { viewsService } from '../api/viewsService';
import { ChartsManager } from './charts';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import './styles.css';

// =============================================
// TILE DEFINITIONS
// =============================================

interface TileDef { id: string; label: string; icon: string; size: 1 | 2 | 4; cat: string; }

const TILE_DEFS: TileDef[] = [
  { id: 'files-deposited-metric',   label: 'Fichiers déposés',  icon: 'folder-closed',    size: 1, cat: 'Métriques' },
  { id: 'bcf-topics-metric',        label: 'Topics BCF',        icon: 'warning',          size: 1, cat: 'Métriques' },
  { id: 'bcf-active-metric',        label: 'BCF actifs',        icon: 'cancel-circle',    size: 1, cat: 'Métriques' },
  { id: 'bcf-resolved-metric',      label: 'BCF résolus',       icon: 'check-circle',     size: 1, cat: 'Métriques' },
  { id: 'bcf-inprogress-metric',    label: 'En cours',          icon: 'clock',            size: 1, cat: 'Métriques' },
  { id: 'file-types-metric',        label: 'Types de fichiers', icon: 'copy-content',     size: 1, cat: 'Métriques' },
  { id: 'contributors-metric',      label: 'Contributeurs',     icon: 'people-group',     size: 1, cat: 'Métriques' },
  { id: 'resolution-rate-metric',   label: 'Taux résolution',   icon: 'bar-graph',        size: 1, cat: 'Métriques' },

  { id: 'cumulative-chart',         label: 'Fichiers déposés — évolution cumulatif',  icon: 'line-graph', size: 2, cat: 'Graphiques' },
  { id: 'deposit-freq-chart',       label: 'Fréquence de dépôt (26 dernières semaines)', icon: 'bar-graph', size: 2, cat: 'Graphiques' },
  { id: 'bcf-status-donut',         label: 'BCF par statut',    icon: 'dashboard',        size: 1, cat: 'Graphiques' },
  { id: 'bcf-created-resolved',     label: 'BCF créés vs résolus dans le temps', icon: 'line-graph', size: 2, cat: 'Graphiques' },
  { id: 'bcf-priority-chart',       label: 'BCF par priorité',  icon: 'dashboard',        size: 1, cat: 'Graphiques' },
  { id: 'bcf-assignee-chart',       label: 'BCF par personne assignée', icon: 'people-group', size: 2, cat: 'Graphiques' },
  { id: 'filetype-chart',           label: 'Fichiers par type', icon: 'dashboard',        size: 2, cat: 'Graphiques' },
  { id: 'top-contributors',         label: 'Top contributeurs (fichiers déposés)', icon: 'people-group', size: 2, cat: 'Graphiques' },

  { id: 'top-updated-files',        label: 'Top 20 — Fichiers les plus mis à jour', icon: 'upload', size: 4, cat: 'Tableaux' },
  { id: 'oldest-unresolved-bcf',    label: 'Top 3 — BCF non résolus les plus anciens', icon: 'warning', size: 4, cat: 'Tableaux' },
  { id: 'recent-files-table',       label: 'Fichiers récents',  icon: 'folder-open',      size: 4, cat: 'Tableaux' },
  { id: 'recent-bcf-table',         label: 'BCF récents',       icon: 'clipboard',        size: 4, cat: 'Tableaux' },

  { id: 'team',                     label: 'Équipe Projet',     icon: 'people-group',     size: 1, cat: 'Projet' },
  { id: 'timeline',                 label: 'Activité Récente',  icon: 'clock',            size: 1, cat: 'Projet' },
  { id: 'views',                    label: 'Vues 3D',           icon: 'visibility-on',    size: 2, cat: 'Projet' },
];

const DEFAULT_ORDER = TILE_DEFS.map(t => t.id);

interface TileConfig { order: string[]; hidden: string[]; }
const STORAGE_KEY = 'trimble-dashboard-tiles-v3';
const THEME_KEY = 'trimble-dashboard-theme';

// =============================================
// DASHBOARD CLASS
// =============================================

export class Dashboard {
  private chartsManager: ChartsManager;
  private containerId: string;
  private tileConfig: TileConfig;
  private dragRAF: number | null = null;
  private projectName: string = '';

  private allTopics: BCFTopic[] = [];
  private allFiles: ProjectFile[] = [];
  private allNotes: TrimbleNote[] = [];
  private allViews: ProjectView[] = [];

  private recentFilesPage: number = 1;
  private recentBcfPage: number = 1;
  private readonly PAGE_SIZE = 10;

  constructor(containerId: string = 'app', _config?: Record<string, any>) {
    this.containerId = containerId;
    this.chartsManager = new ChartsManager();
    this.tileConfig = this.loadTileConfig();
    this.loadTheme();
    logger.info('Dashboard initialized (v3 grid)');
  }

  setProjectName(name: string): void {
    this.projectName = name;
  }

  // =============================================
  // THEME
  // =============================================

  private loadTheme(): void {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  private toggleTheme(): void {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    this.render();
  }

  private isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // =============================================
  // TILE CONFIG PERSISTENCE
  // =============================================

  private loadTileConfig(): TileConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cfg = JSON.parse(raw) as TileConfig;
        const known = new Set(DEFAULT_ORDER);
        const order = cfg.order.filter((id: string) => known.has(id));
        DEFAULT_ORDER.forEach(id => { if (!order.includes(id)) order.push(id); });
        return { order, hidden: cfg.hidden || [] };
      }
    } catch (e) { /* ignore */ }
    return { order: [...DEFAULT_ORDER], hidden: [] };
  }

  private saveTileConfig(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tileConfig)); } catch (e) { /* */ }
  }

  private resetTileConfig(): void {
    this.tileConfig = { order: [...DEFAULT_ORDER], hidden: [] };
    this.saveTileConfig();
    this.render();
  }

  // =============================================
  // RENDER
  // =============================================

  async render(): Promise<void> {
    try {
      const container = document.getElementById(this.containerId);
      if (!container) throw new Error(`Container #${this.containerId} not found`);
      this.chartsManager.destroy();
      container.innerHTML = this.getTemplate();
      this.attachHeaderEvents();
      this.initDragDrop();
      this.applyTileVisibility();
      await this.loadAllData();
      logger.info('Dashboard rendered');
    } catch (error) {
      logger.error('Render error', { error });
      errorHandler.displayError(
        errorHandler.createError('INITIALIZATION_ERROR' as any, error), 'error-container'
      );
    }
  }

  // =============================================
  // DATA LOADING
  // =============================================

  private async loadAllData(): Promise<void> {
    this.showLoader();
    try {
      const [topics, files, notes, views] = await Promise.all([
        bcfService.getAllTopics().catch(() => []),
        filesService.getAllFiles().catch(() => []),
        notesService.getActiveNotes().catch(() => []),
        viewsService.getAllViews().catch(() => []),
      ]);
      this.allTopics = topics;
      this.allFiles = files;
      this.allNotes = notes;
      this.allViews = views;

      this.renderMetrics();
      this.renderCharts();
      this.renderBCFAssigneeChart();
      this.renderTopContributors();
      this.renderTopUpdatedFiles();
      this.renderOldestUnresolvedBCF();
      this.renderRecentFilesTable();
      this.renderRecentBCFTable();
      this.renderViewsSection();
      this.renderTeamSection();
      this.renderTimeline();
      this.attachChartTypeSwitchers();
      this.hideLoader();
      this.loadThumbnails();
    } catch (error) {
      this.hideLoader();
      logger.error('Data load error', { error });
    }
  }

  // =============================================
  // HEADER EVENTS
  // =============================================

  private attachHeaderEvents(): void {
    document.getElementById('btn-export')?.addEventListener('click', () => window.print());
    document.getElementById('btn-theme')?.addEventListener('click', () => this.toggleTheme());

    const settingsBtn = document.getElementById('btn-settings');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsBtn && settingsPanel) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target as Node) && e.target !== settingsBtn)
          settingsPanel.style.display = 'none';
      });
    }

    document.getElementById('btn-reset-layout')?.addEventListener('click', () => this.resetTileConfig());

    document.querySelectorAll('.settings-item input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        const tileId = input.dataset.tile;
        if (!tileId) return;
        if (input.checked) {
          this.tileConfig.hidden = this.tileConfig.hidden.filter(id => id !== tileId);
        } else {
          if (!this.tileConfig.hidden.includes(tileId)) this.tileConfig.hidden.push(tileId);
        }
        this.saveTileConfig();
        this.applyTileVisibility();
      });
    });
  }

  private applyTileVisibility(): void {
    document.querySelectorAll('.tile[data-tile-id]').forEach(tile => {
      const id = (tile as HTMLElement).dataset.tileId;
      if (id && this.tileConfig.hidden.includes(id)) {
        (tile as HTMLElement).classList.add('hidden-tile');
      } else {
        (tile as HTMLElement).classList.remove('hidden-tile');
      }
    });
  }

  // =============================================
  // DRAG & DROP
  // =============================================

  private initDragDrop(): void {
    const container = document.getElementById('tiles-container');
    if (!container) return;
    let draggedTile: HTMLElement | null = null;

    Array.from(container.querySelectorAll('.tile-drag-handle')).forEach(handle => {
      handle.addEventListener('mousedown', () => {
        const tile = (handle as HTMLElement).closest('.tile') as HTMLElement;
        if (tile) tile.setAttribute('draggable', 'true');
      });
    });

    container.addEventListener('dragstart', (e: DragEvent) => {
      const tile = (e.target as HTMLElement).closest('.tile') as HTMLElement;
      if (!tile) return;
      draggedTile = tile;
      requestAnimationFrame(() => tile.classList.add('dragging'));
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tile.dataset.tileId || '');
      }
    });

    container.addEventListener('dragend', () => {
      if (draggedTile) {
        draggedTile.classList.remove('dragging');
        draggedTile.setAttribute('draggable', 'false');
        draggedTile = null;
      }
      container.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-target'));
      this.saveTileOrder();
    });

    container.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!draggedTile) return;
      if (this.dragRAF) cancelAnimationFrame(this.dragRAF);
      this.dragRAF = requestAnimationFrame(() => {
        const target = (e.target as HTMLElement).closest('.tile:not(.dragging)') as HTMLElement;
        if (!target || target === draggedTile) return;
        container.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-target'));
        target.classList.add('drag-target');
        const allTiles = Array.from(container.querySelectorAll('.tile'));
        const draggedIdx = allTiles.indexOf(draggedTile!);
        const targetIdx = allTiles.indexOf(target);
        if (draggedIdx < targetIdx) {
          container.insertBefore(draggedTile!, target.nextSibling);
        } else {
          container.insertBefore(draggedTile!, target);
        }
      });
    });

    container.addEventListener('drop', (e: DragEvent) => { e.preventDefault(); });
  }

  private saveTileOrder(): void {
    const container = document.getElementById('tiles-container');
    if (!container) return;
    const order = Array.from(container.querySelectorAll('.tile[data-tile-id]'))
      .map(t => (t as HTMLElement).dataset.tileId!)
      .filter(Boolean);
    this.tileConfig.order = order;
    this.saveTileConfig();
  }

  // =============================================
  // METRICS (8 KPIs)
  // =============================================

  private renderMetrics(): void {
    const active = this.allTopics.filter(t => t.status !== 'Closed' && t.status !== 'Resolved');
    const resolved = this.allTopics.filter(t => t.status === 'Resolved' || t.status === 'Closed');
    const inProgress = this.allTopics.filter(t => t.status === 'In Progress');
    const uniqueTypes = new Set(this.allFiles.map(f => (f.extension || 'other').toLowerCase()));
    const uniqueContributors = new Set<string>();
    this.allFiles.forEach(f => { if (f.uploadedBy && f.uploadedBy !== '—') uniqueContributors.add(f.uploadedBy); });
    this.allTopics.forEach(t => { if (t.createdBy && t.createdBy !== '—') uniqueContributors.add(t.createdBy); });
    const resolutionRate = this.allTopics.length > 0 ? Math.round((resolved.length / this.allTopics.length) * 100) : 0;

    const w = new Date(); w.setDate(w.getDate() - 7);

    this.setMetric('files-deposited-val', this.allFiles.length, this.trend(this.allFiles, w, 'uploadedAt'), 'Fichiers du projet');
    this.setMetric('bcf-topics-val', this.allTopics.length, this.trend(this.allTopics, w), 'Topics créés');
    this.setMetric('bcf-active-val', active.length, null, 'Topics non fermés');
    this.setMetric('bcf-resolved-val', resolved.length, null, 'Topics fermés/résolus');
    this.setMetric('bcf-inprogress-val', inProgress.length, null, 'Topics en progression');
    this.setMetric('file-types-val', uniqueTypes.size, null, 'Extensions différentes');
    this.setMetric('contributors-val', uniqueContributors.size, null, 'Personnes actives');
    this.setMetric('resolution-rate-val', resolutionRate, null, 'Taux de clôture', '%');
  }

  private trend(items: any[], since: Date, field: string = 'createdAt'): TrendData {
    const n = items.filter(i => new Date(i[field] || i.createdAt || i.uploadedAt) >= since).length;
    return { current: items.length, previous: items.length - n, direction: n > 0 ? 'up' : 'neutral', changeCount: n };
  }

  private setMetric(id: string, value: number, t: TrendData | null, desc: string, suffix: string = ''): void {
    const v = document.getElementById(id);
    if (v) v.textContent = value.toString() + suffix;
    const tr = document.getElementById(`${id}-trend`);
    if (tr) {
      if (t) {
        tr.className = `metric-trend trend-${t.direction}`;
        tr.innerHTML = t.changeCount > 0
          ? `<span>↑</span> +${t.changeCount} cette semaine`
          : '<span>─</span> Stable';
      } else {
        tr.className = 'metric-trend trend-neutral';
        tr.innerHTML = '<span>─</span> Stable';
      }
    }
    const d = document.getElementById(`${id}-desc`);
    if (d) d.textContent = desc;
  }

  // =============================================
  // CHARTS
  // =============================================

  private renderCharts(): void {
    const s: BCFStatusData = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    const p: BCFPriorityData = { high: 0, medium: 0, low: 0 };
    this.allTopics.forEach(t => {
      if (t.status === 'Open') s.open++; else if (t.status === 'In Progress') s.inProgress++;
      else if (t.status === 'Resolved') s.resolved++; else s.closed++;
      const pr = (t.priority || 'Medium').toLowerCase();
      if (pr === 'high') p.high++; else if (pr === 'low') p.low++; else p.medium++;
    });

    this.chartsManager.createBCFStatusDonutChart('bcf-status-donut-canvas', s);
    this.chartsManager.createBCFPriorityChart('bcf-priority-canvas', p);

    this.renderCumulativeChart();
    this.renderDepositFrequencyChart();
    this.renderBCFCreatedResolvedChart(7);
    this.attachBcfCreatedResolvedPeriod();

    const ext: Record<string, number> = {};
    this.allFiles.forEach(f => { const e = (f.extension || 'other').toLowerCase(); ext[e] = (ext[e] || 0) + 1; });
    this.chartsManager.createFileTypeChart('filetype-canvas', ext);
  }

  private renderCumulativeChart(): void {
    const byMonth: Record<string, number> = {};
    this.allFiles.forEach(f => {
      const d = new Date(f.uploadedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    const sorted = Object.keys(byMonth).sort();
    let cumulative = 0;
    const data = sorted.map(key => {
      cumulative += byMonth[key];
      return { label: key, cumulative };
    });
    this.chartsManager.createCumulativeChart('cumulative-canvas', data);
  }

  private renderDepositFrequencyChart(): void {
    const now = new Date();
    const weeks: { label: string; count: number }[] = [];
    for (let i = 25; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = this.allFiles.filter(f => {
        const d = new Date(f.uploadedAt);
        return d >= weekStart && d < weekEnd;
      }).length;
      const label = `${weekStart.getFullYear()}-w${String(Math.ceil((weekStart.getDate()) / 7)).padStart(2, '0')}`;
      weeks.push({ label, count });
    }
    this.chartsManager.createDepositFrequencyChart('deposit-freq-canvas', weeks);
  }

  private renderBCFCreatedResolvedChart(days: number): void {
    const now = new Date();
    const data: { label: string; created: number; resolved: number }[] = [];
    const step = days <= 14 ? 1 : 7;
    const periods = Math.min(days, 30);

    for (let i = periods - 1; i >= 0; i -= step) {
      const start = new Date(now);
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + step);

      const created = this.allTopics.filter(t => {
        const d = new Date(t.createdAt);
        return d >= start && d < end;
      }).length;
      const resolved = this.allTopics.filter(t => {
        if (t.status !== 'Resolved' && t.status !== 'Closed') return false;
        const d = new Date(t.modifiedAt);
        return d >= start && d < end;
      }).length;

      data.push({ label: start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), created, resolved });
    }
    this.chartsManager.createBCFCreatedResolvedChart('bcf-created-resolved-canvas', data);
  }

  private attachBcfCreatedResolvedPeriod(): void {
    document.querySelectorAll('.bcf-cr-period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const period = parseInt(target.dataset.period || '7', 10);
        document.querySelectorAll('.bcf-cr-period-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.renderBCFCreatedResolvedChart(period);
      });
    });
  }

  // =============================================
  // BCF ASSIGNEE (horizontal bar)
  // =============================================

  private renderBCFAssigneeChart(): void {
    const container = document.getElementById('bcf-assignee-list');
    if (!container) return;

    const byAssignee: Record<string, number> = {};
    this.allTopics.forEach(t => {
      const name = t.assignedTo || 'Non assigné';
      byAssignee[name] = (byAssignee[name] || 0) + 1;
    });

    const sorted = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!sorted.length) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun BCF</div></div>'; return; }

    const max = sorted[0][1];
    const barColors = ['#8b5cf6', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];

    container.innerHTML = sorted.map(([name, count], i) => {
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      return `<div class="hbar-item">
        <span class="hbar-label" title="${this.esc(name)}">${this.esc(name)}</span>
        <div class="hbar-bar-wrapper"><div class="hbar-bar" style="width:${pct}%;background:${barColors[i % barColors.length]}"></div></div>
        <span class="hbar-value">${count}</span>
      </div>`;
    }).join('');
  }

  // =============================================
  // TOP CONTRIBUTORS (horizontal bar)
  // =============================================

  private renderTopContributors(): void {
    const container = document.getElementById('top-contributors-list');
    if (!container) return;

    const byUploader: Record<string, number> = {};
    this.allFiles.forEach(f => {
      if (f.uploadedBy && f.uploadedBy !== '—') {
        byUploader[f.uploadedBy] = (byUploader[f.uploadedBy] || 0) + 1;
      }
    });

    const sorted = Object.entries(byUploader).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!sorted.length) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun contributeur</div></div>'; return; }

    const max = sorted[0][1];

    container.innerHTML = sorted.map(([name, count], i) => {
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      return `<div class="hbar-item">
        <span class="hbar-rank">${i + 1}</span>
        <span class="hbar-label" title="${this.esc(name)}">${this.esc(name)}</span>
        <div class="hbar-bar-wrapper"><div class="hbar-bar" style="width:${pct}%;background:#0ea5e9"></div></div>
        <span class="hbar-value">${count}</span>
      </div>`;
    }).join('');
  }

  // =============================================
  // TOP UPDATED FILES
  // =============================================

  private renderTopUpdatedFiles(): void {
    const tbody = document.getElementById('top-updated-files-body');
    if (!tbody) return;

    const fileVersions: Record<string, { file: ProjectFile; count: number }> = {};
    this.allFiles.forEach(f => {
      const baseName = f.name.replace(/\s*\(\d+\)\s*/, '');
      if (!fileVersions[baseName]) {
        fileVersions[baseName] = { file: f, count: 1 };
      } else {
        fileVersions[baseName].count++;
        if (new Date(f.uploadedAt) > new Date(fileVersions[baseName].file.uploadedAt)) {
          fileVersions[baseName].file = f;
        }
      }
    });

    const sorted = Object.entries(fileVersions)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-text">Aucun fichier</div></td></tr>';
      return;
    }

    const maxVer = sorted[0][1].count;
    const barColors = ['#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

    tbody.innerHTML = sorted.map(([name, { file, count }], i) => {
      const ext = (file.extension || '').toLowerCase();
      const pct = maxVer > 0 ? Math.round((count / maxVer) * 100) : 0;
      const color = barColors[i % barColors.length];
      return `<tr>
        <td style="width:2rem;text-align:center;font-weight:700;color:var(--muted-foreground)">${i + 1}</td>
        <td><span class="badge-ext ${ext || 'default'}">${ext || '?'}</span> <span class="file-name" title="${this.esc(name)}">${this.esc(this.truncate(name, 80))}</span></td>
        <td style="width:8rem"><div class="version-bar"><div class="version-bar-fill" style="width:${pct}%;background:${color}"></div><span class="version-bar-label">${count}v</span></div></td>
      </tr>`;
    }).join('');
  }

  // =============================================
  // OLDEST UNRESOLVED BCF
  // =============================================

  private renderOldestUnresolvedBCF(): void {
    const tbody = document.getElementById('oldest-bcf-body');
    if (!tbody) return;

    const unresolved = this.allTopics
      .filter(t => t.status !== 'Closed' && t.status !== 'Resolved')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 5);

    if (!unresolved.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-text">Aucun BCF non résolu</div></td></tr>';
      return;
    }

    tbody.innerHTML = unresolved.map(t => {
      const age = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000);
      const statusCls = this.statusCls(t.status);
      const ageColor = age > 30 ? '#ef4444' : age > 14 ? '#f59e0b' : '#10b981';
      return `<tr>
        <td style="white-space:nowrap;font-weight:600;color:var(--trimble-primary)">${this.esc(t.id.substring(0, 8))}</td>
        <td><span class="badge badge-${statusCls}">${t.status}</span></td>
        <td>${this.truncate(this.esc(t.title), 50)}</td>
        <td style="color:var(--muted-foreground)">${this.esc(t.assignedTo || 'Non assigné')}</td>
        <td style="color:var(--muted-foreground);white-space:nowrap">${this.fmtDate(t.createdAt)}</td>
        <td style="white-space:nowrap"><span style="font-weight:700;color:${ageColor}">${age}j</span></td>
      </tr>`;
    }).join('');
  }

  // =============================================
  // RECENT FILES (paginated)
  // =============================================

  private renderRecentFilesTable(): void {
    const container = document.getElementById('recent-files-container');
    if (!container) return;

    const sorted = [...this.allFiles].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const totalPages = Math.ceil(sorted.length / this.PAGE_SIZE);
    const page = Math.min(this.recentFilesPage, totalPages || 1);
    const start = (page - 1) * this.PAGE_SIZE;
    const pageFiles = sorted.slice(start, start + this.PAGE_SIZE);

    if (!sorted.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun fichier récent</div></div>';
      return;
    }

    const paginationHtml = this.paginationHtml('recent-files', page, totalPages, sorted.length);

    container.innerHTML = `
      ${paginationHtml}
      <div class="table-wrapper"><table class="table">
        <thead><tr><th>Nom</th><th>Statut</th><th>Date</th><th>Auteur</th></tr></thead>
        <tbody>${pageFiles.map(f => {
          const ext = (f.extension || '').toLowerCase();
          const age = this.relDate(new Date(f.uploadedAt));
          return `<tr class="clickable-row">
            <td><span class="badge-ext ${ext || 'default'}">${ext || '?'}</span> <span class="file-name" title="${this.esc(f.name)}">${this.esc(this.truncate(f.name, 70))}</span></td>
            <td><span class="badge badge-file">Nouveau</span></td>
            <td style="color:var(--muted-foreground);white-space:nowrap">${age}</td>
            <td style="color:var(--muted-foreground)">${this.esc(f.uploadedBy)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="click-hint">Cliquez sur un fichier pour l'ouvrir dans Trimble Connect</div>`;

    this.attachPagination('recent-files', totalPages, (p) => { this.recentFilesPage = p; this.renderRecentFilesTable(); });
  }

  // =============================================
  // RECENT BCF (paginated)
  // =============================================

  private renderRecentBCFTable(): void {
    const container = document.getElementById('recent-bcf-container');
    if (!container) return;

    const sorted = [...this.allTopics].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    const totalPages = Math.ceil(sorted.length / this.PAGE_SIZE);
    const page = Math.min(this.recentBcfPage, totalPages || 1);
    const start = (page - 1) * this.PAGE_SIZE;
    const pageTopics = sorted.slice(start, start + this.PAGE_SIZE);

    if (!sorted.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun BCF récent</div></div>';
      return;
    }

    const paginationHtml = this.paginationHtml('recent-bcf', page, totalPages, sorted.length);

    container.innerHTML = `
      ${paginationHtml}
      <div class="table-wrapper"><table class="table">
        <thead><tr><th>N°</th><th>Statut</th><th>Titre</th><th>Assigné à</th><th>Créé le</th></tr></thead>
        <tbody>${pageTopics.map(t => {
          const statusCls = this.statusCls(t.status);
          return `<tr class="clickable-row">
            <td style="font-weight:600;color:var(--trimble-primary);white-space:nowrap">${this.esc(t.id.substring(0, 8))}</td>
            <td><span class="badge badge-${statusCls}">${t.status}</span></td>
            <td>${this.truncate(this.esc(t.title), 60)}</td>
            <td style="color:var(--muted-foreground)">${this.esc(t.assignedTo || 'Non assigné')}</td>
            <td style="color:var(--muted-foreground);white-space:nowrap">${this.fmtDate(t.createdAt)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="click-hint">Cliquez sur un BCF pour l'ouvrir dans Trimble Connect</div>`;

    this.attachPagination('recent-bcf', totalPages, (p) => { this.recentBcfPage = p; this.renderRecentBCFTable(); });
  }

  // =============================================
  // PAGINATION
  // =============================================

  private paginationHtml(prefix: string, current: number, total: number, itemCount: number): string {
    const buttons: string[] = [];
    for (let i = 1; i <= Math.min(total, 7); i++) {
      buttons.push(`<button class="pagination-btn ${prefix}-page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`);
    }
    return `<div class="pagination">${buttons.join('')}<span class="pagination-info">${itemCount} résultats</span></div>`;
  }

  private attachPagination(prefix: string, totalPages: number, callback: (page: number) => void): void {
    document.querySelectorAll(`.${prefix}-page-btn`).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt((e.target as HTMLElement).dataset.page || '1', 10);
        if (page >= 1 && page <= totalPages) callback(page);
      });
    });
  }

  // =============================================
  // VIEWS + THUMBNAILS
  // =============================================

  private renderViewsSection(): void {
    const c = document.getElementById('views-grid');
    if (!c) return;
    const views = [...this.allViews]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 16);
    if (!views.length) {
      c.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="modus-icon mi-visibility-on"></i></div><div class="empty-state-text">Aucune vue</div></div>';
      return;
    }
    c.innerHTML = views.map(v => {
      return `<div class="view-item">
        <div class="view-thumbnail" data-view-id="${v.id}"><span class="thumb-loading"><i class="modus-icon mi-visibility-on"></i></span></div>
        <div class="view-name" title="${this.esc(v.name)}">${this.esc(v.name)}</div>
        <div class="view-meta">${this.esc(v.createdBy)} · ${this.fmtDate(v.createdAt)}</div>
      </div>`;
    }).join('');
  }

  private async loadThumbnails(): Promise<void> {
    const thumbEls = document.querySelectorAll('.view-thumbnail[data-view-id]');
    const els = Array.from(thumbEls).filter(el => el.querySelector('.thumb-loading'));
    if (!els.length) return;

    for (let i = 0; i < els.length; i += 4) {
      await Promise.all(els.slice(i, i + 4).map(async (el) => {
        const viewId = (el as HTMLElement).dataset.viewId;
        if (!viewId) return;
        try {
          const url = await viewsService.getThumbnailUrl(viewId);
          if (url) {
            const img = document.createElement('img');
            img.alt = 'thumbnail';
            img.src = url;
            img.onload = () => {
              (el as HTMLElement).innerHTML = '';
              (el as HTMLElement).appendChild(img);
            };
            img.onerror = () => {
              (el as HTMLElement).innerHTML = '<span class="thumb-placeholder"><i class="modus-icon mi-visibility-on"></i></span>';
            };
          } else {
            (el as HTMLElement).innerHTML = '<span class="thumb-placeholder"><i class="modus-icon mi-visibility-on"></i></span>';
          }
        } catch {
          (el as HTMLElement).innerHTML = '<span class="thumb-placeholder"><i class="modus-icon mi-visibility-on"></i></span>';
        }
      }));
    }
  }

  // =============================================
  // TEAM
  // =============================================

  private renderTeamSection(): void {
    const c = document.getElementById('team-list');
    if (!c) return;
    const members = this.getTeamMembers();
    if (!members.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="modus-icon mi-people-group"></i></div><div class="empty-state-text">Aucun membre</div></div>'; return; }
    const colors = ['#005F9E', '#00A3E0', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    c.innerHTML = members.slice(0, 10).map((m, i) => `<div class="team-member">
      <div class="team-avatar" style="background:${colors[i % colors.length]}">${this.initials(m.name)}</div>
      <div class="team-info"><div class="team-name">${this.esc(m.name)}</div><div class="team-stats">${m.filesCount} fic. · ${m.bcfCount} BCF · ${m.viewsCount} vues</div></div>
      <div class="team-count">${m.totalContributions}</div>
    </div>`).join('');
  }

  private getTeamMembers(): TeamMember[] {
    const map: Record<string, TeamMember> = {};
    const add = (name: string, type: string, date: Date) => {
      if (!name || name === 'Unknown' || name === '—') return;
      if (!map[name]) map[name] = { name, filesCount: 0, bcfCount: 0, notesCount: 0, viewsCount: 0, totalContributions: 0, lastActivity: date };
      const m = map[name];
      if (type === 'f') m.filesCount++; else if (type === 'b') m.bcfCount++;
      else if (type === 'n') m.notesCount++; else m.viewsCount++;
      m.totalContributions++;
      if (date > m.lastActivity) m.lastActivity = date;
    };
    this.allFiles.forEach(f => add(f.uploadedBy, 'f', new Date(f.uploadedAt)));
    this.allTopics.forEach(t => add(t.createdBy, 'b', new Date(t.createdAt)));
    this.allNotes.forEach(n => add(n.author, 'n', new Date(n.createdAt)));
    this.allViews.forEach(v => add(v.createdBy, 'v', new Date(v.createdAt)));
    return Object.values(map).sort((a, b) => b.totalContributions - a.totalContributions);
  }

  // =============================================
  // TIMELINE
  // =============================================

  private renderTimeline(): void {
    const c = document.getElementById('timeline');
    if (!c) return;
    const items: ActivityItem[] = [];
    this.allFiles.forEach(f => items.push({ id: f.id, type: 'file', title: f.name, date: new Date(f.uploadedAt), author: f.uploadedBy }));
    this.allTopics.forEach(t => items.push({ id: t.id, type: 'bcf', title: t.title, date: new Date(t.modifiedAt), author: t.createdBy }));
    this.allNotes.forEach(n => items.push({ id: n.id, type: 'note', title: n.title, date: new Date(n.updatedAt), author: n.author }));
    this.allViews.forEach(v => items.push({ id: v.id, type: 'view', title: v.name, date: new Date(v.createdAt), author: v.createdBy }));
    items.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (!items.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="modus-icon mi-clock"></i></div><div class="empty-state-text">Aucune activité</div></div>'; return; }
    const labels: Record<string, string> = { file: 'Fichier', bcf: 'BCF', note: 'Note', view: 'Vue' };
    c.innerHTML = items.slice(0, 12).map(a => `<div class="timeline-item">
      <div class="timeline-dot ${a.type}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${this.esc(a.title)}</div>
        <div class="timeline-meta"><span class="badge badge-${a.type}">${labels[a.type]}</span><span>${this.esc(a.author)}</span><span>·</span><span>${this.relDate(a.date)}</span></div>
      </div>
    </div>`).join('');
  }

  // =============================================
  // HELPERS
  // =============================================

  private statusCls(s: string): string {
    if (s === 'In Progress') return 'inprogress';
    if (s === 'Open') return 'new';
    if (s === 'Resolved') return 'waiting';
    return s.toLowerCase();
  }
  private initials(n: string): string { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.substring(0, 2).toUpperCase(); }
  private fmtDate(d: Date | string): string { return new Date(d).toLocaleDateString('fr-FR'); }
  private relDate(d: Date): string {
    const ms = Date.now() - d.getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
    if (m < 60) return `il y a ${m} min`; if (h < 24) return `il y a ${h}h`; if (dy < 7) return `il y a ${dy}j`;
    return d.toLocaleDateString('fr-FR');
  }
  private esc(s: string): string { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  private truncate(s: string, len: number): string { return s.length > len ? s.substring(0, len) + '...' : s; }
  private showLoader(): void { const el = document.getElementById('loader'); if (el) el.style.display = 'flex'; }
  private hideLoader(): void { const el = document.getElementById('loader'); if (el) el.style.display = 'none'; }
  stopAutoRefresh(): void { }
  destroy(): void { this.chartsManager.destroy(); }
  exportPDF(): void { window.print(); }

  // =============================================
  // CHART TYPE SWITCHER
  // =============================================

  private chartTypeState: Record<string, string> = {};

  private chartTypeSwitcher(chartId: string, types: string[]): string {
    const svgs: Record<string, string> = {
      line: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,12 5,5 9,9 15,2"/></svg>',
      bar: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="3" height="6" rx="0.5"/><rect x="6.5" y="4" width="3" height="11" rx="0.5"/><rect x="12" y="7" width="3" height="8" rx="0.5"/></svg>',
      doughnut: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5"/><line x1="8" y1="3" x2="8" y2="1" stroke-width="1.5"/></svg>',
      pie: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 7 7h-7z" opacity="0.6"/><path d="M9 0v7h7A7 7 0 0 0 9 0z"/></svg>',
    };
    const labels: Record<string, string> = {
      line: 'Ligne',
      bar: 'Barres',
      doughnut: 'Anneau',
      pie: 'Camembert',
    };
    const current = this.chartTypeState[chartId] || types[0];
    return `<div class="chart-type-switcher" data-chart-id="${chartId}">${types.map(t =>
      `<button class="chart-type-btn ${t === current ? 'active' : ''}" data-chart-type="${t}" data-chart-id="${chartId}" title="${labels[t]}">${svgs[t]}</button>`
    ).join('')}</div>`;
  }

  private attachChartTypeSwitchers(): void {
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const chartId = target.dataset.chartId;
        const chartType = target.dataset.chartType;
        if (!chartId || !chartType) return;

        const container = target.closest('.chart-type-switcher');
        if (container) {
          container.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
        }
        target.classList.add('active');

        this.chartTypeState[chartId] = chartType;
        this.rerenderChart(chartId, chartType);
      });
    });
  }

  private rerenderChart(chartId: string, chartType: string): void {
    const s: BCFStatusData = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    const p: BCFPriorityData = { high: 0, medium: 0, low: 0 };
    this.allTopics.forEach(t => {
      if (t.status === 'Open') s.open++; else if (t.status === 'In Progress') s.inProgress++;
      else if (t.status === 'Resolved') s.resolved++; else s.closed++;
      const pr = (t.priority || 'Medium').toLowerCase();
      if (pr === 'high') p.high++; else if (pr === 'low') p.low++; else p.medium++;
    });

    const ext: Record<string, number> = {};
    this.allFiles.forEach(f => { const e = (f.extension || 'other').toLowerCase(); ext[e] = (ext[e] || 0) + 1; });

    switch (chartId) {
      case 'cumulative':
        this.chartsManager.createCumulativeChart('cumulative-canvas', this.getCumulativeData(), chartType as any);
        break;
      case 'deposit-freq':
        this.chartsManager.createDepositFrequencyChart('deposit-freq-canvas', this.getDepositFreqData(), chartType as any);
        break;
      case 'bcf-status':
        this.chartsManager.createBCFStatusDonutChart('bcf-status-donut-canvas', s, chartType as any);
        break;
      case 'bcf-priority':
        this.chartsManager.createBCFPriorityChart('bcf-priority-canvas', p, chartType as any);
        break;
      case 'filetype':
        this.chartsManager.createFileTypeChart('filetype-canvas', ext, chartType as any);
        break;
    }
  }

  private getCumulativeData(): { label: string; cumulative: number }[] {
    const byMonth: Record<string, number> = {};
    this.allFiles.forEach(f => {
      const d = new Date(f.uploadedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    const sorted = Object.keys(byMonth).sort();
    let cumulative = 0;
    return sorted.map(key => { cumulative += byMonth[key]; return { label: key, cumulative }; });
  }

  private getDepositFreqData(): { label: string; count: number }[] {
    const now = new Date();
    const weeks: { label: string; count: number }[] = [];
    for (let i = 25; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = this.allFiles.filter(f => {
        const d = new Date(f.uploadedAt);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({ label: `${weekStart.getFullYear()}-w${String(Math.ceil((weekStart.getDate()) / 7)).padStart(2, '0')}`, count });
    }
    return weeks;
  }

  // =============================================
  // HTML TEMPLATE
  // =============================================

  private getTemplate(): string {
    const tileOrder = this.tileConfig.order;
    const themeIcon = this.isDark() ? 'sun' : 'moon';
    const themeLabel = this.isDark() ? 'Clair' : 'Sombre';

    const tiles: Record<string, string> = {
      'files-deposited-metric': this.metricHtml('files-deposited-val', 'Fichiers déposés', 'green', 'folder-closed'),
      'bcf-topics-metric': this.metricHtml('bcf-topics-val', 'Topics BCF', 'red', 'warning'),
      'bcf-active-metric': this.metricHtml('bcf-active-val', 'BCF actifs', 'red', 'cancel-circle'),
      'bcf-resolved-metric': this.metricHtml('bcf-resolved-val', 'BCF résolus', 'green', 'check-circle'),
      'bcf-inprogress-metric': this.metricHtml('bcf-inprogress-val', 'En cours', 'yellow', 'clock'),
      'file-types-metric': this.metricHtml('file-types-val', 'Types de fichiers', 'orange', 'copy-content'),
      'contributors-metric': this.metricHtml('contributors-val', 'Contributeurs', 'blue', 'people-group'),
      'resolution-rate-metric': this.metricHtml('resolution-rate-val', 'Taux résolution', 'teal', 'bar-graph'),

      'cumulative-chart': `<div class="card"><div class="card-header"><h3>Fichiers déposés — évolution cumulatif</h3>${this.chartTypeSwitcher('cumulative', ['line', 'bar'])}</div><div class="card-content"><div class="chart-container chart-tall"><canvas id="cumulative-canvas"></canvas></div></div></div>`,
      'deposit-freq-chart': `<div class="card"><div class="card-header"><h3>Fréquence de dépôt (26 dernières semaines)</h3>${this.chartTypeSwitcher('deposit-freq', ['bar', 'line'])}</div><div class="card-content"><div class="chart-container chart-tall"><canvas id="deposit-freq-canvas"></canvas></div></div></div>`,
      'bcf-status-donut': `<div class="card"><div class="card-header"><h3>BCF par statut</h3>${this.chartTypeSwitcher('bcf-status', ['doughnut', 'bar', 'pie'])}</div><div class="card-content"><div class="chart-container"><canvas id="bcf-status-donut-canvas"></canvas></div></div></div>`,
      'bcf-created-resolved': `<div class="card"><div class="card-header"><h3>BCF créés vs résolus dans le temps</h3><div class="chart-period-tabs"><button class="bcf-cr-period-btn active" data-period="7">7 sem.</button><button class="bcf-cr-period-btn" data-period="30">Tout</button></div></div><div class="card-content"><div class="chart-container"><canvas id="bcf-created-resolved-canvas"></canvas></div></div></div>`,
      'bcf-priority-chart': `<div class="card"><div class="card-header"><h3>BCF par priorité</h3>${this.chartTypeSwitcher('bcf-priority', ['doughnut', 'bar', 'pie'])}</div><div class="card-content"><div class="chart-container"><canvas id="bcf-priority-canvas"></canvas></div></div></div>`,
      'bcf-assignee-chart': `<div class="card"><div class="card-header"><h3>BCF par personne assignée</h3><span class="card-icon"><i class="modus-icon mi-people-group"></i></span></div><div class="card-content"><div id="bcf-assignee-list" class="hbar-list" style="padding:0.5rem 0"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,
      'filetype-chart': `<div class="card"><div class="card-header"><h3>Fichiers par type</h3>${this.chartTypeSwitcher('filetype', ['pie', 'doughnut', 'bar'])}</div><div class="card-content"><div class="chart-container"><canvas id="filetype-canvas"></canvas></div></div></div>`,
      'top-contributors': `<div class="card"><div class="card-header"><h3>Top contributeurs (fichiers déposés)</h3><span class="card-icon"><i class="modus-icon mi-people-group"></i></span></div><div class="card-content"><div id="top-contributors-list" class="hbar-list" style="padding:0.5rem 0"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,

      'top-updated-files': `<div class="card"><div class="card-header"><h3>Top 20 — Fichiers les plus mis à jour (nouvelles versions)</h3><span class="card-icon"><i class="modus-icon mi-upload"></i></span></div>
        <div class="card-content" style="padding:0"><div class="table-wrapper"><table class="table">
          <thead><tr><th style="width:2rem">#</th><th>Nom</th><th style="width:8rem">Versions</th></tr></thead>
          <tbody id="top-updated-files-body"><tr><td colspan="3" class="text-center" style="padding:1rem;color:var(--muted-foreground)">Chargement...</td></tr></tbody>
        </table></div></div></div>`,

      'oldest-unresolved-bcf': `<div class="card"><div class="card-header"><h3>Top 3 — BCF non résolus les plus anciens</h3><span class="card-icon"><i class="modus-icon mi-warning"></i></span></div>
        <div class="card-content" style="padding:0"><div class="table-wrapper"><table class="table">
          <thead><tr><th>N°</th><th>Statut</th><th>Titre</th><th>Assigné à</th><th>Créé le</th><th>Âge</th></tr></thead>
          <tbody id="oldest-bcf-body"><tr><td colspan="6" class="text-center" style="padding:1rem;color:var(--muted-foreground)">Chargement...</td></tr></tbody>
        </table></div></div></div>`,

      'recent-files-table': `<div class="card"><div class="card-header"><h3>Fichiers récents</h3><span class="card-icon"><i class="modus-icon mi-folder-open"></i></span></div>
        <div class="card-content" style="padding:0"><div id="recent-files-container"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,

      'recent-bcf-table': `<div class="card"><div class="card-header"><h3>BCF récents</h3><span class="card-icon"><i class="modus-icon mi-clipboard"></i></span></div>
        <div class="card-content" style="padding:0"><div id="recent-bcf-container"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,

      'team': `<div class="card"><div class="card-header"><h3>Équipe projet</h3><span class="card-icon"><i class="modus-icon mi-people-group"></i></span></div>
        <div class="card-content"><div id="team-list" class="team-list"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,

      'timeline': `<div class="card"><div class="card-header"><h3>Activité récente</h3><span class="card-icon"><i class="modus-icon mi-clock"></i></span></div>
        <div class="card-content"><div id="timeline" class="timeline"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,

      'views': `<div class="card"><div class="card-header"><h3>Vues 3D sauvegardées</h3><span class="card-icon"><i class="modus-icon mi-visibility-on"></i></span></div>
        <div class="card-content"><div id="views-grid" class="views-grid"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,
    };

    const categories = ['Métriques', 'Graphiques', 'Tableaux', 'Projet'];
    const settingsHtml = categories.map(cat => {
      const catTiles = TILE_DEFS.filter(t => t.cat === cat);
      return `<div class="settings-section-title">${cat}</div>
        <div class="settings-grid">${catTiles.map(t =>
        `<label class="settings-item"><input type="checkbox" data-tile="${t.id}" ${this.tileConfig.hidden.includes(t.id) ? '' : 'checked'}/><i class="modus-icon" style="font-size:0.875rem">${t.icon}</i> ${t.label}</label>`
      ).join('')}</div>`;
    }).join('');

    const tilesHtml = tileOrder.map(id => {
      const content = tiles[id];
      if (!content) return '';
      const def = TILE_DEFS.find(d => d.id === id);
      const size = def ? def.size : 1;
      const hidden = this.tileConfig.hidden.includes(id) ? ' hidden-tile' : '';
      return `<div class="tile${hidden}" data-tile-id="${id}" data-size="${size}"><div class="tile-drag-handle" title="Déplacer"><i class="modus-icon mi-drag-indicator" style="width:10px;height:10px"></i></div>${content}</div>`;
    }).join('');

    const projectDisplay = this.projectName ? this.projectName : 'Projet Trimble Connect';

    return `
      <div class="dashboard">
        <div class="dashboard-header">
          <div class="header-content">
            <h1>Tableau de bord projet</h1>
            <span class="project-name">${this.esc(projectDisplay)}</span>
          </div>
          <div class="header-actions">
            <button class="theme-toggle" id="btn-theme"><i class="modus-icon mi-${themeIcon}"></i> ${themeLabel}</button>
            <button class="btn-header" id="btn-export"><i class="modus-icon mi-download"></i> Exporter PDF</button>
            <div class="settings-wrapper">
              <button class="btn-header" id="btn-settings"><i class="modus-icon mi-settings"></i> Personnaliser</button>
              <div class="settings-panel" id="settings-panel" style="display:none">
                <div class="settings-header">
                  <h4>Personnaliser le dashboard</h4>
                  <button class="btn-reset" id="btn-reset-layout">Réinitialiser</button>
                </div>
                ${settingsHtml}
              </div>
            </div>
          </div>
        </div>
        <div class="dashboard-tabs">
          <button class="dashboard-tab active">Tableau de bord</button>
        </div>
        <div id="error-container"></div>
        <div id="loader" class="loader-container" style="display:none"><div class="spinner"></div></div>
        <div class="tiles-container" id="tiles-container">${tilesHtml}</div>
      </div>`;
  }

  private metricHtml(id: string, label: string, color: string, icon: string): string {
    return `<div class="card metric-card">
      <div class="card-header"><span class="metric-label">${label}</span><div class="metric-icon-wrapper ${color}"><i class="modus-icon mi-${icon}"></i></div></div>
      <div class="card-content">
        <div class="metric-value" id="${id}">0</div>
        <div id="${id}-trend" class="metric-trend trend-neutral"><span>─</span> Chargement...</div>
        <div class="metric-description" id="${id}-desc"></div>
      </div>
    </div>`;
  }
}
