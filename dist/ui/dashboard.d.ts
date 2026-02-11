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
import { DashboardConfig } from '../models/types';
import './styles.css';
export declare class Dashboard {
    private chartsManager;
    private config;
    private containerId;
    private allTopics;
    private allFiles;
    private allNotes;
    private allViews;
    constructor(containerId?: string, config?: Partial<DashboardConfig>);
    render(): Promise<void>;
    private loadAllData;
    private renderMetrics;
    private computeTrend;
    private setMetricCard;
    private renderCharts;
    private computeBCFStatus;
    private computeBCFPriority;
    private computeFileTrend;
    private computeFileStats;
    private getRecentFiles;
    private renderBCFTable;
    private renderFilesTable;
    private renderViewsSection;
    private renderTeamSection;
    private computeTeamMembers;
    private renderTimeline;
    private computeActivityItems;
    exportPDF(): void;
    private getStatusClass;
    private getFileIcon;
    private getActivityLabel;
    private getInitials;
    private formatDate;
    private formatRelativeDate;
    private escapeHtml;
    private showLoader;
    private hideLoader;
    stopAutoRefresh(): void;
    destroy(): void;
    private getTemplate;
}
//# sourceMappingURL=dashboard.d.ts.map