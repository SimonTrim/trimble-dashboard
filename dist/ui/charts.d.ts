/**
 * Charts Manager — shadcn/ui inspired charts with Chart.js
 * Dark area chart, modern doughnuts, clean bar charts
 */
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
export declare class ChartsManager {
    private bcfChart;
    private filesChart;
    private fileTypeChart;
    private bcfPriorityChart;
    createBCFChart(canvasId: string, data: BCFStatusData): void;
    createBCFPriorityChart(canvasId: string, data: BCFPriorityData): void;
    /**
     * Dark-themed area chart (shadcn "Total Visitors" style)
     */
    createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void;
    createFileTypeChart(canvasId: string, byExtension: Record<string, number>): void;
    destroy(): void;
}
//# sourceMappingURL=charts.d.ts.map