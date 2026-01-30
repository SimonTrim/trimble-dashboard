/**
 * Adaptateur pour utiliser TrimbleConnectWorkspace API
 * Documentation: https://app.connect.trimble.com/tc/app/5.0.0/doc/
 * 
 * ⚠️ IMPORTANT: Utiliser UNIQUEMENT les méthodes natives de l'API
 * NE JAMAIS faire d'appels fetch() directs - ils sont bloqués par CORS
 */

import { ProjectFile, TrimbleNote, BCFTopic, ProjectView } from '../models/types';
import { logger } from '../utils/logger';

// Interface du TrimbleConnectWorkspace API
interface TrimbleWorkspaceAPI {
  ui: {
    setMenu: (menu: any) => void;
    setActiveMenuItem: (command: string) => void;
  };
  project: {
    getCurrentProject: () => Promise<any>;
    getFiles?: () => Promise<any[]>;
    getViews?: () => Promise<any[]>;
    getTodos?: () => Promise<any[]>;
    getBCFTopics?: () => Promise<any[]>;
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
  private workspaceAPI: TrimbleWorkspaceAPI;
  private projectId: string;

  constructor(workspaceAPI: TrimbleWorkspaceAPI, projectId: string) {
    this.workspaceAPI = workspaceAPI;
    this.projectId = projectId;
    
    logger.info(`✅ WorkspaceAPIAdapter initialized for project: ${projectId}`);
  }

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
   * API des fichiers - Utilise project.getFiles()
   */
  get files() {
    return {
      getAll: async (): Promise<ProjectFile[]> => {
        try {
          logger.info('📁 Fetching files via TrimbleConnectWorkspace.project.getFiles()...');
          
          if (!this.workspaceAPI.project.getFiles) {
            logger.warn('⚠️ project.getFiles() not available in this API version');
            return [];
          }
          
          const rawFiles = await this.workspaceAPI.project.getFiles();
          
          const files: ProjectFile[] = rawFiles.map((file: any) => ({
            id: file.id || file.fileId,
            name: file.name || file.fileName || 'Unknown',
            extension: (file.name || '').split('.').pop() || '',
            size: file.size || file.fileSize || 0,
            uploadedBy: file.createdBy?.name || file.author || 'Unknown',
            uploadedAt: new Date(file.createdOn || file.uploadDate || new Date()),
            lastModified: new Date(file.modifiedOn || file.lastModified || file.createdOn || new Date()),
            path: file.path || file.folderPath || '/',
            downloadUrl: file.downloadUrl || undefined,
          }));

          logger.info(`✅ Retrieved ${files.length} files from TrimbleConnectWorkspace`);
          return files;
        } catch (error) {
          logger.error('Failed to fetch files from TrimbleConnectWorkspace', { error });
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
   * API des notes (Todos) - Utilise project.getTodos()
   */
  get notes() {
    return {
      getAll: async (): Promise<TrimbleNote[]> => {
        try {
          logger.info('📝 Fetching todos via TrimbleConnectWorkspace.project.getTodos()...');
          
          if (!this.workspaceAPI.project.getTodos) {
            logger.warn('⚠️ project.getTodos() not available in this API version');
            return [];
          }
          
          const rawTodos = await this.workspaceAPI.project.getTodos();
          
          // Transformer en notre format TrimbleNote
          const notes: TrimbleNote[] = rawTodos.map((todo: any) => ({
            id: todo.id || todo.todoId,
            title: todo.label || todo.title || 'Sans titre',
            content: todo.description || '',
            author: todo.createdBy?.name || todo.author || 'Unknown',
            createdAt: new Date(todo.createdOn || todo.createdDate || new Date()),
            updatedAt: new Date(todo.modifiedOn || todo.modifiedDate || todo.createdOn || new Date()),
            archived: todo.done || todo.completed || false,
            projectId: this.projectId,
          }));

          logger.info(`✅ Retrieved ${notes.length} todos from TrimbleConnectWorkspace`);
          return notes;
        } catch (error) {
          logger.error('Failed to fetch todos from TrimbleConnectWorkspace', { error });
          return [];
        }
      },

      get: async (id: string): Promise<TrimbleNote | null> => {
        try {
          // Récupérer tous les todos et filtrer par ID
          const allTodos = await this.notes.getAll();
          const todo = allTodos.find(t => t.id === id);
          return todo || null;
        } catch (error) {
          logger.error(`Failed to fetch todo ${id}`, { error });
          return null;
        }
      }
    };
  }

  /**
   * API des BCF Topics - Utilise project.getBCFTopics()
   */
  get bcf() {
    return {
      getTopics: async (): Promise<BCFTopic[]> => {
        try {
          logger.info('🔧 Fetching BCF topics via TrimbleConnectWorkspace.project.getBCFTopics()...');
          
          if (!this.workspaceAPI.project.getBCFTopics) {
            logger.warn('⚠️ project.getBCFTopics() not available in this API version');
            return [];
          }
          
          const rawTopics = await this.workspaceAPI.project.getBCFTopics();
          
          // Transformer en notre format BCFTopic
          const topics: BCFTopic[] = rawTopics.map((topic: any) => ({
            id: topic.guid || topic.id,
            title: topic.title || 'Sans titre',
            description: topic.description || '',
            status: topic.topic_status || topic.status || 'Open',
            priority: topic.priority || 'Medium',
            assignedTo: topic.assigned_to || topic.assignedTo || undefined,
            createdBy: topic.creation_author || topic.createdBy || 'Unknown',
            createdAt: new Date(topic.creation_date || topic.createdDate || new Date()),
            modifiedAt: new Date(topic.modified_date || topic.modifiedDate || topic.creation_date || new Date()),
            dueDate: topic.due_date ? new Date(topic.due_date) : undefined,
          }));

          logger.info(`✅ Retrieved ${topics.length} BCF topics from TrimbleConnectWorkspace`);
          return topics;
        } catch (error) {
          logger.error('Failed to fetch BCF topics from TrimbleConnectWorkspace', { error });
          return [];
        }
      }
    };
  }

  /**
   * API des vues - Utilise project.getViews()
   */
  get views() {
    return {
      getAll: async (): Promise<ProjectView[]> => {
        try {
          logger.info('👁️ Fetching views via TrimbleConnectWorkspace.project.getViews()...');
          
          if (!this.workspaceAPI.project.getViews) {
            logger.warn('⚠️ project.getViews() not available in this API version');
            return [];
          }
          
          const rawViews = await this.workspaceAPI.project.getViews();
          
          // Transformer en notre format ProjectView
          const views: ProjectView[] = rawViews.map((view: any) => ({
            id: view.id || view.viewId,
            name: view.name || view.viewName || 'Sans nom',
            description: view.description || undefined,
            createdBy: view.createdBy?.name || view.author || 'Unknown',
            createdAt: new Date(view.createdOn || view.createdDate || new Date()),
            thumbnail: view.thumbnail || view.thumbnailUrl || undefined,
            isDefault: view.isDefault || view.default || false,
          }));

          logger.info(`✅ Retrieved ${views.length} views from TrimbleConnectWorkspace`);
          return views;
        } catch (error) {
          logger.error('Failed to fetch views from TrimbleConnectWorkspace', { error });
          return [];
        }
      },

      get: async (id: string): Promise<ProjectView | null> => {
        try {
          // Récupérer toutes les vues et filtrer par ID
          const allViews = await this.views.getAll();
          const view = allViews.find(v => v.id === id);
          return view || null;
        } catch (error) {
          logger.error(`Failed to fetch view ${id}`, { error });
          return null;
        }
      }
    };
  }
}

/**
 * Créer un adaptateur à partir du TrimbleConnectWorkspace API
 */
export function createWorkspaceAPIAdapter(
  workspaceAPI: TrimbleWorkspaceAPI,
  projectId: string
): any {
  return new WorkspaceAPIAdapter(workspaceAPI, projectId);
}
