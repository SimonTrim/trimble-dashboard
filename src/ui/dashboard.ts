/**
 * Dashboard principal — shadcn/ui design
 * Full-width, draggable tiles, customizable layout, thumbnails
 */

import {
  DashboardConfig, ProjectFile, BCFTopic, TrimbleNote, ProjectView,
  BCFStatusData, BCFPriorityData, FileTrendDataPoint,
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
// TILE CONFIGURATION
// =============================================

interface TileConfig {
  order: string[];
  hidden: string[];
}

const STORAGE_KEY = 'trimble-dashboard-tiles';

const TILE_DEFS = [
  { id: 'metrics', label: 'Métriques', icon: '📊' },
  { id: 'charts-bcf', label: 'Graphiques BCF', icon: '📊' },
  { id: 'charts-files', label: 'Graphiques Fichiers', icon: '📈' },
  { id: 'bcf-table', label: 'Topics BCF', icon: '📋' },
  { id: 'files-table', label: 'Fichiers Récents', icon: '📁' },
  { id: 'team-timeline', label: 'Équipe & Activité', icon: '👥' },
  { id: 'views', label: 'Vues 3D', icon: '👁️' },
];

const DEFAULT_ORDER = TILE_DEFS.map(t => t.id);

// =============================================
// DASHBOARD CLASS
// =============================================

export class Dashboard {
  private chartsManager: ChartsManager;
  private config: DashboardConfig;
  private containerId: string;
  private tileConfig: TileConfig;

  private allTopics: BCFTopic[] = [];
  private allFiles: ProjectFile[] = [];
  private allNotes: TrimbleNote[] = [];
  private allViews: ProjectView[] = [];

  constructor(containerId: string = 'app', config?: Partial<DashboardConfig>) {
    this.containerId = containerId;
    this.chartsManager = new ChartsManager();
    this.config = {
      refreshInterval: 0,
      recentFilesThreshold: 48,
      maxRecentFilesDisplay: 10,
      enableAutoRefresh: false,
      ...config,
    };
    this.tileConfig = this.loadTileConfig();
    logger.info('Dashboard initialized');
  }

  // =============================================
  // TILE CONFIG PERSISTENCE
  // =============================================

  private loadTileConfig(): TileConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cfg = JSON.parse(raw) as TileConfig;
        // Merge with defaults (in case new tiles were added)
        const knownIds = new Set(DEFAULT_ORDER);
        const order = cfg.order.filter(id => knownIds.has(id));
        DEFAULT_ORDER.forEach(id => { if (!order.includes(id)) order.push(id); });
        return { order, hidden: cfg.hidden || [] };
      }
    } catch (e) { /* ignore */ }
    return { order: [...DEFAULT_ORDER], hidden: [] };
  }

  private saveTileConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tileConfig));
    } catch (e) { /* ignore */ }
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
        errorHandler.createError('INITIALIZATION_ERROR' as any, error),
        'error-container'
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
      this.renderBCFTable();
      this.renderFilesTable();
      this.renderViewsSection();
      this.renderTeamSection();
      this.renderTimeline();

      this.hideLoader();

      // Load thumbnails async (non-blocking)
      this.loadThumbnails();
    } catch (error) {
      this.hideLoader();
      logger.error('Data load error', { error });
    }
  }

  // =============================================
  // HEADER EVENTS (export, settings)
  // =============================================

  private attachHeaderEvents(): void {
    document.getElementById('btn-export')?.addEventListener('click', () => window.print());

    const settingsBtn = document.getElementById('btn-settings');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsBtn && settingsPanel) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target as Node) && e.target !== settingsBtn) {
          settingsPanel.style.display = 'none';
        }
      });
    }

    // Settings checkboxes
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

    // Enable drag only from handle
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
      tile.classList.add('dragging');
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
      container.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-over'));
      this.saveTileOrder();
    });

    container.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!draggedTile) return;
      const afterEl = this.getDragAfterElement(container, e.clientY);
      container.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-over'));
      if (afterEl && afterEl !== draggedTile) {
        afterEl.classList.add('drag-over');
        container.insertBefore(draggedTile, afterEl);
      } else if (!afterEl) {
        container.appendChild(draggedTile);
      }
    });
  }

  private getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
    const tiles = Array.from(container.querySelectorAll('.tile:not(.dragging)'));
    let closest: { element: HTMLElement | null; offset: number } = { element: null, offset: Number.POSITIVE_INFINITY };

    tiles.forEach(tile => {
      const rect = tile.getBoundingClientRect();
      const offset = y - rect.top - rect.height / 2;
      if (offset < 0 && offset > -closest.offset) {
        closest = { element: tile as HTMLElement, offset: -offset };
      }
    });
    return closest.element;
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
  // METRICS + TRENDS
  // =============================================

  private renderMetrics(): void {
    const active = this.allTopics.filter(t => t.status !== 'Closed');
    const recent = this.getRecentFiles(this.config.recentFilesThreshold);
    const w = new Date(); w.setDate(w.getDate() - 7);

    this.setMetric('notes-count', this.allNotes.length, this.trend(this.allNotes, w), 'Notes non archivées');
    this.setMetric('bcf-count', active.length, this.trend(this.allTopics, w), 'Topics non fermés');
    this.setMetric('files-count', recent.length, this.trend(this.allFiles, w, 'uploadedAt'), `Dernières ${this.config.recentFilesThreshold}h`);
    this.setMetric('views-count', this.allViews.length, this.trend(this.allViews, w), 'Vues sauvegardées');
  }

  private trend(items: any[], since: Date, field: string = 'createdAt'): TrendData {
    const n = items.filter(i => new Date(i[field] || i.createdAt || i.uploadedAt) >= since).length;
    return { current: items.length, previous: items.length - n, direction: n > 0 ? 'up' : 'neutral', changeCount: n };
  }

  private setMetric(id: string, value: number, t: TrendData, desc: string): void {
    const v = document.getElementById(id);
    if (v) v.textContent = value.toString();
    const tr = document.getElementById(`${id}-trend`);
    if (tr) {
      tr.className = `metric-trend trend-${t.direction}`;
      tr.innerHTML = t.changeCount > 0
        ? `<span>↑</span> +${t.changeCount} cette semaine`
        : '<span>─</span> Stable';
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

    this.chartsManager.createBCFChart('bcf-chart', s);
    this.chartsManager.createBCFPriorityChart('bcf-priority-chart', p);

    const today = new Date();
    const ft: FileTrendDataPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const n = new Date(d); n.setDate(n.getDate() + 1);
      ft.push({ date: d.toISOString().split('T')[0], count: this.allFiles.filter(f => { const fd = new Date(f.uploadedAt); return fd >= d && fd < n; }).length });
    }
    this.chartsManager.createFilesTrendChart('files-chart', ft);

    const ext: Record<string, number> = {};
    this.allFiles.forEach(f => { const e = (f.extension || 'other').toLowerCase(); ext[e] = (ext[e] || 0) + 1; });
    this.chartsManager.createFileTypeChart('filetype-chart', ext);
  }

  // =============================================
  // BCF TABLE
  // =============================================

  private renderBCFTable(): void {
    const tbody = document.getElementById('bcf-table-body');
    if (!tbody) return;
    const topics = [...this.allTopics].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()).slice(0, 15);
    if (!topics.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Aucun topic BCF</div></td></tr>'; return; }
    tbody.innerHTML = topics.map(t => `<tr>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(t.title)}">${this.esc(t.title)}</td>
      <td><span class="badge badge-${this.statusCls(t.status)}">${t.status}</span></td>
      <td><span class="badge badge-${(t.priority||'medium').toLowerCase()}">${t.priority||'Medium'}</span></td>
      <td style="color:var(--muted-foreground)">${this.esc(t.assignedTo||'—')}</td>
      <td style="color:var(--muted-foreground);white-space:nowrap">${this.fmtDate(t.modifiedAt)}</td>
    </tr>`).join('');
  }

  // =============================================
  // FILES TABLE
  // =============================================

  private renderFilesTable(): void {
    const tbody = document.getElementById('files-table-body');
    if (!tbody) return;
    const files = [...this.allFiles].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, this.config.maxRecentFilesDisplay);
    if (!files.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-text">Aucun fichier</div></td></tr>'; return; }
    tbody.innerHTML = files.map(f => `<tr>
      <td><span class="file-icon">${this.fileIcon(f.extension)}</span><span class="file-name" title="${this.esc(f.name)}">${this.esc(f.name)}</span></td>
      <td style="color:var(--muted-foreground);white-space:nowrap">${this.fmtDate(f.uploadedAt)}</td>
      <td style="color:var(--muted-foreground)">${this.esc(f.uploadedBy)}</td>
    </tr>`).join('');
  }

  // =============================================
  // VIEWS + THUMBNAILS
  // =============================================

  private renderViewsSection(): void {
    const c = document.getElementById('views-grid');
    if (!c) return;
    const views = [...this.allViews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 16);
    if (!views.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👁️</div><div class="empty-state-text">Aucune vue</div></div>'; return; }
    c.innerHTML = views.map(v => `<div class="view-item">
      <div class="view-thumbnail" data-view-id="${v.id}">🖼️</div>
      <div class="view-name" title="${this.esc(v.name)}">${this.esc(v.name)}</div>
      <div class="view-meta">${this.esc(v.createdBy)} · ${this.fmtDate(v.createdAt)}</div>
    </div>`).join('');
  }

  private async loadThumbnails(): Promise<void> {
    const thumbEls = document.querySelectorAll('.view-thumbnail[data-view-id]');
    const promises = Array.from(thumbEls).map(async (el) => {
      const viewId = (el as HTMLElement).dataset.viewId;
      if (!viewId) return;
      try {
        const url = await viewsService.getThumbnailUrl(viewId);
        if (url) {
          (el as HTMLElement).innerHTML = `<img src="${url}" alt="thumbnail" />`;
        }
      } catch { /* keep placeholder */ }
    });
    // Load in parallel batches of 4
    for (let i = 0; i < promises.length; i += 4) {
      await Promise.all(promises.slice(i, i + 4));
    }
  }

  // =============================================
  // TEAM
  // =============================================

  private renderTeamSection(): void {
    const c = document.getElementById('team-list');
    if (!c) return;
    const members = this.getTeamMembers();
    if (!members.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Aucun membre</div></div>'; return; }
    const colors = ['#005F9E','#00A3E0','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
    c.innerHTML = members.slice(0, 10).map((m, i) => `<div class="team-member">
      <div class="team-avatar" style="background:${colors[i % colors.length]}">${this.initials(m.name)}</div>
      <div class="team-info"><div class="team-name">${this.esc(m.name)}</div><div class="team-stats">${m.filesCount} fichiers · ${m.bcfCount} BCF · ${m.viewsCount} vues</div></div>
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

    if (!items.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">Aucune activité</div></div>'; return; }
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

  private statusCls(s: string): string { return s === 'In Progress' ? 'inprogress' : s.toLowerCase(); }
  private fileIcon(ext: string): string {
    const m: Record<string,string> = { ifc:'🏗️',pdf:'📄',dwg:'📐',rvt:'🏢',png:'🖼️',jpg:'🖼️',jpeg:'🖼️',xlsx:'📊',docx:'📝',zip:'📦',mp4:'🎥',nwd:'🔷',trb:'🔷' };
    return m[(ext||'').toLowerCase()] || '📎';
  }
  private initials(n: string): string { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : n.substring(0,2).toUpperCase(); }
  private fmtDate(d: Date|string): string { return new Date(d).toLocaleDateString('fr-FR'); }
  private relDate(d: Date): string {
    const ms = Date.now() - d.getTime();
    const m = Math.floor(ms/60000), h = Math.floor(ms/3600000), dy = Math.floor(ms/86400000);
    if (m < 60) return `il y a ${m} min`; if (h < 24) return `il y a ${h}h`; if (dy < 7) return `il y a ${dy}j`;
    return d.toLocaleDateString('fr-FR');
  }
  private esc(s: string): string { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  private getRecentFiles(hrs: number): ProjectFile[] { const c = new Date(); c.setHours(c.getHours()-hrs); return this.allFiles.filter(f => new Date(f.uploadedAt) >= c); }
  private showLoader(): void { const el = document.getElementById('loader'); if (el) el.style.display = 'flex'; }
  private hideLoader(): void { const el = document.getElementById('loader'); if (el) el.style.display = 'none'; }
  stopAutoRefresh(): void {}
  destroy(): void { this.chartsManager.destroy(); }

  exportPDF(): void { window.print(); }

  // =============================================
  // HTML TEMPLATE (tiles)
  // =============================================

  private getTemplate(): string {
    const tileOrder = this.tileConfig.order;

    const tiles: Record<string, string> = {
      'metrics': `
        <div class="metrics-grid">
          ${this.metricCardHtml('notes-count', 'Notes Actives', 'notes', '📝')}
          ${this.metricCardHtml('bcf-count', 'BCF En Cours', 'bcf', '🔧')}
          ${this.metricCardHtml('files-count', 'Fichiers Récents', 'files', '📁')}
          ${this.metricCardHtml('views-count', 'Vues Créées', 'views', '👁️')}
        </div>`,
      'charts-bcf': `
        <div class="charts-grid">
          <div class="card"><div class="card-header"><h3>Répartition des BCF par statut</h3><span class="card-icon">📊</span></div><div class="card-content"><div class="chart-container"><canvas id="bcf-chart"></canvas></div></div></div>
          <div class="card"><div class="card-header"><h3>BCF par priorité</h3><span class="card-icon">🎯</span></div><div class="card-content"><div class="chart-container"><canvas id="bcf-priority-chart"></canvas></div></div></div>
        </div>`,
      'charts-files': `
        <div class="charts-grid">
          <div class="card"><div class="card-header"><h3>Tendance des Fichiers (7 jours)</h3><span class="card-icon">📈</span></div><div class="card-content"><div class="chart-container"><canvas id="files-chart"></canvas></div></div></div>
          <div class="card"><div class="card-header"><h3>Types de fichiers</h3><span class="card-icon">🗂️</span></div><div class="card-content"><div class="chart-container"><canvas id="filetype-chart"></canvas></div></div></div>
        </div>`,
      'bcf-table': `
        <div class="card"><div class="card-header"><h3>Topics BCF</h3><span class="card-icon">📋</span></div>
          <div class="card-content" style="padding:0"><div class="table-wrapper"><table class="table"><thead><tr><th>Titre</th><th>Statut</th><th>Priorité</th><th>Assigné à</th><th>Modifié</th></tr></thead><tbody id="bcf-table-body"><tr><td colspan="5" class="text-center" style="padding:1.5rem;color:var(--muted-foreground)">Chargement...</td></tr></tbody></table></div></div>
        </div>`,
      'files-table': `
        <div class="card"><div class="card-header"><h3>Fichiers Récents</h3><span class="card-icon">📁</span></div>
          <div class="card-content" style="padding:0"><div class="table-wrapper"><table class="table"><thead><tr><th>Nom du fichier</th><th>Date</th><th>Auteur</th></tr></thead><tbody id="files-table-body"><tr><td colspan="3" class="text-center" style="padding:1.5rem;color:var(--muted-foreground)">Chargement...</td></tr></tbody></table></div></div>
        </div>`,
      'team-timeline': `
        <div class="two-col-grid">
          <div class="card"><div class="card-header"><h3>Équipe projet</h3><span class="card-icon">👥</span></div><div class="card-content"><div id="team-list" class="team-list"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>
          <div class="card"><div class="card-header"><h3>Activité récente</h3><span class="card-icon">📅</span></div><div class="card-content"><div id="timeline" class="timeline"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div></div>
        </div>`,
      'views': `
        <div class="card"><div class="card-header"><h3>Vues 3D sauvegardées</h3><span class="card-icon">👁️</span></div>
          <div class="card-content"><div id="views-grid" class="views-grid"><div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div></div></div>
        </div>`,
    };

    const settingsHtml = TILE_DEFS.map(t =>
      `<label class="settings-item"><input type="checkbox" data-tile="${t.id}" ${this.tileConfig.hidden.includes(t.id) ? '' : 'checked'}/>${t.icon} ${t.label}</label>`
    ).join('');

    const tilesHtml = tileOrder.map(id => {
      const content = tiles[id];
      if (!content) return '';
      const hidden = this.tileConfig.hidden.includes(id) ? ' hidden-tile' : '';
      return `<div class="tile${hidden}" data-tile-id="${id}"><div class="tile-drag-handle" title="Déplacer">⠿</div>${content}</div>`;
    }).join('');

    return `
      <div class="dashboard">
        <div class="dashboard-header">
          <div class="header-content">
            <h1>📊 Project Dashboard</h1>
            <p>Vue d'ensemble de votre projet Trimble Connect</p>
          </div>
          <div class="header-actions">
            <button class="btn-header" id="btn-export">📄 Exporter PDF</button>
            <div class="settings-wrapper">
              <button class="btn-header" id="btn-settings">⚙️ Personnaliser</button>
              <div class="settings-panel" id="settings-panel" style="display:none">
                <h4>Sections du dashboard</h4>
                ${settingsHtml}
              </div>
            </div>
          </div>
        </div>
        <div id="error-container"></div>
        <div id="loader" class="loader-container" style="display:none"><div class="spinner"></div></div>
        <div class="tiles-container" id="tiles-container">
          ${tilesHtml}
        </div>
      </div>`;
  }

  private metricCardHtml(id: string, label: string, cls: string, icon: string): string {
    return `<div class="card metric-card">
      <div class="card-header"><span class="metric-label">${label}</span><span class="metric-icon ${cls}">${icon}</span></div>
      <div class="card-content">
        <div class="metric-value" id="${id}">0</div>
        <div id="${id}-trend" class="metric-trend trend-neutral"><span>─</span> Chargement...</div>
        <div class="metric-description" id="${id}-desc"></div>
      </div>
    </div>`;
  }
}
