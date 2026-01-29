/**
 * Service pour gérer les Notes Trimble Connect
 */

import { TrimbleNote } from '../models/types';
import { trimbleClient } from './trimbleClient';
import { logger } from '../utils/logger';

class NotesService {
  /**
   * Récupérer toutes les notes actives (non archivées)
   */
  async getActiveNotes(): Promise<TrimbleNote[]> {
    logger.debug('Fetching active notes...');

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        // Appel à l'API Trimble Connect
        const allNotes = await api.notes.getAll();
        
        // Filtrer les notes actives (non archivées)
        const activeNotes = allNotes.filter((note: any) => !note.archived);
        
        logger.info(`Found ${activeNotes.length} active notes`);
        return activeNotes;
      } catch (error) {
        logger.error('Error fetching notes', { error });
        throw error;
      }
    }, 'getActiveNotes');
  }

  /**
   * Compter le nombre de notes actives
   */
  async countActiveNotes(): Promise<number> {
    try {
      const notes = await this.getActiveNotes();
      return notes.length;
    } catch (error) {
      logger.error('Error counting active notes', { error });
      return 0; // Retourner 0 en cas d'erreur
    }
  }

  /**
   * Récupérer une note par ID
   */
  async getNoteById(noteId: string): Promise<TrimbleNote | null> {
    logger.debug(`Fetching note with ID: ${noteId}`);

    return await trimbleClient.executeWithRetry(async (api) => {
      try {
        const note = await api.notes.get(noteId);
        return note;
      } catch (error) {
        logger.error(`Error fetching note ${noteId}`, { error });
        return null;
      }
    }, 'getNoteById');
  }

  /**
   * Récupérer les notes récentes (dernières 7 jours)
   */
  async getRecentNotes(days: number = 7): Promise<TrimbleNote[]> {
    try {
      const allNotes = await this.getActiveNotes();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentNotes = allNotes.filter((note: TrimbleNote) => {
        const noteDate = new Date(note.createdAt);
        return noteDate >= cutoffDate;
      });

      logger.info(`Found ${recentNotes.length} notes from last ${days} days`);
      return recentNotes;
    } catch (error) {
      logger.error('Error fetching recent notes', { error });
      return [];
    }
  }
}

// Instance singleton
export const notesService = new NotesService();
