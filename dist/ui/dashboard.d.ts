/**
 * Dashboard principal — shadcn/ui design
 * Full-width, draggable tiles, customizable layout, thumbnails
 */
import { DashboardConfig } from '../models/types';
import './styles.css';
export declare class Dashboard {
    private chartsManager;
    private config;
    private containerId;
    private tileConfig;
    private allTopics;
    private allFiles;
    private allNotes;
    private allViews;
    constructor(containerId?: string, config?: Partial<DashboardConfig>);
    private loadTileConfig;
    private saveTileConfig;
    render(): Promise<void>;
    private loadAllData;
    private attachHeaderEvents;
    private applyTileVisibility;
    private initDragDrop;
    private getDragAfterElement;
    private saveTileOrder;
    private renderMetrics;
    private trend;
    private setMetric;
    private renderCharts;
    private renderBCFTable;
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
    private getRecentFiles;
    private showLoader;
    private hideLoader;
    stopAutoRefresh(): void;
    destroy(): void;
    exportPDF(): void;
    private getTemplate;
    private metricCardHtml;
}
//# sourceMappingURL=dashboard.d.ts.map