/**
 * Service pour gérer les Fichiers projet
 */
import { ProjectFile, FileTrendDataPoint } from '../models/types';
declare class FilesService {
    /**
     * Récupérer tous les fichiers du projet
     */
    getAllFiles(): Promise<ProjectFile[]>;
    /**
     * Récupérer les fichiers récents (dernières X heures)
     */
    getRecentFiles(hoursThreshold?: number): Promise<ProjectFile[]>;
    /**
     * Compter le nombre de fichiers récents
     */
    countRecentFiles(hoursThreshold?: number): Promise<number>;
    /**
     * Récupérer les fichiers par extension
     */
    getFilesByExtension(extension: string): Promise<ProjectFile[]>;
    /**
     * Obtenir la tendance d'upload de fichiers (7 derniers jours)
     */
    getFileTrend(days?: number): Promise<FileTrendDataPoint[]>;
    /**
     * Récupérer les N derniers fichiers uploadés
     */
    getLastUploadedFiles(limit?: number): Promise<ProjectFile[]>;
    /**
     * Obtenir les statistiques des fichiers
     */
    getFileStats(): Promise<{
        total: number;
        byExtension: Record<string, number>;
        totalSize: number;
    }>;
}
export declare const filesService: FilesService;
export {};
//# sourceMappingURL=filesService.d.ts.map