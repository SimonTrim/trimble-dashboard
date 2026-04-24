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
const TILE_SETTINGS_KEY = 'trimble-dashboard-tile-settings-v1';

type PeriodMode = 'day' | 'week' | 'month';
type RangeMode = 12 | 26 | 52 | 'all';
type TopMode = 3 | 5 | 10 | 20 | 'all';

interface TileSettingsMap {
  [tileId: string]: any;
}

const DEFAULT_TILE_SETTINGS: TileSettingsMap = {
  'bcf-status-donut': {
    chartType: 'treemap',
    colors: {
      open: '#3b82f6',
      inProgress: '#a3a3a3',
      resolved: '#f59e0b',
      closed: '#4caf50',
    },
  },
  'filetype-chart': {
    chartType: 'treemap',
  },
  'bcf-created-resolved': {
    chartType: 'line',
    period: 'week',
    rangeCount: 7,
  },
  'cumulative-chart': {
    chartType: 'area',
    period: 'month',
  },
  'deposit-freq-chart': {
    chartType: 'bar',
    period: 'week',
    range: 26,
  },
  'top-contributors': {
    top: 'all',
  },
  'top-updated-files': {
    top: 20,
  },
  'oldest-unresolved-bcf': {
    top: 3,
  },
  'recent-files-table': {
    window: '30d',
    extension: 'all',
  },
  'recent-bcf-table': {
    window: '30d',
  },
};

// =============================================
// DASHBOARD CLASS
// =============================================

export class Dashboard {
  private chartsManager: ChartsManager;
  private containerId: string;
  private tileConfig: TileConfig;
  private tileSettings: TileSettingsMap;
  private dragRAF: number | null = null;
  private projectName: string = '';
  private openTileSettingsPanel: string | null = null;
  private globalTileSettingsEventsAttached = false;

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
    this.tileSettings = this.loadTileSettings();
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

  private loadTileSettings(): TileSettingsMap {
    const mergeSetting = (tileId: string, incoming: any) => {
      const defaults = DEFAULT_TILE_SETTINGS[tileId] || {};
      if (tileId === 'bcf-status-donut') {
        return {
          ...defaults,
          ...incoming,
          colors: {
            ...(defaults.colors || {}),
            ...((incoming && incoming.colors) || {}),
          },
        };
      }
      return { ...defaults, ...incoming };
    };

    try {
      const raw = localStorage.getItem(TILE_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) as TileSettingsMap : {};
      const merged: TileSettingsMap = {};

      Object.keys(DEFAULT_TILE_SETTINGS).forEach(tileId => {
        merged[tileId] = mergeSetting(tileId, parsed[tileId]);
      });

      return merged;
    } catch {
      return { ...DEFAULT_TILE_SETTINGS };
    }
  }

  private saveTileSettings(): void {
    try {
      localStorage.setItem(TILE_SETTINGS_KEY, JSON.stringify(this.tileSettings));
    } catch { /* ignore */ }
  }

  private getTileSettings(tileId: string): any {
    if (!this.tileSettings[tileId]) {
      this.tileSettings[tileId] = { ...(DEFAULT_TILE_SETTINGS[tileId] || {}) };
    }
    return this.tileSettings[tileId];
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private updateTileSetting(tileId: string, key: string, value: any): void {
    const settings = this.getTileSettings(tileId);
    settings[key] = value;
    if (tileId === 'recent-files-table' && (key === 'window' || key === 'extension')) {
      this.recentFilesPage = 1;
    }
    if (tileId === 'recent-bcf-table' && key === 'window') {
      this.recentBcfPage = 1;
    }
    this.saveTileSettings();
    this.refreshConfiguredTile(tileId);
  }

  private updateTileColorSetting(tileId: string, colorKey: string, value: string): void {
    const settings = this.getTileSettings(tileId);
    settings.colors = { ...(settings.colors || {}), [colorKey]: value };
    this.saveTileSettings();
    this.refreshConfiguredTile(tileId);
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
      this.attachTileSettingsEvents();
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
  // DATA LOADING (progressive — each source renders as soon as ready)
  // =============================================

  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  private getCacheKey(): string {
    return `trimble-dashboard-cache-${this.projectName || 'default'}`;
  }

  private loadFromCache(): boolean {
    try {
      const raw = sessionStorage.getItem(this.getCacheKey());
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (!cached.timestamp || Date.now() - cached.timestamp > Dashboard.CACHE_TTL_MS) return false;
      this.allTopics = (cached.topics || []).map((t: any) => ({ ...t, createdAt: new Date(t.createdAt), modifiedAt: new Date(t.modifiedAt) }));
      this.allFiles = (cached.files || []).map((f: any) => ({ ...f, uploadedAt: new Date(f.uploadedAt), lastModified: new Date(f.lastModified) }));
      this.allNotes = (cached.notes || []).map((n: any) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt) }));
      this.allViews = (cached.views || []).map((v: any) => ({ ...v, createdAt: new Date(v.createdAt) }));
      logger.info('✓ Loaded data from session cache');
      return true;
    } catch { return false; }
  }

  private saveToCache(): void {
    try {
      sessionStorage.setItem(this.getCacheKey(), JSON.stringify({
        timestamp: Date.now(),
        topics: this.allTopics,
        files: this.allFiles,
        notes: this.allNotes,
        views: this.allViews,
      }));
    } catch { /* quota exceeded, ignore */ }
  }

  private async loadAllData(): Promise<void> {
    const hasCache = this.loadFromCache();

    if (hasCache) {
      this.renderAllSections();
      this.hideLoader();
      this.loadThumbnails();
      this.refreshDataInBackground();
      return;
    }

    this.showLoader();

    const filesPromise = filesService.getAllFiles().catch(() => [] as ProjectFile[]);
    const topicsPromise = bcfService.getAllTopics().catch(() => [] as BCFTopic[]);
    const notesPromise = notesService.getActiveNotes().catch(() => [] as TrimbleNote[]);
    const viewsPromise = viewsService.getAllViews().catch(() => [] as ProjectView[]);

    let firstResolved = false;
    const onFirst = () => {
      if (firstResolved) return;
      firstResolved = true;
      this.hideLoader();
    };

    // IMPORTANT: each chart is rendered exactly ONCE (when its own dependency
    // is ready) to avoid the "double animation" effect. Previously this code
    // called renderCharts() from BOTH filesPromise.then and topicsPromise.then,
    // which re-created every chart twice — charts played their entry animation,
    // then replayed it a fraction of a second later when the second promise
    // settled.
    filesPromise.then(files => {
      this.allFiles = files;
      this.renderMetrics();
      this.refreshConfiguredTile('cumulative-chart');
      this.refreshConfiguredTile('deposit-freq-chart');
      this.refreshConfiguredTile('filetype-chart');
      this.refreshConfiguredTile('top-contributors');
      this.refreshConfiguredTile('top-updated-files');
      this.refreshConfiguredTile('recent-files-table');
      onFirst();
    });

    topicsPromise.then(topics => {
      this.allTopics = topics;
      this.renderMetrics();
      this.refreshConfiguredTile('bcf-status-donut');
      this.refreshConfiguredTile('bcf-created-resolved');
      this.renderBCFAssigneeChart();
      this.refreshConfiguredTile('oldest-unresolved-bcf');
      this.refreshConfiguredTile('recent-bcf-table');
      this.renderTopicCharts();
      onFirst();
    });

    notesPromise.then(notes => {
      this.allNotes = notes;
      this.renderTimeline();
      this.renderTeamSection();
      onFirst();
    });

    viewsPromise.then(views => {
      this.allViews = views;
      this.renderViewsSection();
      this.loadThumbnails();
      onFirst();
    });

    await Promise.all([filesPromise, topicsPromise, notesPromise, viewsPromise]);
    this.attachChartTypeSwitchers();
    this.hideLoader();
    this.saveToCache();
    logger.info('All data loaded and dashboard rendered');
  }

  private renderAllSections(): void {
    this.renderMetrics();
    this.refreshConfiguredTile('cumulative-chart');
    this.refreshConfiguredTile('deposit-freq-chart');
    this.refreshConfiguredTile('bcf-status-donut');
    this.refreshConfiguredTile('bcf-created-resolved');
    this.refreshConfiguredTile('filetype-chart');
    this.renderBCFAssigneeChart();
    this.refreshConfiguredTile('top-contributors');
    this.refreshConfiguredTile('top-updated-files');
    this.refreshConfiguredTile('oldest-unresolved-bcf');
    this.refreshConfiguredTile('recent-files-table');
    this.refreshConfiguredTile('recent-bcf-table');
    this.renderTopicCharts();
    this.renderViewsSection();
    this.renderTeamSection();
    this.renderTimeline();
    this.attachChartTypeSwitchers();
  }

  /**
   * Lightweight signature of the current dataset used to detect if a background
   * refresh actually brought new data. Avoids the unnecessary second animation
   * replay when cache and fresh data are identical.
   */
  private dataSignature(files: ProjectFile[], topics: BCFTopic[], notes: TrimbleNote[], views: ProjectView[]): string {
    const lastTs = (items: any[], ...fields: string[]) => {
      let max = 0;
      for (const it of items) {
        for (const f of fields) {
          const v = it?.[f];
          if (!v) continue;
          const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
          if (!isNaN(t) && t > max) max = t;
        }
      }
      return max;
    };
    return [
      files.length,
      topics.length,
      notes.length,
      views.length,
      lastTs(files, 'uploadedAt', 'lastModified'),
      lastTs(topics, 'modifiedAt', 'createdAt'),
      lastTs(notes, 'updatedAt', 'createdAt'),
      lastTs(views, 'createdAt'),
    ].join(':');
  }

  private async refreshDataInBackground(): Promise<void> {
    try {
      const [files, topics, notes, views] = await Promise.all([
        filesService.getAllFiles().catch(() => this.allFiles),
        bcfService.getAllTopics().catch(() => this.allTopics),
        notesService.getActiveNotes().catch(() => this.allNotes),
        viewsService.getAllViews().catch(() => this.allViews),
      ]);

      const oldSig = this.dataSignature(this.allFiles, this.allTopics, this.allNotes, this.allViews);
      const newSig = this.dataSignature(files, topics, notes, views);

      if (oldSig === newSig) {
        logger.info('✓ Background refresh: data unchanged, skipping re-render');
        this.saveToCache();
        return;
      }

      logger.info('Background refresh: data changed, silent re-render');
      this.allFiles = files;
      this.allTopics = topics;
      this.allNotes = notes;
      this.allViews = views;
      // Silent re-render: charts update in place without replaying their
      // entry animation (which would look like a "double animation" a few
      // seconds after the initial page load).
      this.chartsManager.setAnimationsEnabled(false);
      try {
        this.renderAllSections();
      } finally {
        this.chartsManager.setAnimationsEnabled(true);
      }
      this.saveToCache();
    } catch (error) {
      logger.warn('Background refresh failed', { error });
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

  private bindDragHandleForTile(tile: HTMLElement): void {
    const handle = tile.querySelector('.tile-drag-handle') as HTMLElement | null;
    if (!handle || handle.dataset.bound === 'true') return;
    handle.dataset.bound = 'true';
    handle.addEventListener('mousedown', () => tile.setAttribute('draggable', 'true'));
  }

  private attachTileSettingsEvents(scope: ParentNode = document): void {
    scope.querySelectorAll('.tile-settings-toggle').forEach(btn => {
      const boundBtn = btn as HTMLButtonElement;
      if (boundBtn.dataset.bound === 'true') return;
      boundBtn.dataset.bound = 'true';
      boundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tileId = boundBtn.dataset.tileId;
        if (!tileId) return;
        this.toggleTileSettingsPanel(tileId);
      });
    });

    scope.querySelectorAll('.tile-settings-close').forEach(btn => {
      const boundBtn = btn as HTMLButtonElement;
      if (boundBtn.dataset.bound === 'true') return;
      boundBtn.dataset.bound = 'true';
      boundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeOpenTileSettingsPanel();
      });
    });

    scope.querySelectorAll('.tile-option-btn').forEach(btn => {
      const boundBtn = btn as HTMLButtonElement;
      if (boundBtn.dataset.bound === 'true') return;
      boundBtn.dataset.bound = 'true';
      boundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tileId = boundBtn.dataset.tileId;
        const key = boundBtn.dataset.settingKey;
        const value = boundBtn.dataset.settingValue;
        if (!tileId || !key || value === undefined) return;
        this.updateTileSetting(tileId, key, value === 'all' ? 'all' : (/^\d+$/.test(value) ? Number(value) : value));
      });
    });

    scope.querySelectorAll('.tile-color-input').forEach(input => {
      const boundInput = input as HTMLInputElement;
      if (boundInput.dataset.bound === 'true') return;
      boundInput.dataset.bound = 'true';
      boundInput.addEventListener('input', (e) => {
        e.stopPropagation();
        const tileId = boundInput.dataset.tileId;
        const colorKey = boundInput.dataset.colorKey;
        if (!tileId || !colorKey) return;
        this.updateTileColorSetting(tileId, colorKey, boundInput.value);
      });
    });

    scope.querySelectorAll('.tile-range-input').forEach(input => {
      const boundInput = input as HTMLInputElement;
      if (boundInput.dataset.bound === 'true') return;
      boundInput.dataset.bound = 'true';
      boundInput.addEventListener('change', (e) => {
        e.stopPropagation();
        const tileId = boundInput.dataset.tileId;
        const key = boundInput.dataset.settingKey;
        if (!tileId || !key) return;
        this.updateTileSetting(tileId, key, Number(boundInput.value));
      });
    });

    if (!this.globalTileSettingsEventsAttached) {
      document.addEventListener('click', (e) => {
        if (!this.openTileSettingsPanel) return;
        const target = e.target as HTMLElement;
        if (target.closest('.tile-settings-wrapper')) return;
        this.closeOpenTileSettingsPanel();
      });
      this.globalTileSettingsEventsAttached = true;
    }
  }

  private closeOpenTileSettingsPanel(): void {
    if (!this.openTileSettingsPanel) return;
    const previous = this.openTileSettingsPanel;
    this.openTileSettingsPanel = null;
    this.refreshConfiguredTile(previous);
  }

  private toggleTileSettingsPanel(tileId: string): void {
    const previous = this.openTileSettingsPanel;
    this.openTileSettingsPanel = previous === tileId ? null : tileId;
    if (previous) this.refreshConfiguredTile(previous);
    if (this.openTileSettingsPanel) this.refreshConfiguredTile(tileId);
  }

  private refreshConfiguredTile(tileId: string): void {
    const tile = document.querySelector(`.tile[data-tile-id="${tileId}"]`) as HTMLElement | null;
    if (!tile) {
      this.renderTargetTileById(tileId);
      return;
    }

    const markup = this.getSettingsEnabledTileMarkup(tileId);
    if (!markup) {
      this.renderTargetTileById(tileId);
      return;
    }

    tile.innerHTML = `<div class="tile-drag-handle" title="Déplacer"><i class="modus-icon mi-drag-indicator" style="width:10px;height:10px"></i></div>${markup}`;
    this.bindDragHandleForTile(tile);
    this.attachTileSettingsEvents(tile);
    this.renderTargetTileById(tileId);
  }

  private renderTargetTileById(tileId: string): void {
    switch (tileId) {
      case 'bcf-status-donut':
        this.renderBCFStatusTile();
        break;
      case 'filetype-chart':
        this.renderFileTypeTile();
        break;
      case 'bcf-created-resolved':
        this.renderBCFCreatedResolvedChart();
        break;
      case 'cumulative-chart':
        this.renderCumulativeChart();
        break;
      case 'deposit-freq-chart':
        this.renderDepositFrequencyChart();
        break;
      case 'top-contributors':
        this.renderTopContributors();
        break;
      case 'top-updated-files':
        this.renderTopUpdatedFiles();
        break;
      case 'oldest-unresolved-bcf':
        this.renderOldestUnresolvedBCF();
        break;
      case 'recent-files-table':
        this.renderRecentFilesTable();
        break;
      case 'recent-bcf-table':
        this.renderRecentBCFTable();
        break;
      default:
        break;
    }
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

  /**
   * Matches the CSS `tile-enter` stagger (40ms per tile, capped at 800ms)
   * so chart animations start at the same moment their tile fades in.
   *
   * Used for line and bar charts where the progressive reveal / bar grow
   * is visible through a partial-opacity tile.
   */
  private getTileStartDelay(tileId: string): number {
    const idx = this.tileConfig.order.indexOf(tileId);
    if (idx < 0) return 0;
    return Math.min(800, idx * 40);
  }

  /**
   * Delay for circular charts (pie / doughnut). Rotation is a sweep — it's
   * only visible if the tile is already opaque when it starts. We therefore
   * wait for the tile's CSS fade-in (~600ms) to finish before kicking off
   * the rotation, then rotate cleanly over 2 seconds.
   */
  private getCircularChartDelay(tileId: string): number {
    return this.getTileStartDelay(tileId) + 600;
  }

  /**
   * Topic-dependent charts. Settings-driven tiles are refreshed separately so
   * this method only renders the remaining non-settings chart(s).
   */
  private renderTopicCharts(): void {
    const p: BCFPriorityData = { high: 0, medium: 0, low: 0 };
    this.allTopics.forEach(t => {
      const pr = (t.priority || 'Medium').toLowerCase();
      if (pr === 'high') p.high++; else if (pr === 'low') p.low++; else p.medium++;
    });

    this.chartsManager.createBCFPriorityChart(
      'bcf-priority-canvas',
      p,
      this.chartTypeState['bcf-priority'] || 'doughnut',
      (this.chartTypeState['bcf-priority'] || 'doughnut') === 'bar'
        ? this.getTileStartDelay('bcf-priority-chart')
        : this.getCircularChartDelay('bcf-priority-chart'),
    );
  }

  private startOfIsoWeek(date: Date): Date {
    const normalized = new Date(date);
    const day = normalized.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setDate(normalized.getDate() + diff);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private startOfPeriod(date: Date, period: PeriodMode): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    if (period === 'day') return normalized;
    if (period === 'week') return this.startOfIsoWeek(normalized);
    normalized.setDate(1);
    return normalized;
  }

  private addPeriods(date: Date, period: PeriodMode, amount: number): Date {
    const next = new Date(date);
    if (period === 'day') {
      next.setDate(next.getDate() + amount);
    } else if (period === 'week') {
      next.setDate(next.getDate() + (amount * 7));
    } else {
      next.setMonth(next.getMonth() + amount);
      next.setDate(1);
    }
    return this.startOfPeriod(next, period);
  }

  private formatPeriodLabel(date: Date, period: PeriodMode): string {
    return this.formatIsoDate(this.startOfPeriod(date, period));
  }

  private periodUnitLabel(period: PeriodMode, count: number, short: boolean = false): string {
    if (period === 'day') return short ? 'j.' : (count > 1 ? 'jours' : 'jour');
    if (period === 'week') return short ? 'sem.' : (count > 1 ? 'semaines' : 'semaine');
    return short ? 'mois' : 'mois';
  }

  private getWindowStart(windowKey: string): Date | null {
    const now = new Date();
    const mapping: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '180d': 180,
    };
    const days = mapping[windowKey];
    if (!days) return null;
    now.setDate(now.getDate() - days);
    return now;
  }

  private getFileTypeCounts(): Record<string, number> {
    const byExtension: Record<string, number> = {};
    this.allFiles.forEach(file => {
      const ext = (file.extension || 'other').toLowerCase();
      byExtension[ext] = (byExtension[ext] || 0) + 1;
    });
    return byExtension;
  }

  private getFileTypeFilterOptions(limit: number = 8): { value: string; label: string }[] {
    return Object.entries(this.getFileTypeCounts())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([ext]) => ({ value: ext, label: ext.toUpperCase() }));
  }

  private getFileTypeColor(extension: string): string {
    const palette: Record<string, string> = {
      ifc: '#0063a3',
      pdf: '#ef4444',
      dwg: '#f59e0b',
      rvt: '#10b981',
      nwd: '#8b5cf6',
      nwc: '#a855f7',
      png: '#ec4899',
      jpg: '#ec4899',
      jpeg: '#ec4899',
      zip: '#71717a',
      rar: '#71717a',
      html: '#f97316',
      mp4: '#14b8a6',
      docx: '#3b82f6',
      doc: '#3b82f6',
      xlsx: '#6366f1',
      xls: '#6366f1',
      txt: '#71717a',
    };
    return palette[extension.toLowerCase()] || '#94a3b8';
  }

  private getBCFStatusDataset(): { key: string; label: string; value: number; color: string }[] {
    const settings = this.getTileSettings('bcf-status-donut');
    const colors = settings.colors || DEFAULT_TILE_SETTINGS['bcf-status-donut'].colors;
    const data: BCFStatusData = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    this.allTopics.forEach(topic => {
      if (topic.status === 'Open') data.open++;
      else if (topic.status === 'In Progress') data.inProgress++;
      else if (topic.status === 'Resolved') data.resolved++;
      else data.closed++;
    });

    return [
      { key: 'inProgress', label: 'En cours', value: data.inProgress, color: colors.inProgress },
      { key: 'resolved', label: 'Waiting', value: data.resolved, color: colors.resolved },
      { key: 'closed', label: 'Closed', value: data.closed, color: colors.closed },
      { key: 'open', label: 'New', value: data.open, color: colors.open },
    ];
  }

  private renderTreemap(containerId: string, items: { label: string; value: number; color: string }[], emptyLabel: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const visibleItems = items.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    if (!visibleItems.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${emptyLabel}</div></div>`;
      return;
    }

    const total = visibleItems.reduce((sum, item) => sum + item.value, 0);

    const layout = (
      nodes: { label: string; value: number; color: string }[],
      x: number,
      y: number,
      width: number,
      height: number,
      vertical: boolean,
    ): string[] => {
      if (!nodes.length) return [];
      if (nodes.length === 1) {
        const node = nodes[0];
        return [`<div class="treemap-node" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%;background:${node.color}">
          <div class="treemap-node-content">
            <span class="treemap-node-label">${this.esc(node.label)}</span>
            <span class="treemap-node-value">${node.value}</span>
          </div>
        </div>`];
      }

      let splitIndex = 0;
      let running = 0;
      const half = nodes.reduce((sum, node) => sum + node.value, 0) / 2;
      while (splitIndex < nodes.length - 1 && running < half) {
        running += nodes[splitIndex].value;
        splitIndex++;
      }

      const first = nodes.slice(0, splitIndex);
      const second = nodes.slice(splitIndex);
      const firstValue = first.reduce((sum, node) => sum + node.value, 0);
      const ratio = firstValue / nodes.reduce((sum, node) => sum + node.value, 0);

      if (vertical) {
        const widthA = width * ratio;
        return [
          ...layout(first, x, y, widthA, height, !vertical),
          ...layout(second, x + widthA, y, width - widthA, height, !vertical),
        ];
      }

      const heightA = height * ratio;
      return [
        ...layout(first, x, y, width, heightA, !vertical),
        ...layout(second, x, y + heightA, width, height - heightA, !vertical),
      ];
    };

    container.innerHTML = `<div class="treemap-surface">${layout(visibleItems, 0, 0, 100, 100, true).join('')}</div>`;
    container.setAttribute('data-total', String(total));
  }

  private getCumulativeDataForPeriod(period: PeriodMode): { label: string; cumulative: number }[] {
    const counts = new Map<string, number>();
    this.allFiles.forEach(file => {
      const start = this.startOfPeriod(new Date(file.uploadedAt), period);
      const key = start.toISOString();
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const sorted = Array.from(counts.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    let cumulative = 0;
    return sorted.map(([iso, count]) => {
      cumulative += count;
      return { label: this.formatPeriodLabel(new Date(iso), period), cumulative };
    });
  }

  private getDepositFrequencyData(period: PeriodMode, range: RangeMode): { label: string; count: number }[] {
    const fileDates = this.allFiles.map(file => new Date(file.uploadedAt)).filter(date => !Number.isNaN(date.getTime()));
    const current = this.startOfPeriod(new Date(), period);
    const desiredCount = range === 'all'
      ? Math.max(1, fileDates.length ? this.getPeriodDistance(this.startOfPeriod(new Date(Math.min(...fileDates.map(date => date.getTime()))), period), current, period) + 1 : 1)
      : range;

    const data: { label: string; count: number }[] = [];
    for (let i = desiredCount - 1; i >= 0; i--) {
      const start = this.addPeriods(current, period, -i);
      const end = this.addPeriods(start, period, 1);
      const count = this.allFiles.filter(file => {
        const uploadedAt = new Date(file.uploadedAt);
        return uploadedAt >= start && uploadedAt < end;
      }).length;
      data.push({ label: this.formatPeriodLabel(start, period), count });
    }
    return data;
  }

  private getPeriodDistance(start: Date, end: Date, period: PeriodMode): number {
    if (period === 'day') {
      return Math.floor((end.getTime() - start.getTime()) / 86400000);
    }
    if (period === 'week') {
      return Math.floor((end.getTime() - start.getTime()) / (7 * 86400000));
    }
    return ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth());
  }

  private getAvailableTopicPeriodCount(period: PeriodMode): number {
    const timestamps = this.allTopics.flatMap(topic => {
      const values: number[] = [];
      const created = new Date(topic.createdAt).getTime();
      const modified = new Date(topic.modifiedAt).getTime();
      if (!Number.isNaN(created)) values.push(created);
      if (!Number.isNaN(modified)) values.push(modified);
      return values;
    });

    if (!timestamps.length) return 1;

    const earliest = this.startOfPeriod(new Date(Math.min(...timestamps)), period);
    const current = this.startOfPeriod(new Date(), period);
    return Math.max(1, this.getPeriodDistance(earliest, current, period) + 1);
  }

  private getBCFCreatedResolvedRangeCount(period: PeriodMode): number {
    const settings = this.getTileSettings('bcf-created-resolved');
    const available = this.getAvailableTopicPeriodCount(period);
    const fallback = Math.min(7, available);
    const requested = Number(settings.rangeCount || fallback);
    return Math.min(Math.max(1, requested), available);
  }

  private getBCFCreatedResolvedSummaryLabel(period: PeriodMode): string {
    const count = this.getBCFCreatedResolvedRangeCount(period);
    return `${count} ${this.periodUnitLabel(period, count, true)}`;
  }

  private bcfCreatedResolvedRangeSliderHtml(period: PeriodMode): string {
    const available = this.getAvailableTopicPeriodCount(period);
    const current = this.getBCFCreatedResolvedRangeCount(period);
    return `<div class="time-range-slider" aria-label="Plage du graphique BCF créés vs résolus">
      <div class="time-range-slider-labels">
        <span>1 ${this.periodUnitLabel(period, 1, true)}</span>
        <span>Tout</span>
      </div>
      <input
        class="tile-range-input"
        type="range"
        min="1"
        max="${available}"
        step="1"
        value="${current}"
        data-tile-id="bcf-created-resolved"
        data-setting-key="rangeCount"
      />
    </div>`;
  }

  private getBCFCreatedResolvedData(period: PeriodMode, rangeCount: number): { label: string; created: number; resolved: number }[] {
    const current = this.startOfPeriod(new Date(), period);
    const points: { label: string; created: number; resolved: number }[] = [];

    for (let i = rangeCount - 1; i >= 0; i--) {
      const start = this.addPeriods(current, period, -i);
      const end = this.addPeriods(start, period, 1);
      const created = this.allTopics.filter(topic => {
        const createdAt = new Date(topic.createdAt);
        return createdAt >= start && createdAt < end;
      }).length;
      const resolved = this.allTopics.filter(topic => {
        if (topic.status !== 'Resolved' && topic.status !== 'Closed') return false;
        const modifiedAt = new Date(topic.modifiedAt);
        return modifiedAt >= start && modifiedAt < end;
      }).length;
      points.push({ label: this.formatPeriodLabel(start, period), created, resolved });
    }

    return points;
  }

  private renderBCFStatusTile(): void {
    const settings = this.getTileSettings('bcf-status-donut');
    const chartType = settings.chartType || 'treemap';
    const items = this.getBCFStatusDataset();
    const canvas = document.getElementById('bcf-status-donut-canvas') as HTMLCanvasElement | null;
    const treemap = document.getElementById('bcf-status-treemap');

    if (chartType === 'treemap') {
      this.chartsManager.destroyChartByKey('bcfStatusDonut');
      if (canvas) canvas.style.display = 'none';
      if (treemap) treemap.style.display = 'block';
      this.renderTreemap('bcf-status-treemap', items, 'Aucun statut');
      return;
    }

    if (treemap) {
      treemap.innerHTML = '';
      treemap.style.display = 'none';
    }
    if (canvas) canvas.style.display = 'block';

    const data: BCFStatusData = {
      open: items.find(item => item.key === 'open')?.value || 0,
      inProgress: items.find(item => item.key === 'inProgress')?.value || 0,
      resolved: items.find(item => item.key === 'resolved')?.value || 0,
      closed: items.find(item => item.key === 'closed')?.value || 0,
    };

    this.chartsManager.createBCFStatusDonutChart(
      'bcf-status-donut-canvas',
      data,
      chartType,
      (chartType === 'pie' || chartType === 'doughnut')
        ? this.getCircularChartDelay('bcf-status-donut')
        : this.getTileStartDelay('bcf-status-donut'),
      {
        open: items.find(item => item.key === 'open')?.color,
        inProgress: items.find(item => item.key === 'inProgress')?.color,
        resolved: items.find(item => item.key === 'resolved')?.color,
        closed: items.find(item => item.key === 'closed')?.color,
      },
    );
  }

  private renderFileTypeTile(): void {
    const settings = this.getTileSettings('filetype-chart');
    const chartType = settings.chartType || 'treemap';
    const byExtension = this.getFileTypeCounts();
    const items = Object.entries(byExtension).map(([ext, value]) => ({
      label: ext.toUpperCase(),
      value,
      color: this.getFileTypeColor(ext),
    }));
    const canvas = document.getElementById('filetype-canvas') as HTMLCanvasElement | null;
    const treemap = document.getElementById('filetype-treemap');

    if (chartType === 'treemap') {
      this.chartsManager.destroyChartByKey('fileType');
      if (canvas) canvas.style.display = 'none';
      if (treemap) treemap.style.display = 'block';
      this.renderTreemap('filetype-treemap', items, 'Aucun type de fichier');
      return;
    }

    if (treemap) {
      treemap.innerHTML = '';
      treemap.style.display = 'none';
    }
    if (canvas) canvas.style.display = 'block';

    this.chartsManager.createFileTypeChart(
      'filetype-canvas',
      byExtension,
      chartType === 'column' ? 'bar' : chartType,
      chartType === 'pie' || chartType === 'doughnut'
        ? this.getCircularChartDelay('filetype-chart')
        : this.getTileStartDelay('filetype-chart'),
    );
  }

  private renderCumulativeChart(): void {
    const settings = this.getTileSettings('cumulative-chart');
    const period = (settings.period || 'month') as PeriodMode;
    const chartType = settings.chartType || 'area';
    const data = this.getCumulativeDataForPeriod(period);
    this.chartsManager.createCumulativeChart(
      'cumulative-canvas',
      data,
      chartType,
      this.getTileStartDelay('cumulative-chart'),
    );
  }

  private renderDepositFrequencyChart(): void {
    const settings = this.getTileSettings('deposit-freq-chart');
    const period = (settings.period || 'week') as PeriodMode;
    const range = (settings.range || 26) as RangeMode;
    const chartType = settings.chartType || 'bar';
    const data = this.getDepositFrequencyData(period, range);
    this.chartsManager.createDepositFrequencyChart(
      'deposit-freq-canvas',
      data,
      chartType === 'column' ? 'bar' : chartType,
      this.getTileStartDelay('deposit-freq-chart'),
    );
  }

  private renderBCFCreatedResolvedChart(withStagger: boolean = true): void {
    const settings = this.getTileSettings('bcf-created-resolved');
    const period = (settings.period || 'week') as PeriodMode;
    const chartType = settings.chartType || 'line';
    const rangeCount = this.getBCFCreatedResolvedRangeCount(period);
    const data = this.getBCFCreatedResolvedData(period, rangeCount);
    const delay = withStagger ? this.getTileStartDelay('bcf-created-resolved') : 0;
    this.chartsManager.createBCFCreatedResolvedChart('bcf-created-resolved-canvas', data, chartType, delay);
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
        <div class="hbar-bar-wrapper"><div class="hbar-bar" style="width:${pct}%;background:${barColors[i % barColors.length]};--reveal-delay:${Math.min(540, i * 70)}ms"></div></div>
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
    const settings = this.getTileSettings('top-contributors');
    const top = settings.top as TopMode;

    const byUploader: Record<string, number> = {};
    this.allFiles.forEach(f => {
      if (f.uploadedBy && f.uploadedBy !== '—') {
        byUploader[f.uploadedBy] = (byUploader[f.uploadedBy] || 0) + 1;
      }
    });

    const sortedAll = Object.entries(byUploader).sort((a, b) => b[1] - a[1]);
    const sorted = top === 'all' ? sortedAll : sortedAll.slice(0, top);
    if (!sorted.length) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun contributeur</div></div>'; return; }

    const max = sorted[0][1];

    container.innerHTML = sorted.map(([name, count], i) => {
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      return `<div class="hbar-item">
        <span class="hbar-rank">${i + 1}</span>
        <span class="hbar-label" title="${this.esc(name)}">${this.esc(name)}</span>
        <div class="hbar-bar-wrapper"><div class="hbar-bar" style="width:${pct}%;background:#0ea5e9;--reveal-delay:${Math.min(540, i * 70)}ms"></div></div>
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
    const settings = this.getTileSettings('top-updated-files');
    const top = (settings.top || 20) as TopMode;

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
      .slice(0, top === 'all' ? undefined : top);

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
        <td style="width:8rem"><div class="version-bar"><div class="version-bar-fill" style="width:${pct}%;background:${color};--reveal-delay:${Math.min(700, i * 55)}ms"></div><span class="version-bar-label">${count}v</span></div></td>
      </tr>`;
    }).join('');
  }

  // =============================================
  // OLDEST UNRESOLVED BCF
  // =============================================

  private renderOldestUnresolvedBCF(): void {
    const tbody = document.getElementById('oldest-bcf-body');
    if (!tbody) return;
    const settings = this.getTileSettings('oldest-unresolved-bcf');
    const top = (settings.top || 3) as TopMode;

    const unresolved = this.allTopics
      .filter(t => t.status !== 'Closed' && t.status !== 'Resolved')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, top === 'all' ? undefined : top);

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
    const filtered = this.getRecentFilesFiltered();
    const sorted = [...filtered].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
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
    const filtered = this.getRecentBcfFiltered();
    const sorted = [...filtered].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
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
      const boundBtn = btn as HTMLButtonElement;
      if (boundBtn.dataset.bound === 'true') return;
      boundBtn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const chartId = target.dataset.chartId;
        const chartType = target.dataset.chartType;
        if (!chartId || !chartType) return;
        if (target.classList.contains('active')) return;

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

  private formatResultsTitle(base: string, count: number): string {
    return `${base} — ${count} résultat${count > 1 ? 's' : ''}`;
  }

  private getRecentFilesFiltered(): ProjectFile[] {
    const settings = this.getTileSettings('recent-files-table');
    const startDate = this.getWindowStart(settings.window || '30d');
    const extension = settings.extension || 'all';
    return this.allFiles.filter(file => {
      const uploadedAt = new Date(file.uploadedAt);
      if (startDate && uploadedAt < startDate) return false;
      if (extension !== 'all' && (file.extension || 'other').toLowerCase() !== extension) return false;
      return true;
    });
  }

  private getRecentBcfFiltered(): BCFTopic[] {
    const settings = this.getTileSettings('recent-bcf-table');
    const startDate = this.getWindowStart(settings.window || '30d');
    return this.allTopics.filter(topic => !startDate || new Date(topic.modifiedAt) >= startDate);
  }

  private tileSettingsPanelHtml(tileId: string, title: string, contentHtml: string, summaryText?: string): string {
    const isOpen = this.openTileSettingsPanel === tileId;
    return `<div class="tile-settings-wrapper">
      ${summaryText ? `<span class="tile-summary-chip">${summaryText}</span>` : ''}
      <button class="tile-settings-toggle ${isOpen ? 'active' : ''}" type="button" data-tile-id="${tileId}" aria-label="Ouvrir les réglages">
        <i class="modus-icon mi-settings"></i>
      </button>
      <div class="tile-settings-panel ${isOpen ? 'open' : ''}" data-tile-id="${tileId}">
        <div class="tile-settings-header">
          <h4>${this.esc(title)}</h4>
          <button class="tile-settings-close" type="button" aria-label="Fermer">&times;</button>
        </div>
        ${contentHtml}
      </div>
    </div>`;
  }

  private settingsChoiceGroupHtml(
    tileId: string,
    settingKey: string,
    label: string,
    options: Array<{ value: string | number; label: string }>,
    currentValue: string | number,
  ): string {
    return `<div class="tile-settings-group">
      <div class="tile-settings-label">${label}</div>
      <div class="tile-option-group">${options.map(option => `
        <button
          class="tile-option-btn ${String(currentValue) === String(option.value) ? 'active' : ''}"
          type="button"
          data-tile-id="${tileId}"
          data-setting-key="${settingKey}"
          data-setting-value="${option.value}"
        >${option.label}</button>`).join('')}
      </div>
    </div>`;
  }

  private bcfStatusColorSettingsHtml(): string {
    const items = this.getBCFStatusDataset();
    return `<div class="tile-settings-group">
      <div class="tile-settings-label">Couleurs des statuts</div>
      <div class="tile-color-list">${items.map(item => `
        <label class="tile-color-row">
          <input class="tile-color-input" type="color" value="${item.color}" data-tile-id="bcf-status-donut" data-color-key="${item.key}" />
          <span class="tile-color-label">${this.esc(item.label)}</span>
          <span class="tile-color-preview" style="background:${item.color}">${this.esc(item.label)}</span>
        </label>`).join('')}
      </div>
    </div>`;
  }

  private getSettingsEnabledTileMarkup(tileId: string): string {
    switch (tileId) {
      case 'bcf-status-donut':
        return this.bcfStatusTileHtml();
      case 'filetype-chart':
        return this.fileTypeTileHtml();
      case 'bcf-created-resolved':
        return this.bcfCreatedResolvedTileHtml();
      case 'cumulative-chart':
        return this.cumulativeTileHtml();
      case 'deposit-freq-chart':
        return this.depositFrequencyTileHtml();
      case 'top-contributors':
        return this.topContributorsTileHtml();
      case 'top-updated-files':
        return this.topUpdatedFilesTileHtml();
      case 'oldest-unresolved-bcf':
        return this.oldestUnresolvedTileHtml();
      case 'recent-files-table':
        return this.recentFilesTileHtml();
      case 'recent-bcf-table':
        return this.recentBcfTileHtml();
      default:
        return '';
    }
  }

  private bcfStatusTileHtml(): string {
    const settings = this.getTileSettings('bcf-status-donut');
    const panel = this.tileSettingsPanelHtml(
      'bcf-status-donut',
      'Réglages — BCF par statut',
      [
        this.settingsChoiceGroupHtml('bcf-status-donut', 'chartType', 'Forme du graphique', [
          { value: 'pie', label: 'Camembert' },
          { value: 'column', label: 'Colonnes' },
          { value: 'bar', label: 'Barres' },
          { value: 'treemap', label: 'Treemap' },
          { value: 'radar', label: 'Radar' },
        ], settings.chartType || 'treemap'),
        this.bcfStatusColorSettingsHtml(),
      ].join(''),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>BCF par statut</h3>
        ${panel}
      </div>
      <div class="card-content">
        <div class="chart-container">
          <canvas id="bcf-status-donut-canvas"></canvas>
          <div id="bcf-status-treemap" class="treemap-container" style="display:none"></div>
        </div>
      </div>
    </div>`;
  }

  private fileTypeTileHtml(): string {
    const settings = this.getTileSettings('filetype-chart');
    const panel = this.tileSettingsPanelHtml(
      'filetype-chart',
      'Réglages',
      this.settingsChoiceGroupHtml('filetype-chart', 'chartType', 'Type de graphique', [
        { value: 'pie', label: 'Camembert' },
        { value: 'doughnut', label: 'Donut' },
        { value: 'column', label: 'Colonnes' },
        { value: 'treemap', label: 'Treemap' },
      ], settings.chartType || 'treemap'),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>Fichiers par type</h3>
        ${panel}
      </div>
      <div class="card-content">
        <div class="chart-container">
          <canvas id="filetype-canvas"></canvas>
          <div id="filetype-treemap" class="treemap-container" style="display:none"></div>
        </div>
      </div>
    </div>`;
  }

  private bcfCreatedResolvedTileHtml(): string {
    const settings = this.getTileSettings('bcf-created-resolved');
    const period = (settings.period || 'week') as PeriodMode;
    const panel = this.tileSettingsPanelHtml(
      'bcf-created-resolved',
      'Réglages',
      [
        this.settingsChoiceGroupHtml('bcf-created-resolved', 'chartType', 'Type de graphique', [
          { value: 'line', label: 'Courbes' },
          { value: 'area', label: 'Aires' },
          { value: 'bar', label: 'Colonnes' },
        ], settings.chartType || 'line'),
        this.settingsChoiceGroupHtml('bcf-created-resolved', 'period', 'Période', [
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ], period),
      ].join(''),
      this.getBCFCreatedResolvedSummaryLabel(period),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>BCF créés vs résolus dans le temps</h3>
        ${panel}
      </div>
      <div class="card-content">
        ${this.bcfCreatedResolvedRangeSliderHtml(period)}
        <div class="chart-container"><canvas id="bcf-created-resolved-canvas"></canvas></div>
      </div>
    </div>`;
  }

  private cumulativeTileHtml(): string {
    const settings = this.getTileSettings('cumulative-chart');
    const panel = this.tileSettingsPanelHtml(
      'cumulative-chart',
      'Réglages',
      [
        this.settingsChoiceGroupHtml('cumulative-chart', 'chartType', 'Type de graphique', [
          { value: 'area', label: 'Aire' },
          { value: 'line', label: 'Courbe' },
          { value: 'bar', label: 'Colonnes' },
        ], settings.chartType || 'area'),
        this.settingsChoiceGroupHtml('cumulative-chart', 'period', 'Période', [
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ], settings.period || 'month'),
      ].join(''),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>Fichiers déposés — évolution cumulative</h3>
        ${panel}
      </div>
      <div class="card-content"><div class="chart-container chart-tall"><canvas id="cumulative-canvas"></canvas></div></div>
    </div>`;
  }

  private depositFrequencyTitle(): string {
    const settings = this.getTileSettings('deposit-freq-chart');
    const period = (settings.period || 'week') as PeriodMode;
    const range = (settings.range || 26) as RangeMode;
    if (range === 'all') return 'Fréquence de dépôt (toute la période)';
    return `Fréquence de dépôt (${range} dernières ${this.periodUnitLabel(period, range).toLowerCase()})`;
  }

  private depositFrequencyTileHtml(): string {
    const settings = this.getTileSettings('deposit-freq-chart');
    const period = (settings.period || 'week') as PeriodMode;
    const panel = this.tileSettingsPanelHtml(
      'deposit-freq-chart',
      'Réglages',
      [
        this.settingsChoiceGroupHtml('deposit-freq-chart', 'chartType', 'Type de graphique', [
          { value: 'bar', label: 'Colonnes' },
          { value: 'line', label: 'Courbe' },
        ], settings.chartType || 'bar'),
        this.settingsChoiceGroupHtml('deposit-freq-chart', 'period', 'Période', [
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ], period),
        this.settingsChoiceGroupHtml('deposit-freq-chart', 'range', 'Plage affichée', [
          { value: 12, label: `12 ${this.periodUnitLabel(period, 12, true)}` },
          { value: 26, label: `26 ${this.periodUnitLabel(period, 26, true)}` },
          { value: 52, label: `52 ${this.periodUnitLabel(period, 52, true)}` },
          { value: 'all', label: 'Tout' },
        ], settings.range || 26),
      ].join(''),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>${this.depositFrequencyTitle()}</h3>
        ${panel}
      </div>
      <div class="card-content"><div class="chart-container chart-tall"><canvas id="deposit-freq-canvas"></canvas></div></div>
    </div>`;
  }

  private topContributorsTileHtml(): string {
    const settings = this.getTileSettings('top-contributors');
    const top = settings.top as TopMode;
    const label = top === 'all' ? 'Contributeurs (fichiers déposés)' : `Top ${top} contributeurs (fichiers déposés)`;
    const panel = this.tileSettingsPanelHtml(
      'top-contributors',
      'Réglages',
      this.settingsChoiceGroupHtml('top-contributors', 'top', 'Nombre à afficher', [
        { value: 5, label: 'Top 5' },
        { value: 10, label: 'Top 10' },
        { value: 20, label: 'Top 20' },
        { value: 'all', label: 'Tout' },
      ], top || 'all'),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>${label}</h3>
        ${panel}
      </div>
      <div class="card-content"><div id="top-contributors-list" class="hbar-list" style="padding:0.5rem 0"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div>
    </div>`;
  }

  private topUpdatedFilesTileHtml(): string {
    const settings = this.getTileSettings('top-updated-files');
    const top = settings.top || 20;
    const panel = this.tileSettingsPanelHtml(
      'top-updated-files',
      'Réglages',
      this.settingsChoiceGroupHtml('top-updated-files', 'top', 'Nombre à afficher', [
        { value: 5, label: 'Top 5' },
        { value: 10, label: 'Top 10' },
        { value: 20, label: 'Top 20' },
      ], top),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>Top ${top} — Fichiers les plus mis à jour (nouvelles versions)</h3>
        ${panel}
      </div>
      <div class="card-content" style="padding:0"><div class="table-wrapper"><table class="table">
        <thead><tr><th style="width:2rem">#</th><th>Nom</th><th style="width:8rem">Versions</th></tr></thead>
        <tbody id="top-updated-files-body"><tr><td colspan="3" class="text-center" style="padding:1rem;color:var(--muted-foreground)">Chargement...</td></tr></tbody>
      </table></div></div>
    </div>`;
  }

  private oldestUnresolvedTileHtml(): string {
    const settings = this.getTileSettings('oldest-unresolved-bcf');
    const top = settings.top || 3;
    const panel = this.tileSettingsPanelHtml(
      'oldest-unresolved-bcf',
      'Réglages',
      this.settingsChoiceGroupHtml('oldest-unresolved-bcf', 'top', 'Nombre à afficher', [
        { value: 3, label: 'Top 3' },
        { value: 5, label: 'Top 5' },
        { value: 10, label: 'Top 10' },
      ], top),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>Top ${top} — BCF non résolus les plus anciens</h3>
        ${panel}
      </div>
      <div class="card-content" style="padding:0"><div class="table-wrapper"><table class="table">
        <thead><tr><th>N°</th><th>Statut</th><th>Titre</th><th>Assigné à</th><th>Créé le</th><th>Âge</th></tr></thead>
        <tbody id="oldest-bcf-body"><tr><td colspan="6" class="text-center" style="padding:1rem;color:var(--muted-foreground)">Chargement...</td></tr></tbody>
      </table></div></div>
    </div>`;
  }

  private recentFilesTileHtml(): string {
    const settings = this.getTileSettings('recent-files-table');
    const count = this.getRecentFilesFiltered().length;
    const filterOptions = [{ value: 'all', label: 'Tous' }, ...this.getFileTypeFilterOptions()];
    const panel = this.tileSettingsPanelHtml(
      'recent-files-table',
      'Réglages',
      [
        this.settingsChoiceGroupHtml('recent-files-table', 'window', 'Fenêtre temporelle', [
          { value: '7d', label: '7j' },
          { value: '30d', label: '30j' },
          { value: '90d', label: '90j' },
          { value: '180d', label: '180j' },
          { value: 'all', label: 'Tout' },
        ], settings.window || '30d'),
        this.settingsChoiceGroupHtml('recent-files-table', 'extension', 'Filtre par type', filterOptions, settings.extension || 'all'),
      ].join(''),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>${this.formatResultsTitle('Fichiers récents', count)}</h3>
        ${panel}
      </div>
      <div class="card-content" style="padding:0"><div id="recent-files-container"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div>
    </div>`;
  }

  private recentBcfTileHtml(): string {
    const settings = this.getTileSettings('recent-bcf-table');
    const count = this.getRecentBcfFiltered().length;
    const panel = this.tileSettingsPanelHtml(
      'recent-bcf-table',
      'Réglages',
      this.settingsChoiceGroupHtml('recent-bcf-table', 'window', 'Fenêtre temporelle', [
        { value: '7d', label: '7j' },
        { value: '30d', label: '30j' },
        { value: '90d', label: '90j' },
        { value: '180d', label: '180j' },
        { value: 'all', label: 'Tout' },
      ], settings.window || '30d'),
    );

    return `<div class="card">
      <div class="card-header">
        <h3>${this.formatResultsTitle('BCF récents', count)}</h3>
        ${panel}
      </div>
      <div class="card-content" style="padding:0"><div id="recent-bcf-container"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div>
    </div>`;
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

      'cumulative-chart': this.cumulativeTileHtml(),
      'deposit-freq-chart': this.depositFrequencyTileHtml(),
      'bcf-status-donut': this.bcfStatusTileHtml(),
      'bcf-created-resolved': this.bcfCreatedResolvedTileHtml(),
      'bcf-priority-chart': `<div class="card"><div class="card-header"><h3>BCF par priorité</h3>${this.chartTypeSwitcher('bcf-priority', ['doughnut', 'bar', 'pie'])}</div><div class="card-content"><div class="chart-container"><canvas id="bcf-priority-canvas"></canvas></div></div></div>`,
      'bcf-assignee-chart': `<div class="card"><div class="card-header"><h3>BCF par personne assignée</h3><span class="card-icon"><i class="modus-icon mi-people-group"></i></span></div><div class="card-content"><div id="bcf-assignee-list" class="hbar-list" style="padding:0.5rem 0"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>`,
      'filetype-chart': this.fileTypeTileHtml(),
      'top-contributors': this.topContributorsTileHtml(),

      'top-updated-files': this.topUpdatedFilesTileHtml(),

      'oldest-unresolved-bcf': this.oldestUnresolvedTileHtml(),

      'recent-files-table': this.recentFilesTileHtml(),

      'recent-bcf-table': this.recentBcfTileHtml(),

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
