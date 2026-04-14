/**
 * Dashboard principal — Modus 2.0 design, dark/light theme
 * 4-column grid, draggable tiles, 8 KPI metrics, 6 charts,
 * tables with pagination, contributor bars, BCF age tracking
 */
import './styles.css';
export declare class Dashboard {
    private chartsManager;
    private containerId;
    private tileConfig;
    private dragRAF;
    private projectName;
    private allTopics;
    private allFiles;
    private allNotes;
    private allViews;
    private recentFilesPage;
    private recentBcfPage;
    private readonly PAGE_SIZE;
    constructor(containerId?: string, _config?: Record<string, any>);
    setProjectName(name: string): void;
    private loadTheme;
    private toggleTheme;
    private isDark;
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
    private renderCumulativeChart;
    private renderDepositFrequencyChart;
    private renderBCFCreatedResolvedChart;
    private attachBcfCreatedResolvedPeriod;
    private renderBCFAssigneeChart;
    private renderTopContributors;
    private renderTopUpdatedFiles;
    private renderOldestUnresolvedBCF;
    private renderRecentFilesTable;
    private renderRecentBCFTable;
    private paginationHtml;
    private attachPagination;
    private renderViewsSection;
    private loadThumbnails;
    private renderTeamSection;
    private getTeamMembers;
    private renderTimeline;
    private statusCls;
    private initials;
    private fmtDate;
    private relDate;
    private esc;
    private truncate;
    private showLoader;
    private hideLoader;
    stopAutoRefresh(): void;
    destroy(): void;
    exportPDF(): void;
    private chartTypeState;
    private chartTypeSwitcher;
    private attachChartTypeSwitchers;
    private rerenderChart;
    private getCumulativeData;
    private getDepositFreqData;
    private getTemplate;
    private metricHtml;
}
//# sourceMappingURL=dashboard.d.ts.map