/**
 * Dashboard principal — shadcn/ui design
 * 4-column grid, individual draggable tiles, expandable BCF, thumbnails
 */
import { DashboardConfig } from '../models/types';
import './styles.css';
export declare class Dashboard {
    private chartsManager;
    private config;
    private containerId;
    private tileConfig;
    private dragRAF;
    private allTopics;
    private allFiles;
    private allNotes;
    private allViews;
    constructor(containerId?: string, config?: Partial<DashboardConfig>);
    private loadTileConfig;
    private saveTileConfig;
    private resetTileConfig;
    render(): Promise<void>;
    private loadAllData;
    private attachHeaderEvents;
    private applyTileVisibility;
    private initDragDrop;
    private saveTileOrder;
    private renderMetrics;
    private trend;
    private setMetric;
    private renderCharts;
    private renderBCFTable;
    private attachBCFExpand;
    private renderFilesTable;
    private renderViewsSection;
    private loadThumbnails;
    private renderTeamSection;
    private getTeamMembers;
    private renderTimeline;
    private statusCls;
    private fileIcon;
    private initials;
    private fmtDate;
    private relDate;
    private esc;
    private truncate;
    private getRecentFiles;
    private showLoader;
    private hideLoader;
    stopAutoRefresh(): void;
    destroy(): void;
    exportPDF(): void;
    private getTemplate;
    private metricHtml;
}
//# sourceMappingURL=dashboard.d.ts.map