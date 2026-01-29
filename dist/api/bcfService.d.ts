/**
 * Service pour gérer les BCF (BIM Collaboration Format)
 */
import { BCFTopic, BCFStatusData } from '../models/types';
declare class BCFService {
    /**
     * Récupérer tous les topics BCF
     */
    getAllTopics(): Promise<BCFTopic[]>;
    /**
     * Récupérer les BCF actifs (non fermés)
     */
    getActiveTopics(): Promise<BCFTopic[]>;
    /**
     * Compter le nombre de BCF actifs
     */
    countActiveTopics(): Promise<number>;
    /**
     * Obtenir la répartition des BCF par statut
     */
    getStatusDistribution(): Promise<BCFStatusData>;
    /**
     * Récupérer les BCF par priorité
     */
    getTopicsByPriority(priority: 'Low' | 'Medium' | 'High'): Promise<BCFTopic[]>;
    /**
     * Récupérer les BCF assignés à un utilisateur
     */
    getTopicsByAssignee(userId: string): Promise<BCFTopic[]>;
}
export declare const bcfService: BCFService;
export {};
//# sourceMappingURL=bcfService.d.ts.map