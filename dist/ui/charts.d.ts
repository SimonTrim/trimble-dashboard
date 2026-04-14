/**
 * Charts Manager — Chart.js charts with dark/light theme support
 * Area, bar, doughnut, line, horizontal bar charts
 */
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
export declare class ChartsManager {
    private charts;
    private destroyChart;
    private setChart;
    createBCFChart(canvasId: string, data: BCFStatusData): void;
    createBCFPriorityChart(canvasId: string, data: BCFPriorityData, chartType?: string): void;
    createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void;
    createFileTypeChart(canvasId: string, byExtension: Record<string, number>, chartType?: string): void;
    createCumulativeChart(canvasId: string, data: {
        label: string;
        cumulative: number;
    }[], chartType?: string): void;
    createDepositFrequencyChart(canvasId: string, data: {
        label: string;
        count: number;
    }[], chartType?: string): void;
    createBCFCreatedResolvedChart(canvasId: string, data: {
        label: string;
        created: number;
        resolved: number;
    }[]): void;
    createBCFStatusDonutChart(canvasId: string, data: BCFStatusData, chartType?: string): void;
    destroy(): void;
}
//# sourceMappingURL=charts.d.ts.map