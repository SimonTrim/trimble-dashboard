/**
 * Service pour gérer les Fichiers projet
 */

import { ProjectFile, FileTrendDataPoint } from '../models/types';
import { trimbleClient } from './trimbleClient';
import { logger } from '../utils/logger';

class FilesService {
  /**
   * Récupérer tous les fichiers du projet
   */
  async getAllFiles(): Promise<ProjectFile[]> {
    logger.debug('Fetching all project files...');

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        const files = await api.files.getAll();
        
        logger.info(`Found ${files.length} project files`);
        return files;
      } catch (error) {
        logger.error('Error fetching project files', { error });
        throw error;
      }
    }, 'getAllFiles');
  }

  /**
   * Récupérer les fichiers récents (dernières X heures)
   */
  async getRecentFiles(hoursThreshold: number = 48): Promise<ProjectFile[]> {
    logger.debug(`Fetching files from last ${hoursThreshold} hours...`);

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold);
        
        // Appel à l'API avec filtre de date
        const files = await api.files.getRecent({
          limit: 100,
          since: cutoffDate.getTime(),
        });
        
        logger.info(`Found ${files.length} recent files (last ${hoursThreshold}h)`);
        return files;
      } catch (error) {
        logger.error('Error fetching recent files', { error });
        return [];
      }
    }, 'getRecentFiles');
  }

  /**
   * Compter le nombre de fichiers récents
   */
  async countRecentFiles(hoursThreshold: number = 48): Promise<number> {
    try {
      const files = await this.getRecentFiles(hoursThreshold);
      return files.length;
    } catch (error) {
      logger.error('Error counting recent files', { error });
      return 0;
    }
  }

  /**
   * Récupérer les fichiers par extension
   */
  async getFilesByExtension(extension: string): Promise<ProjectFile[]> {
    try {
      const allFiles = await this.getAllFiles();
      const filtered = allFiles.filter(
        (file: ProjectFile) => file.extension.toLowerCase() === extension.toLowerCase()
      );
      
      logger.info(`Found ${filtered.length} files with extension: ${extension}`);
      return filtered;
    } catch (error) {
      logger.error(`Error fetching files with extension ${extension}`, { error });
      return [];
    }
  }

  /**
   * Obtenir la tendance d'upload de fichiers (7 derniers jours)
   */
  async getFileTrend(days: number = 7): Promise<FileTrendDataPoint[]> {
    try {
      const allFiles = await this.getAllFiles();
      const today = new Date();
      const trend: FileTrendDataPoint[] = [];

      // Créer les points de données pour chaque jour
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        // Compter les fichiers uploadés ce jour-là
        const count = allFiles.filter((file: ProjectFile) => {
          const fileDate = new Date(file.uploadedAt);
          return fileDate >= date && fileDate < nextDay;
        }).length;

        trend.push({
          date: date.toISOString().split('T')[0], // Format: YYYY-MM-DD
          count,
        });
      }

      logger.info(`File trend calculated for ${days} days`, trend);
      return trend;
    } catch (error) {
      logger.error('Error calculating file trend', { error });
      return [];
    }
  }

  /**
   * Récupérer les N derniers fichiers uploadés
   */
  async getLastUploadedFiles(limit: number = 10): Promise<ProjectFile[]> {
    try {
      const allFiles = await this.getAllFiles();
      
      // Trier par date d'upload décroissante
      const sorted = [...allFiles].sort((a, b) => {
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
      
      const lastFiles = sorted.slice(0, limit);
      logger.info(`Retrieved last ${limit} uploaded files`);
      return lastFiles;
    } catch (error) {
      logger.error('Error fetching last uploaded files', { error });
      return [];
    }
  }

  /**
   * Obtenir les statistiques des fichiers
   */
  async getFileStats(): Promise<{
    total: number;
    byExtension: Record<string, number>;
    totalSize: number;
  }> {
    try {
      const allFiles = await this.getAllFiles();
      
      const byExtension: Record<string, number> = {};
      let totalSize = 0;

      allFiles.forEach((file: ProjectFile) => {
        // Compter par extension
        const ext = file.extension.toLowerCase();
        byExtension[ext] = (byExtension[ext] || 0) + 1;
        
        // Additionner les tailles
        totalSize += file.size;
      });

      const stats = {
        total: allFiles.length,
        byExtension,
        totalSize,
      };

      logger.info('File statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('Error calculating file stats', { error });
      return { total: 0, byExtension: {}, totalSize: 0 };
    }
  }
}

// Instance singleton
export const filesService = new FilesService();
