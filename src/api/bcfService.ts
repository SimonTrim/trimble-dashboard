/**
 * Service pour gérer les BCF (BIM Collaboration Format)
 */

import { BCFTopic, BCFStatusData } from '../models/types';
import { trimbleClient } from './trimbleClient';
import { logger } from '../utils/logger';

class BCFService {
  /**
   * Récupérer tous les topics BCF
   */
  async getAllTopics(): Promise<BCFTopic[]> {
    logger.debug('Fetching all BCF topics...');

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        // Appel à l'API Trimble Connect
        const topics = await api.bcf.getTopics();
        
        logger.info(`Found ${topics.length} BCF topics`);
        return topics;
      } catch (error) {
        logger.error('Error fetching BCF topics', { error });
        throw error;
      }
    }, 'getAllTopics');
  }

  /**
   * Récupérer les BCF actifs (non fermés)
   */
  async getActiveTopics(): Promise<BCFTopic[]> {
    try {
      const allTopics = await this.getAllTopics();
      
      // Filtrer les topics actifs (status != Closed)
      const activeTopics = allTopics.filter(
        (topic: BCFTopic) => topic.status !== 'Closed'
      );
      
      logger.info(`Found ${activeTopics.length} active BCF topics`);
      return activeTopics;
    } catch (error) {
      logger.error('Error fetching active BCF topics', { error });
      return [];
    }
  }

  /**
   * Compter le nombre de BCF actifs
   */
  async countActiveTopics(): Promise<number> {
    try {
      const topics = await this.getActiveTopics();
      return topics.length;
    } catch (error) {
      logger.error('Error counting active BCF topics', { error });
      return 0;
    }
  }

  /**
   * Obtenir la répartition des BCF par statut
   */
  async getStatusDistribution(): Promise<BCFStatusData> {
    try {
      const allTopics = await this.getAllTopics();
      
      const distribution: BCFStatusData = {
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      };

      allTopics.forEach((topic: BCFTopic) => {
        switch (topic.status) {
          case 'Open':
            distribution.open++;
            break;
          case 'In Progress':
            distribution.inProgress++;
            break;
          case 'Resolved':
            distribution.resolved++;
            break;
          case 'Closed':
            distribution.closed++;
            break;
        }
      });

      logger.info('BCF status distribution calculated', distribution);
      return distribution;
    } catch (error) {
      logger.error('Error calculating BCF status distribution', { error });
      return { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    }
  }

  /**
   * Récupérer les BCF par priorité
   */
  async getTopicsByPriority(priority: 'Low' | 'Medium' | 'High'): Promise<BCFTopic[]> {
    try {
      const allTopics = await this.getAllTopics();
      const filtered = allTopics.filter((topic: BCFTopic) => topic.priority === priority);
      
      logger.info(`Found ${filtered.length} BCF topics with priority: ${priority}`);
      return filtered;
    } catch (error) {
      logger.error(`Error fetching BCF topics with priority ${priority}`, { error });
      return [];
    }
  }

  /**
   * Récupérer les BCF assignés à un utilisateur
   */
  async getTopicsByAssignee(userId: string): Promise<BCFTopic[]> {
    try {
      const allTopics = await this.getAllTopics();
      const filtered = allTopics.filter(
        (topic: BCFTopic) => topic.assignedTo === userId
      );
      
      logger.info(`Found ${filtered.length} BCF topics assigned to user: ${userId}`);
      return filtered;
    } catch (error) {
      logger.error(`Error fetching BCF topics for user ${userId}`, { error });
      return [];
    }
  }
}

// Instance singleton
export const bcfService = new BCFService();
