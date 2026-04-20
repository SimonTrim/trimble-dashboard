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
    private static readonly CACHE_TTL_MS;
    private getCacheKey;
    private loadFromCache;
    private saveToCache;
    private loadAllData;
    private renderAllSections;
    /**
     * Lightweight signature of the current dataset used to detect if a background
     * refresh actually brought new data. Avoids the unnecessary second animation
     * replay when cache and fresh data are identical.
     */
    private dataSignature;
    private refreshDataInBackground;
    private attachHeaderEvents;
    private applyTileVisibility;
    private initDragDrop;
    private saveTileOrder;
    private renderMetrics;
    private trend;
    private setMetric;
    /**
     * Matches the CSS `tile-enter` stagger (40ms per tile, capped at 800ms)
     * so chart animations start at the same moment their tile fades in.
     *
     * Used for line and bar charts where the progressive reveal / bar grow
     * is visible through a partial-opacity tile.
     */
    private getTileStartDelay;
    /**
     * Delay for circular charts (pie / doughnut). Rotation is a sweep — it's
     * only visible if the tile is already opaque when it starts. We therefore
     * wait for the tile's CSS fade-in (~600ms) to finish before kicking off
     * the rotation, then rotate cleanly over 2 seconds.
     */
    private getCircularChartDelay;
    /**
     * File-dependent charts: Cumulative, Deposit Frequency, File Type pie.
     * Called once, as soon as `filesPromise` resolves, so each chart animates
     * exactly one time.
     */
    private renderFileCharts;
    /**
     * Topic-dependent charts: BCF Status donut, BCF Priority donut, BCF
     * Created vs Resolved. Called once, as soon as `topicsPromise` resolves.
     */
    private renderTopicCharts;
    /**
     * Renders every chart. Only used by the cache-restore path and by
     * background refresh (where `chartsManager.setAnimationsEnabled(false)` is
     * flipped first so charts update silently).
     */
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