/**
 * Service pour gérer les Notes Trimble Connect
 */
import { TrimbleNote } from '../models/types';
declare class NotesService {
    /**
     * Récupérer toutes les notes actives (non archivées)
     */
    getActiveNotes(): Promise<TrimbleNote[]>;
    /**
     * Compter le nombre de notes actives
     */
    countActiveNotes(): Promise<number>;
    /**
     * Récupérer une note par ID
     */
    getNoteById(noteId: string): Promise<TrimbleNote | null>;
    /**
     * Récupérer les notes récentes (dernières 7 jours)
     */
    getRecentNotes(days?: number): Promise<TrimbleNote[]>;
}
export declare const notesService: NotesService;
export {};
//# sourceMappingURL=notesService.d.ts.map