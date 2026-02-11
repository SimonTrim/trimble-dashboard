/**
 * Dashboard principal - shadcn/ui inspired design
 * 
 * Features:
 * 1. BCF Topics table with status/priority badges
 * 2. File type distribution chart (doughnut)
 * 3. Activity timeline
 * 4. Team members with contributions
 * 5. PDF export (window.print)
 * 6. BCF priority chart
 * 7. Trend indicators on metric cards
 * 8. Views table/grid
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

export class Dashboard {
  private chartsManager: ChartsManager;
  private config: DashboardConfig;
  private containerId: string;

  // Cached data (loaded once per render)
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
    logger.info('Dashboard initialized');
  }

  // =============================================
  // RENDER
  // =============================================

  async render(): Promise<void> {
    try {
      const container = document.getElementById(this.containerId);
      if (!container) throw new Error(`Container #${this.containerId} not found`);

      container.innerHTML = this.getTemplate();

      // Attach PDF export handler
      const exportBtn = document.getElementById('btn-export');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportPDF());
      }

      await this.loadAllData();
      logger.info('Dashboard rendered successfully');
    } catch (error) {
      logger.error('Error rendering dashboard', { error });
      errorHandler.displayError(
        errorHandler.createError('INITIALIZATION_ERROR' as any, error),
        'error-container'
      );
    }
  }

  // =============================================
  // DATA LOADING (optimized: 4 parallel API calls)
  // =============================================

  private async loadAllData(): Promise<void> {
    this.showLoader();

    try {
      // Fetch ALL data in parallel (4 calls instead of 7+)
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

      logger.info(`Data loaded: ${topics.length} topics, ${files.length} files, ${notes.length} notes, ${views.length} views`);

      // Compute and render all sections from cached data
      this.renderMetrics();
      this.renderCharts();
      this.renderBCFTable();
      this.renderFilesTable();
      this.renderViewsSection();
      this.renderTeamSection();
      this.renderTimeline();

      this.hideLoader();
    } catch (error) {
      this.hideLoader();
      logger.error('Error loading data', { error });
      errorHandler.displayError(
        errorHandler.handleApiError(error, 'loadAllData'),
        'error-container'
      );
    }
  }

  // =============================================
  // METRICS WITH TRENDS (Feature 7)
  // =============================================

  private renderMetrics(): void {
    const activeTopics = this.allTopics.filter(t => t.status !== 'Closed');
    const recentFiles = this.getRecentFiles(this.config.recentFilesThreshold);

    // Trend: items created in last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const topicsTrend = this.computeTrend(this.allTopics, weekAgo);
    const filesTrend = this.computeTrend(this.allFiles, weekAgo, 'uploadedAt');
    const notesTrend = this.computeTrend(this.allNotes, weekAgo);
    const viewsTrend = this.computeTrend(this.allViews, weekAgo);

    this.setMetricCard('notes-count', this.allNotes.length, notesTrend, 'Notes non archivées');
    this.setMetricCard('bcf-count', activeTopics.length, topicsTrend, 'Topics non fermés');
    this.setMetricCard('files-count', recentFiles.length, filesTrend, `Dernières ${this.config.recentFilesThreshold}h`);
    this.setMetricCard('views-count', this.allViews.length, viewsTrend, 'Vues sauvegardées');
  }

  private computeTrend(items: any[], since: Date, dateField: string = 'createdAt'): TrendData {
    const recent = items.filter(item => {
      const d = new Date(item[dateField] || item.createdAt || item.uploadedAt);
      return d >= since;
    }).length;

    return {
      current: items.length,
      previous: items.length - recent,
      direction: recent > 0 ? 'up' : 'neutral',
      changeCount: recent,
    };
  }

  private setMetricCard(id: string, value: number, trend: TrendData, description: string): void {
    const valueEl = document.getElementById(id);
    if (valueEl) valueEl.textContent = value.toString();

    const trendEl = document.getElementById(`${id}-trend`);
    if (trendEl) {
      if (trend.changeCount > 0) {
        trendEl.className = `metric-trend trend-${trend.direction}`;
        trendEl.innerHTML = `<span>${trend.direction === 'up' ? '↑' : '↓'}</span> +${trend.changeCount} cette semaine`;
      } else {
        trendEl.className = 'metric-trend trend-neutral';
        trendEl.innerHTML = '<span>─</span> Stable';
      }
    }

    const descEl = document.getElementById(`${id}-desc`);
    if (descEl) descEl.textContent = description;
  }

  // =============================================
  // CHARTS (Features 2, 6 + existing)
  // =============================================

  private renderCharts(): void {
    try {
      // BCF Status distribution
      const statusData = this.computeBCFStatus();
      this.chartsManager.createBCFChart('bcf-chart', statusData);

      // BCF Priority distribution (Feature 6)
      const priorityData = this.computeBCFPriority();
      this.chartsManager.createBCFPriorityChart('bcf-priority-chart', priorityData);

      // Files trend (7 days)
      const filesTrend = this.computeFileTrend(7);
      this.chartsManager.createFilesTrendChart('files-chart', filesTrend);

      // File type distribution (Feature 2)
      const fileStats = this.computeFileStats();
      this.chartsManager.createFileTypeChart('filetype-chart', fileStats.byExtension);
    } catch (error) {
      logger.error('Error rendering charts', { error });
    }
  }

  private computeBCFStatus(): BCFStatusData {
    const d: BCFStatusData = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    this.allTopics.forEach(t => {
      switch (t.status) {
        case 'Open': d.open++; break;
        case 'In Progress': d.inProgress++; break;
        case 'Resolved': d.resolved++; break;
        case 'Closed': d.closed++; break;
      }
    });
    return d;
  }

  private computeBCFPriority(): BCFPriorityData {
    const d: BCFPriorityData = { high: 0, medium: 0, low: 0 };
    this.allTopics.forEach(t => {
      const p = (t.priority || 'Medium').toLowerCase();
      if (p === 'high') d.high++;
      else if (p === 'low') d.low++;
      else d.medium++;
    });
    return d;
  }

  private computeFileTrend(days: number): FileTrendDataPoint[] {
    const today = new Date();
    const trend: FileTrendDataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const count = this.allFiles.filter(f => {
        const fd = new Date(f.uploadedAt);
        return fd >= date && fd < nextDay;
      }).length;
      trend.push({ date: date.toISOString().split('T')[0], count });
    }
    return trend;
  }

  private computeFileStats(): { total: number; byExtension: Record<string, number>; totalSize: number } {
    const byExtension: Record<string, number> = {};
    let totalSize = 0;
    this.allFiles.forEach(f => {
      const ext = (f.extension || '').toLowerCase() || 'other';
      byExtension[ext] = (byExtension[ext] || 0) + 1;
      totalSize += f.size || 0;
    });
    return { total: this.allFiles.length, byExtension, totalSize };
  }

  private getRecentFiles(hours: number): ProjectFile[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    return this.allFiles.filter(f => new Date(f.uploadedAt) >= cutoff);
  }

  // =============================================
  // BCF TOPICS TABLE (Feature 1)
  // =============================================

  private renderBCFTable(): void {
    const tbody = document.getElementById('bcf-table-body');
    if (!tbody) return;

    // Show non-closed topics, sorted by date descending
    const topics = [...this.allTopics]
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, 15);

    if (topics.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Aucun topic BCF</div></td></tr>';
      return;
    }

    tbody.innerHTML = topics.map(t => `
      <tr>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.escapeHtml(t.title)}">${this.escapeHtml(t.title)}</td>
        <td><span class="badge badge-${this.getStatusClass(t.status)}">${t.status}</span></td>
        <td><span class="badge badge-${(t.priority || 'medium').toLowerCase()}">${t.priority || 'Medium'}</span></td>
        <td style="color:var(--muted-foreground)">${this.escapeHtml(t.assignedTo || '—')}</td>
        <td style="color:var(--muted-foreground);white-space:nowrap">${this.formatDate(t.modifiedAt)}</td>
      </tr>
    `).join('');
  }

  // =============================================
  // FILES TABLE (existing, improved)
  // =============================================

  private renderFilesTable(): void {
    const tbody = document.getElementById('files-table-body');
    if (!tbody) return;

    const files = [...this.allFiles]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, this.config.maxRecentFilesDisplay);

    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-text">Aucun fichier</div></td></tr>';
      return;
    }

    tbody.innerHTML = files.map(f => `
      <tr>
        <td>
          <span class="file-icon">${this.getFileIcon(f.extension)}</span>
          <span class="file-name" title="${this.escapeHtml(f.name)}">${this.escapeHtml(f.name)}</span>
        </td>
        <td style="color:var(--muted-foreground);white-space:nowrap">${this.formatDate(f.uploadedAt)}</td>
        <td style="color:var(--muted-foreground)">${this.escapeHtml(f.uploadedBy)}</td>
      </tr>
    `).join('');
  }

  // =============================================
  // VIEWS SECTION (Feature 8)
  // =============================================

  private renderViewsSection(): void {
    const container = document.getElementById('views-grid');
    if (!container) return;

    const views = [...this.allViews]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);

    if (views.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👁️</div><div class="empty-state-text">Aucune vue sauvegardée</div></div>';
      return;
    }

    container.innerHTML = views.map(v => `
      <div class="view-item">
        <div class="view-thumbnail">
          ${v.thumbnail ? `<img src="${v.thumbnail}" alt="${this.escapeHtml(v.name)}"/>` : '🖼️'}
        </div>
        <div class="view-name" title="${this.escapeHtml(v.name)}">${this.escapeHtml(v.name)}</div>
        <div class="view-meta">${this.escapeHtml(v.createdBy)} · ${this.formatDate(v.createdAt)}</div>
      </div>
    `).join('');
  }

  // =============================================
  // TEAM SECTION (Feature 4)
  // =============================================

  private renderTeamSection(): void {
    const container = document.getElementById('team-list');
    if (!container) return;

    const members = this.computeTeamMembers();

    if (members.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Aucun membre trouvé</div></div>';
      return;
    }

    const avatarColors = ['#005F9E', '#00A3E0', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    container.innerHTML = members.slice(0, 10).map((m, i) => {
      const initials = this.getInitials(m.name);
      const color = avatarColors[i % avatarColors.length];
      return `
        <div class="team-member">
          <div class="team-avatar" style="background:${color}">${initials}</div>
          <div class="team-info">
            <div class="team-name">${this.escapeHtml(m.name)}</div>
            <div class="team-stats">${m.filesCount} fichiers · ${m.bcfCount} BCF · ${m.viewsCount} vues</div>
          </div>
          <div class="team-count">${m.totalContributions}</div>
        </div>
      `;
    }).join('');
  }

  private computeTeamMembers(): TeamMember[] {
    const membersMap: Record<string, TeamMember> = {};

    const addContrib = (name: string, type: 'files' | 'bcf' | 'notes' | 'views', date: Date) => {
      if (!name || name === 'Unknown' || name === '—') return;
      if (!membersMap[name]) {
        membersMap[name] = {
          name,
          filesCount: 0,
          bcfCount: 0,
          notesCount: 0,
          viewsCount: 0,
          totalContributions: 0,
          lastActivity: date,
        };
      }
      const m = membersMap[name];
      if (type === 'files') m.filesCount++;
      else if (type === 'bcf') m.bcfCount++;
      else if (type === 'notes') m.notesCount++;
      else if (type === 'views') m.viewsCount++;
      m.totalContributions++;
      if (date > m.lastActivity) m.lastActivity = date;
    };

    this.allFiles.forEach(f => addContrib(f.uploadedBy, 'files', new Date(f.uploadedAt)));
    this.allTopics.forEach(t => addContrib(t.createdBy, 'bcf', new Date(t.createdAt)));
    this.allNotes.forEach(n => addContrib(n.author, 'notes', new Date(n.createdAt)));
    this.allViews.forEach(v => addContrib(v.createdBy, 'views', new Date(v.createdAt)));

    return Object.values(membersMap).sort((a, b) => b.totalContributions - a.totalContributions);
  }

  // =============================================
  // ACTIVITY TIMELINE (Feature 3)
  // =============================================

  private renderTimeline(): void {
    const container = document.getElementById('timeline');
    if (!container) return;

    const activities = this.computeActivityItems();

    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">Aucune activité récente</div></div>';
      return;
    }

    container.innerHTML = activities.slice(0, 12).map(a => `
      <div class="timeline-item">
        <div class="timeline-dot ${a.type}"></div>
        <div class="timeline-content">
          <div class="timeline-title">${this.escapeHtml(a.title)}</div>
          <div class="timeline-meta">
            <span class="badge badge-${a.type}">${this.getActivityLabel(a.type)}</span>
            <span>${this.escapeHtml(a.author)}</span>
            <span>·</span>
            <span>${this.formatRelativeDate(a.date)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  private computeActivityItems(): ActivityItem[] {
    const items: ActivityItem[] = [];

    this.allFiles.forEach(f => items.push({
      id: f.id, type: 'file', title: f.name,
      date: new Date(f.uploadedAt), author: f.uploadedBy,
    }));
    this.allTopics.forEach(t => items.push({
      id: t.id, type: 'bcf', title: t.title,
      date: new Date(t.modifiedAt), author: t.createdBy,
    }));
    this.allNotes.forEach(n => items.push({
      id: n.id, type: 'note', title: n.title,
      date: new Date(n.updatedAt), author: n.author,
    }));
    this.allViews.forEach(v => items.push({
      id: v.id, type: 'view', title: v.name,
      date: new Date(v.createdAt), author: v.createdBy,
    }));

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // =============================================
  // PDF EXPORT (Feature 5)
  // =============================================

  exportPDF(): void {
    logger.info('Exporting dashboard to PDF...');
    window.print();
  }

  // =============================================
  // HELPERS
  // =============================================

  private getStatusClass(status: string): string {
    switch (status) {
      case 'Open': return 'open';
      case 'In Progress': return 'inprogress';
      case 'Resolved': return 'resolved';
      case 'Closed': return 'closed';
      default: return 'open';
    }
  }

  private getFileIcon(ext: string): string {
    const icons: Record<string, string> = {
      ifc: '🏗️', pdf: '📄', dwg: '📐', rvt: '🏢',
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️',
      xlsx: '📊', xls: '📊', docx: '📝', doc: '📝',
      zip: '📦', rar: '📦', mp4: '🎥', nwd: '🔷', nwc: '🔷', trb: '🔷',
    };
    return icons[(ext || '').toLowerCase()] || '📎';
  }

  private getActivityLabel(type: string): string {
    switch (type) {
      case 'file': return 'Fichier';
      case 'bcf': return 'BCF';
      case 'note': return 'Note';
      case 'view': return 'Vue';
      default: return type;
    }
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 60) return `il y a ${mins} min`;
    if (hours < 24) return `il y a ${hours}h`;
    if (days < 7) return `il y a ${days}j`;
    return date.toLocaleDateString('fr-FR');
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  private showLoader(): void {
    const el = document.getElementById('loader');
    if (el) el.style.display = 'flex';
  }

  private hideLoader(): void {
    const el = document.getElementById('loader');
    if (el) el.style.display = 'none';
  }

  stopAutoRefresh(): void { /* no-op: auto-refresh disabled */ }

  destroy(): void {
    this.chartsManager.destroy();
    logger.info('Dashboard destroyed');
  }

  // =============================================
  // HTML TEMPLATE
  // =============================================

  private getTemplate(): string {
    return `
      <div class="dashboard">
        <!-- Header -->
        <div class="dashboard-header">
          <div class="header-content">
            <h1>📊 Project Dashboard</h1>
            <p>Vue d'ensemble de votre projet Trimble Connect</p>
          </div>
          <button class="btn-export" id="btn-export">
            📄 Exporter PDF
          </button>
        </div>

        <!-- Error container -->
        <div id="error-container"></div>

        <!-- Loader -->
        <div id="loader" class="loader-container" style="display:none;">
          <div class="spinner"></div>
        </div>

        <!-- Metric Cards (Feature 7: trends) -->
        <div class="metrics-grid">
          <div class="card metric-card">
            <div class="card-header">
              <span class="metric-label">Notes Actives</span>
              <span class="metric-icon notes">📝</span>
            </div>
            <div class="card-content">
              <div class="metric-value" id="notes-count">0</div>
              <div id="notes-count-trend" class="metric-trend trend-neutral"><span>─</span> Chargement...</div>
              <div class="metric-description" id="notes-count-desc">Notes non archivées</div>
            </div>
          </div>

          <div class="card metric-card">
            <div class="card-header">
              <span class="metric-label">BCF En Cours</span>
              <span class="metric-icon bcf">🔧</span>
            </div>
            <div class="card-content">
              <div class="metric-value" id="bcf-count">0</div>
              <div id="bcf-count-trend" class="metric-trend trend-neutral"><span>─</span> Chargement...</div>
              <div class="metric-description" id="bcf-count-desc">Topics non fermés</div>
            </div>
          </div>

          <div class="card metric-card">
            <div class="card-header">
              <span class="metric-label">Fichiers Récents</span>
              <span class="metric-icon files">📁</span>
            </div>
            <div class="card-content">
              <div class="metric-value" id="files-count">0</div>
              <div id="files-count-trend" class="metric-trend trend-neutral"><span>─</span> Chargement...</div>
              <div class="metric-description" id="files-count-desc">Dernières 48h</div>
            </div>
          </div>

          <div class="card metric-card">
            <div class="card-header">
              <span class="metric-label">Vues Créées</span>
              <span class="metric-icon views">👁️</span>
            </div>
            <div class="card-content">
              <div class="metric-value" id="views-count">0</div>
              <div id="views-count-trend" class="metric-trend trend-neutral"><span>─</span> Chargement...</div>
              <div class="metric-description" id="views-count-desc">Vues sauvegardées</div>
            </div>
          </div>
        </div>

        <!-- Charts Row 1: BCF Status + BCF Priority -->
        <div class="charts-grid">
          <div class="card">
            <div class="card-header">
              <h3>Répartition des BCF par statut</h3>
              <span class="card-icon">📊</span>
            </div>
            <div class="card-content">
              <div class="chart-container"><canvas id="bcf-chart"></canvas></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3>BCF par priorité</h3>
              <span class="card-icon">🎯</span>
            </div>
            <div class="card-content">
              <div class="chart-container"><canvas id="bcf-priority-chart"></canvas></div>
            </div>
          </div>
        </div>

        <!-- Charts Row 2: Files Trend + File Type Distribution -->
        <div class="charts-grid">
          <div class="card">
            <div class="card-header">
              <h3>Tendance des Fichiers (7 jours)</h3>
              <span class="card-icon">📈</span>
            </div>
            <div class="card-content">
              <div class="chart-container"><canvas id="files-chart"></canvas></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3>Types de fichiers</h3>
              <span class="card-icon">🗂️</span>
            </div>
            <div class="card-content">
              <div class="chart-container"><canvas id="filetype-chart"></canvas></div>
            </div>
          </div>
        </div>

        <!-- BCF Topics Table (Feature 1) -->
        <div class="card section-table" style="margin-bottom:var(--space-4);">
          <div class="card-header">
            <h3>Topics BCF</h3>
            <span class="card-icon">📋</span>
          </div>
          <div class="card-content" style="padding:0;">
            <div class="table-wrapper">
              <table class="table">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Statut</th>
                    <th>Priorité</th>
                    <th>Assigné à</th>
                    <th>Modifié</th>
                  </tr>
                </thead>
                <tbody id="bcf-table-body">
                  <tr><td colspan="5" class="text-center" style="padding:2rem;color:var(--muted-foreground)">Chargement...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Recent Files Table -->
        <div class="card section-table" style="margin-bottom:var(--space-4);">
          <div class="card-header">
            <h3>Fichiers Récents</h3>
            <span class="card-icon">📁</span>
          </div>
          <div class="card-content" style="padding:0;">
            <div class="table-wrapper">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nom du fichier</th>
                    <th>Date</th>
                    <th>Auteur</th>
                  </tr>
                </thead>
                <tbody id="files-table-body">
                  <tr><td colspan="3" class="text-center" style="padding:2rem;color:var(--muted-foreground)">Chargement...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Team + Timeline (Features 4 & 3) -->
        <div class="two-col-grid">
          <div class="card">
            <div class="card-header">
              <h3>Équipe projet</h3>
              <span class="card-icon">👥</span>
            </div>
            <div class="card-content">
              <div id="team-list" class="team-list">
                <div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3>Activité récente</h3>
              <span class="card-icon">📅</span>
            </div>
            <div class="card-content">
              <div id="timeline" class="timeline">
                <div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Views Section (Feature 8) -->
        <div class="card" style="margin-bottom:var(--space-4);">
          <div class="card-header">
            <h3>Vues 3D sauvegardées</h3>
            <span class="card-icon">👁️</span>
          </div>
          <div class="card-content">
            <div id="views-grid" class="views-grid">
              <div style="text-align:center;padding:1rem;color:var(--muted-foreground)">Chargement...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
