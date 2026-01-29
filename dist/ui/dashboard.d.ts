/**
 * Composant Dashboard principal
 * Gère l'affichage et le rafraîchissement des données
 */
import { DashboardConfig } from '../models/types';
import './styles.css';
export declare class Dashboard {
    private chartsManager;
    private config;
    private refreshInterval;
    private containerId;
    constructor(containerId?: string, config?: Partial<DashboardConfig>);
    /**
     * Initialiser et afficher le dashboard
     */
    render(): Promise<void>;
    /**
     * Charger toutes les données du dashboard
     */
    private loadData;
    /**
     * Mettre à jour les cartes de métriques
     */
    private updateMetrics;
    /**
     * Mettre à jour une carte métrique individuelle
     */
    private updateMetricCard;
    /**
     * Charger les graphiques
     */
    private loadCharts;
    /**
     * Charger le tableau des fichiers récents
     */
    private loadFilesTable;
    /**
     * Template HTML pour une ligne de fichier
     */
    private getFileRowTemplate;
    /**
     * Obtenir l'icône selon l'extension du fichier
     */
    private getFileIcon;
    /**
     * Formater une date relative (ex: "il y a 2 heures")
     */
    private formatRelativeDate;
    /**
     * Démarrer le rafraîchissement automatique
     */
    private startAutoRefresh;
    /**
     * Arrêter le rafraîchissement automatique
     */
    stopAutoRefresh(): void;
    /**
     * Afficher le loader
     */
    private showLoader;
    /**
     * Masquer le loader
     */
    private hideLoader;
    /**
     * Template HTML du dashboard
     */
    private getTemplate;
    /**
     * Nettoyer et détruire le dashboard
     */
    destroy(): void;
}
//# sourceMappingURL=dashboard.d.ts.map