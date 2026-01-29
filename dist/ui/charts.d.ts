/**
 * Gestion des graphiques avec Chart.js
 */
import { BCFStatusData, FileTrendDataPoint } from '../models/types';
export declare class ChartsManager {
    private bcfChart;
    private filesChart;
    /**
     * Créer le graphique de répartition des BCF (Bar Chart)
     */
    createBCFChart(canvasId: string, data: BCFStatusData): void;
    /**
     * Créer le graphique de tendance des fichiers (Line Chart)
     */
    createFilesTrendChart(canvasId: string, data: FileTrendDataPoint[]): void;
    /**
     * Mettre à jour le graphique BCF avec de nouvelles données
     */
    updateBCFChart(data: BCFStatusData): void;
    /**
     * Mettre à jour le graphique de tendance avec de nouvelles données
     */
    updateFilesTrendChart(data: FileTrendDataPoint[]): void;
    /**
     * Détruire tous les graphiques
     */
    destroy(): void;
}
//# sourceMappingURL=charts.d.ts.map