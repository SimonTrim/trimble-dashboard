/**
 * Service pour gérer les Vues 3D sauvegardées
 */

import { ProjectView } from '../models/types';
import { trimbleClient } from './trimbleClient';
import { logger } from '../utils/logger';

class ViewsService {
  /**
   * Récupérer toutes les vues sauvegardées
   */
  async getAllViews(): Promise<ProjectView[]> {
    logger.debug('Fetching all saved views...');

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        const views = await api.views.getAll();
        
        logger.info(`Found ${views.length} saved views`);
        return views;
      } catch (error) {
        logger.error('Error fetching views', { error });
        throw error;
      }
    }, 'getAllViews');
  }

  /**
   * Compter le nombre total de vues
   */
  async countViews(): Promise<number> {
    try {
      const views = await this.getAllViews();
      return views.length;
    } catch (error) {
      logger.error('Error counting views', { error });
      return 0;
    }
  }

  /**
   * Récupérer une vue par ID
   */
  async getViewById(viewId: string): Promise<ProjectView | null> {
    logger.debug(`Fetching view with ID: ${viewId}`);

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        const view = await api.views.get(viewId);
        return view;
      } catch (error) {
        logger.error(`Error fetching view ${viewId}`, { error });
        return null;
      }
    }, 'getViewById');
  }

  /**
   * Récupérer les vues créées par un utilisateur spécifique
   */
  async getViewsByCreator(userId: string): Promise<ProjectView[]> {
    try {
      const allViews = await this.getAllViews();
      const filtered = allViews.filter(
        (view: ProjectView) => view.createdBy === userId
      );
      
      logger.info(`Found ${filtered.length} views created by user: ${userId}`);
      return filtered;
    } catch (error) {
      logger.error(`Error fetching views for user ${userId}`, { error });
      return [];
    }
  }

  /**
   * Récupérer les vues récentes (derniers X jours)
   */
  async getRecentViews(days: number = 7): Promise<ProjectView[]> {
    try {
      const allViews = await this.getAllViews();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentViews = allViews.filter((view: ProjectView) => {
        const viewDate = new Date(view.createdAt);
        return viewDate >= cutoffDate;
      });

      logger.info(`Found ${recentViews.length} views from last ${days} days`);
      return recentViews;
    } catch (error) {
      logger.error('Error fetching recent views', { error });
      return [];
    }
  }

  /**
   * Récupérer la vue par défaut
   */
  async getDefaultView(): Promise<ProjectView | null> {
    try {
      const allViews = await this.getAllViews();
      const defaultView = allViews.find((view: ProjectView) => view.isDefault);
      
      if (defaultView) {
        logger.info(`Found default view: ${defaultView.name}`);
      } else {
        logger.warn('No default view found');
      }
      
      return defaultView || null;
    } catch (error) {
      logger.error('Error fetching default view', { error });
      return null;
    }
  }

  /**
   * Obtenir des statistiques sur les vues
   */
  async getThumbnailUrl(viewId: string): Promise<string | null> {
    try {
      return await trimbleClient.executeWithRetry(async (api) => {
        if (api.views && api.views.getThumbnail) {
          return await api.views.getThumbnail(viewId);
        }
        return null;
      }, 'getThumbnailUrl');
    } catch (error) {
      logger.error(`Error fetching thumbnail for view ${viewId}`, { error });
      return null;
    }
  }

  async getViewStats(): Promise<{
    total: number;
    withThumbnail: number;
    byCreator: Record<string, number>;
  }> {
    try {
      const allViews = await this.getAllViews();
      
      const byCreator: Record<string, number> = {};
      let withThumbnail = 0;

      allViews.forEach((view: ProjectView) => {
        // Compter par créateur
        byCreator[view.createdBy] = (byCreator[view.createdBy] || 0) + 1;
        
        // Compter celles avec thumbnail
        if (view.thumbnail) {
          withThumbnail++;
        }
      });

      const stats = {
        total: allViews.length,
        withThumbnail,
        byCreator,
      };

      logger.info('View statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('Error calculating view stats', { error });
      return { total: 0, withThumbnail: 0, byCreator: {} };
    }
  }
}

// Instance singleton
export const viewsService = new ViewsService();
