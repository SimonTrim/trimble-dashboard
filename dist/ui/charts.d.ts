/**
 * Charts Manager — Chart.js charts with dark/light theme support
 * Area, bar, doughnut, line, horizontal bar charts
 */
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
export declare class ChartsManager {
    private charts;
    private animationsEnabled;
    /**
     * Toggle chart animations. Called with `false` during background refresh so
     * charts refresh silently (no animation replay) when fresh data arrives
     * from the API after the first render.
     */
    setAnimationsEnabled(enabled: boolean): void;
    /**
     * Returns the provided animation config when animations are enabled,
     * or `false` (Chart.js "no animation") otherwise.
     */
    private anim;
    /**
     * Line reveal helper: returns a smooth-reveal config when animations are
     * enabled, or a plain no-animation config during silent refresh.
     */
    private lineOpts;
    /**
     * Donut reveal helper: returns a smooth wedge-clip config when animations
     * are enabled, or a plain no-animation config during silent refresh.
     */
    private donutOpts;
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