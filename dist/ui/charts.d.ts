/**
 * Charts Manager — Chart.js charts with dark/light theme support
 * Area, bar, doughnut, line, horizontal bar charts
 */
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
export declare class ChartsManager {
    private charts;
    private destroyChart;
    private setChart;
    createBCFChart(canvasId: string, data: BCFStatusData, startDelay?: number): void;
    createBCFPriorityChart(canvasId: string, data: BCFPriorityData, chartType?: string, startDelay?: number): void;
    createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[], startDelay?: number): void;
    createFileTypeChart(canvasId: string, byExtension: Record<string, number>, chartType?: string, startDelay?: number): void;
    createCumulativeChart(canvasId: string, data: {
        label: string;
        cumulative: number;
    }[], chartType?: string, startDelay?: number): void;
    createDepositFrequencyChart(canvasId: string, data: {
        label: string;
        count: number;
    }[], chartType?: string, startDelay?: number): void;
    createBCFCreatedResolvedChart(canvasId: string, data: {
        label: string;
        created: number;
        resolved: number;
    }[], startDelay?: number): void;
    createBCFStatusDonutChart(canvasId: string, data: BCFStatusData, chartType?: string, startDelay?: number): void;
    destroy(): void;
}
//# sourceMappingURL=charts.d.ts.map