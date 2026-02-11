/**
 * Service pour gérer les Vues 3D sauvegardées
 */
import { ProjectView } from '../models/types';
declare class ViewsService {
    /**
     * Récupérer toutes les vues sauvegardées
     */
    getAllViews(): Promise<ProjectView[]>;
    /**
     * Compter le nombre total de vues
     */
    countViews(): Promise<number>;
    /**
     * Récupérer une vue par ID
     */
    getViewById(viewId: string): Promise<ProjectView | null>;
    /**
     * Récupérer les vues créées par un utilisateur spécifique
     */
    getViewsByCreator(userId: string): Promise<ProjectView[]>;
    /**
     * Récupérer les vues récentes (derniers X jours)
     */
    getRecentViews(days?: number): Promise<ProjectView[]>;
    /**
     * Récupérer la vue par défaut
     */
    getDefaultView(): Promise<ProjectView | null>;
    /**
     * Obtenir des statistiques sur les vues
     */
    getThumbnailUrl(viewId: string): Promise<string | null>;
    getViewStats(): Promise<{
        total: number;
        withThumbnail: number;
        byCreator: Record<string, number>;
    }>;
}
export declare const viewsService: ViewsService;
export {};
//# sourceMappingURL=viewsService.d.ts.map