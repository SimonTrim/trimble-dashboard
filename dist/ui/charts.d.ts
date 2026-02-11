/**
 * Gestion des graphiques avec Chart.js
 * shadcn-inspired color scheme + Trimble branding
 */
import { BCFStatusData, BCFPriorityData, FileTrendDataPoint } from '../models/types';
export declare class ChartsManager {
    private bcfChart;
    private filesChart;
    private fileTypeChart;
    private bcfPriorityChart;
    /**
     * Créer le graphique de répartition des BCF par statut (Bar Chart)
     */
    createBCFChart(canvasId: string, data: BCFStatusData): void;
    /**
     * Créer le graphique de priorité BCF (Doughnut)
     */
    createBCFPriorityChart(canvasId: string, data: BCFPriorityData): void;
    /**
     * Créer le graphique de tendance des fichiers (Line Chart - area)
     */
    createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void;
    /**
     * Créer le graphique de distribution des types de fichiers (Doughnut)
     */
    createFileTypeChart(canvasId: string, byExtension: Record<string, number>): void;
    /**
     * Détruire tous les graphiques
     */
    destroy(): void;
}
//# sourceMappingURL=charts.d.ts.map