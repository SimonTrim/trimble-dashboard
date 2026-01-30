/**
 * Adaptateur pour transformer le WorkspaceAPI en interface compatible avec nos services
 * Permet d'utiliser les vraies données du projet Trimble Connect
 */

import { ProjectFile, TrimbleNote, BCFTopic, ProjectView } from '../models/types';
import { logger } from '../utils/logger';

// Interface du WorkspaceAPI
interface WorkspaceAPIInstance {
  ui: {
    setMenu: (menu: any) => void;
    setActiveMenuItem: (command: string) => void;
  };
  project: {
    getCurrentProject: () => Promise<any>;
  };
  user: {
    getUserSettings: () => Promise<any>;
  };
  extension: {
    requestPermission: (permission: 'accesstoken') => Promise<string>;
  };
}

/**
 * Adaptateur qui convertit le WorkspaceAPI en notre interface API
 */
export class WorkspaceAPIAdapter {
  private workspaceAPI: WorkspaceAPIInstance;
  private projectId: string;
  private baseUrl: string;
  private projectLocation: string;

  constructor(workspaceAPI: WorkspaceAPIInstance, projectId: string, projectLocation?: string) {
    this.workspaceAPI = workspaceAPI;
    this.projectId = projectId;
    this.projectLocation = projectLocation || 'us';
    
    // Déterminer l'URL de base selon la région du projet
    this.baseUrl = this.getRegionalApiUrl(this.projectLocation);
    
    logger.info(`🌍 WorkspaceAPIAdapter initialized for region: ${this.projectLocation}`);
    logger.info(`🔗 Using API URL: ${this.baseUrl}`);
  }

  /**
   * Obtenir l'URL de l'API selon la région
   */
  private getRegionalApiUrl(location: string): string {
    const regionUrls: Record<string, string> = {
      'europe': 'https://app21.connect.trimble.com/tc/api/2.0',
      'us': 'https://app.connect.trimble.com/tc/api/2.0',
      'asia': 'https://app-asia.connect.trimble.com/tc/api/2.0',
      'australia': 'https://app-au.connect.trimble.com/tc/api/2.0',
    };
    
    const url = regionUrls[location.toLowerCase()] || regionUrls['us'];
    logger.info(`📍 Region '${location}' mapped to: ${url}`);
    return url;
  }

  /**
   * IMPORTANT: NE PAS utiliser fetch() - Bloqué par CORS !
   * À la place, utiliser UNIQUEMENT les méthodes natives du WorkspaceAPI
   * 
   * Les appels REST directs depuis GitHub Pages vers l'API Trimble Connect
   * sont bloqués par CORS. Le WorkspaceAPI expose des méthodes natives qui
   * fonctionnent dans le contexte de l'iframe.
   */

  /**
   * Interface compatible avec notre code existant
   */
  get project() {
    return {
      get: async () => {
        try {
          const projectInfo = await this.workspaceAPI.project.getCurrentProject();
          logger.info('✓ Got real project info', { 
            id: projectInfo.id, 
            name: projectInfo.name 
          });
          return projectInfo;
        } catch (error) {
          logger.error('Failed to get project info', { error });
          throw error;
        }
      }
    };
  }

  /**
   * API des fichiers - Utilise les méthodes WorkspaceAPI natives
   */
  get files() {
    return {
      getAll: async (): Promise<ProjectFile[]> => {
        try {
          logger.info('📁 Fetching files using WorkspaceAPI (no REST calls)...');
          
          // Utiliser les méthodes natives du WorkspaceAPI (si disponibles)
          // Pour l'instant, retourner un tableau vide car WorkspaceAPI n'expose pas files.getAll()
          logger.warn('⚠️ WorkspaceAPI does not expose files API - using mock data');
          return [];
        } catch (error) {
          logger.error('Failed to fetch files', { error });
          return [];
        }
      },

      getRecent: async (options: { limit?: number; since?: number } = {}): Promise<ProjectFile[]> => {
        try {
          logger.info('Fetching recent files from Trimble Connect...');
          const allFiles = await this.files.getAll();
          
          // Filtrer par date si fournie
          let filtered = allFiles;
          if (options.since) {
            filtered = allFiles.filter((file) => {
              const fileDate = new Date(file.uploadedAt).getTime();
              return fileDate >= options.since!;
            });
          }

          // Trier par date décroissante
          filtered.sort((a, b) => {
            return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
          });

          // Limiter le nombre si spécifié
          if (options.limit) {
            filtered = filtered.slice(0, options.limit);
          }

          logger.info(`✓ Retrieved ${filtered.length} recent files`);
          return filtered;
        } catch (error) {
          logger.error('Failed to fetch recent files', { error });
          return [];
        }
      }
    };
  }

  /**
   * API des notes - Utilise les méthodes WorkspaceAPI natives
   */
  get notes() {
    return {
      getAll: async (): Promise<TrimbleNote[]> => {
        try {
          logger.info('📝 Fetching todos using WorkspaceAPI.todos.getTodos()...');
          
          // Utiliser la méthode native du WorkspaceAPI
          const todosAPI = (this.workspaceAPI as any).todos;
          
          if (!todosAPI || !todosAPI.getTodos) {
            logger.warn('⚠️ WorkspaceAPI.todos.getTodos() not available');
            return [];
          }
          
          const response = await todosAPI.getTodos();
          
          // Transformer en notre format TrimbleNote
          const notes: TrimbleNote[] = response.map((todo: any) => ({
            id: todo.id,
            title: todo.label || 'Sans titre',
            content: todo.description || '',
            author: todo.createdBy?.name || 'Unknown',
            createdAt: new Date(todo.createdOn || new Date()),
            updatedAt: new Date(todo.modifiedOn || todo.createdOn || new Date()),
            archived: todo.done || false,
            projectId: this.projectId,
          }));

          logger.info(`✅ Retrieved ${notes.length} todos via WorkspaceAPI`);
          return notes;
        } catch (error) {
          logger.error('Failed to fetch todos', { error });
          return [];
        }
      },

      get: async (id: string): Promise<TrimbleNote | null> => {
        try {
          const todosAPI = (this.workspaceAPI as any).todos;
          
          if (!todosAPI || !todosAPI.getTodo) {
            logger.warn('⚠️ WorkspaceAPI.todos.getTodo() not available');
            return null;
          }
          
          const response = await todosAPI.getTodo(id);
          
          return {
            id: response.id,
            title: response.label || 'Sans titre',
            content: response.description || '',
            author: response.createdBy?.name || 'Unknown',
            createdAt: new Date(response.createdOn || new Date()),
            updatedAt: new Date(response.modifiedOn || response.createdOn || new Date()),
            archived: response.done || false,
            projectId: this.projectId,
          };
        } catch (error) {
          logger.error(`Failed to fetch todo ${id}`, { error });
          return null;
        }
      }
    };
  }

  /**
   * API des BCF Topics - Utilise les méthodes WorkspaceAPI natives
   */
  get bcf() {
    return {
      getTopics: async (): Promise<BCFTopic[]> => {
        try {
          logger.info('🔧 Fetching BCF topics using WorkspaceAPI...');
          
          // Utiliser les méthodes natives du WorkspaceAPI (si disponibles)
          const bcfAPI = (this.workspaceAPI as any).bcf;
          
          if (!bcfAPI || !bcfAPI.getTopics) {
            logger.warn('⚠️ WorkspaceAPI.bcf.getTopics() not available - using empty array');
            return [];
          }
          
          const response = await bcfAPI.getTopics();
          
          // Transformer en notre format BCFTopic
          const topics: BCFTopic[] = response.map((topic: any) => ({
            id: topic.guid,
            title: topic.title || 'Sans titre',
            description: topic.description || '',
            status: topic.topic_status || 'Open',
            priority: topic.priority || 'Medium',
            assignedTo: topic.assigned_to || undefined,
            createdBy: topic.creation_author || 'Unknown',
            createdAt: new Date(topic.creation_date || new Date()),
            modifiedAt: new Date(topic.modified_date || topic.creation_date || new Date()),
            dueDate: topic.due_date ? new Date(topic.due_date) : undefined,
          }));

          logger.info(`✅ Retrieved ${topics.length} BCF topics via WorkspaceAPI`);
          return topics;
        } catch (error) {
          logger.error('Failed to fetch BCF topics', { error });
          return [];
        }
      }
    };
  }

  /**
   * API des vues - Utilise les méthodes WorkspaceAPI natives
   */
  get views() {
    return {
      getAll: async (): Promise<ProjectView[]> => {
        try {
          logger.info('👁️ Fetching views using WorkspaceAPI...');
          
          // Utiliser les méthodes natives du WorkspaceAPI (si disponibles)
          const viewsAPI = (this.workspaceAPI as any).views;
          
          if (!viewsAPI || !viewsAPI.getViews) {
            logger.warn('⚠️ WorkspaceAPI.views.getViews() not available - using empty array');
            return [];
          }
          
          const response = await viewsAPI.getViews();
          
          // Transformer en notre format ProjectView
          const views: ProjectView[] = response.map((view: any) => ({
            id: view.id,
            name: view.name || 'Sans nom',
            description: view.description || undefined,
            createdBy: view.createdBy?.name || 'Unknown',
            createdAt: new Date(view.createdOn || new Date()),
            thumbnail: view.thumbnail || undefined,
            isDefault: view.isDefault || false,
          }));

          logger.info(`✅ Retrieved ${views.length} views via WorkspaceAPI`);
          return views;
        } catch (error) {
          logger.error('Failed to fetch views', { error });
          return [];
        }
      },

      get: async (id: string): Promise<ProjectView | null> => {
        try {
          const viewsAPI = (this.workspaceAPI as any).views;
          
          if (!viewsAPI || !viewsAPI.getView) {
            logger.warn('⚠️ WorkspaceAPI.views.getView() not available');
            return null;
          }
          
          const response = await viewsAPI.getView(id);
          
          return {
            id: response.id,
            name: response.name || 'Sans nom',
            description: response.description || undefined,
            createdBy: response.createdBy?.name || 'Unknown',
            createdAt: new Date(response.createdOn || new Date()),
            thumbnail: response.thumbnail || undefined,
            isDefault: response.isDefault || false,
          };
        } catch (error) {
          logger.error(`Failed to fetch view ${id}`, { error });
          return null;
        }
      }
    };
  }
}

/**
 * Créer un adaptateur à partir du WorkspaceAPI
 */
export function createWorkspaceAPIAdapter(
  workspaceAPI: WorkspaceAPIInstance,
  projectId: string,
  projectLocation?: string
): any {
  return new WorkspaceAPIAdapter(workspaceAPI, projectId, projectLocation);
}
