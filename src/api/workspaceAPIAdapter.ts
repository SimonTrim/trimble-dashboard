/**
 * Adaptateur pour utiliser TrimbleConnectWorkspace API + REST API
 * 
 * ARCHITECTURE:
 * - WorkspaceAPI: getCurrentProject(), getUserSettings(), setMenu()
 * - REST API: Fichiers, Todos, BCF Topics, Views (avec token d'accès)
 * 
 * Documentation:
 * - WorkspaceAPI: https://components.connect.trimble.com/trimble-connect-workspace-api/
 * - Core API (Files/Todos/Views): https://developer.trimble.com/docs/connect/core
 * - Topics API (BCF): https://developer.trimble.com/docs/connect/tools/api/topics/
 */

import { ProjectFile, TrimbleNote, BCFTopic, ProjectView } from '../models/types';
import { logger } from '../utils/logger';

// Interface du TrimbleConnectWorkspace API (méthodes natives UNIQUEMENT)
interface TrimbleWorkspaceAPI {
  ui: {
    setMenu: (menu: any) => void;
    setActiveMenuItem: (command: string) => void;
  };
  project: {
    getCurrentProject: () => Promise<any>;
    getProject?: () => Promise<any>;
    getMembers?: () => Promise<any[]>;
    getSettings?: () => Promise<any>;
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
  private projectLocation: string;
  private backendUrl: string;
  private accessToken: string | null = null;

  constructor(
    workspaceAPI: TrimbleWorkspaceAPI, 
    projectId: string, 
    projectLocation?: string,
    accessToken?: string,
    backendUrl?: string
  ) {
    this.workspaceAPI = workspaceAPI;
    this.projectId = projectId;
    this.projectLocation = projectLocation || 'us';
    this.accessToken = accessToken || null;
    
    // Utiliser le backend proxy au lieu de l'API Trimble directe
    this.backendUrl = backendUrl || 'https://trimble-dashboard.vercel.app';
    
    logger.info(`✅ WorkspaceAPIAdapter initialized for project: ${projectId}`);
    logger.info(`🌍 Region: ${this.projectLocation}`);
    logger.info(`🔗 Backend URL: ${this.backendUrl}`);
    if (this.accessToken) {
      logger.info(`🔑 Access token provided`);
    }
  }

  /**
   * Obtenir le token d'accès (avec gestion du consentement utilisateur)
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      logger.info('🔑 Requesting access token...');
      const token = await this.workspaceAPI.extension.requestPermission('accesstoken');
      
      if (token === 'pending') {
        logger.warn('⏳ Waiting for user consent...');
        throw new Error('User consent required for access token');
      }
      
      if (token === 'denied') {
        logger.error('❌ User denied access token permission');
        throw new Error('User denied access token permission');
      }
      
      this.accessToken = token;
      logger.info('✅ Access token obtained');
      return token;
    } catch (error) {
      logger.error('Failed to get access token', { error });
      throw error;
    }
  }

  /**
   * Faire un appel REST authentifié via le backend proxy
   */
  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    
    // Construire l'URL du backend proxy
    // Endpoint format: /projects/{projectId}/files
    // Backend format: /api/projects/{projectId}/files
    const backendEndpoint = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint}`;
    const url = `${this.backendUrl}${backendEndpoint}`;
    
    logger.info(`🌐 API Request via backend: ${options?.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Backend API Error ${response.status}: ${errorText}`);
      throw new Error(`Backend API Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
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
   * API des fichiers - Utilise REST API Core
   * Endpoint: GET /projects/{projectId}/files
   */
  get files() {
    return {
      getAll: async (): Promise<ProjectFile[]> => {
        try {
          logger.info('📁 Fetching files via REST API /projects/{projectId}/files...');
          
          const response = await this.fetchAPI<any[]>(`/projects/${this.projectId}/files`);
          
          const files: ProjectFile[] = response.map((file: any) => ({
            id: file.id,
            name: file.name || 'Unknown',
            extension: (file.name || '').split('.').pop() || '',
            size: file.size || 0,
            uploadedBy: file.createdBy?.name || 'Unknown',
            uploadedAt: new Date(file.createdOn || new Date()),
            lastModified: new Date(file.modifiedOn || file.createdOn || new Date()),
            path: file.parentPath || '/',
            downloadUrl: file.downloadUrl || undefined,
          }));

          logger.info(`✅ Retrieved ${files.length} files from REST API`);
          return files;
        } catch (error) {
          logger.error('Failed to fetch files from REST API', { error });
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
   * API des notes (Todos) - Utilise REST API Core
   * Endpoint: GET /projects/{projectId}/todos
   */
  get notes() {
    return {
      getAll: async (): Promise<TrimbleNote[]> => {
        try {
          logger.info('📝 Fetching todos via REST API /projects/{projectId}/todos...');
          
          const response = await this.fetchAPI<any[]>(`/projects/${this.projectId}/todos`);
          
          // Transformer en notre format TrimbleNote
          const notes: TrimbleNote[] = response.map((todo: any) => ({
            id: todo.id,
            title: todo.label || todo.title || 'Sans titre',
            content: todo.description || '',
            author: todo.createdBy?.name || 'Unknown',
            createdAt: new Date(todo.createdOn || new Date()),
            updatedAt: new Date(todo.modifiedOn || todo.createdOn || new Date()),
            archived: todo.done || false,
            projectId: this.projectId,
          }));

          logger.info(`✅ Retrieved ${notes.length} todos from REST API`);
          return notes;
        } catch (error) {
          logger.error('Failed to fetch todos from REST API', { error });
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
   * API des BCF Topics - Utilise REST API Topics (BCF 2.1/3.0)
   * Endpoint: GET /projects/{projectId}/topics
   */
  get bcf() {
    return {
      getTopics: async (): Promise<BCFTopic[]> => {
        try {
          logger.info('🔧 Fetching BCF topics via REST API /projects/{projectId}/topics...');
          
          const response = await this.fetchAPI<any[]>(`/projects/${this.projectId}/topics`);
          
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

          logger.info(`✅ Retrieved ${topics.length} BCF topics from REST API`);
          return topics;
        } catch (error) {
          logger.error('Failed to fetch BCF topics from REST API', { error });
          return [];
        }
      }
    };
  }

  /**
   * API des vues - Utilise REST API Core
   * Endpoint: GET /projects/{projectId}/views
   */
  get views() {
    return {
      getAll: async (): Promise<ProjectView[]> => {
        try {
          logger.info('👁️ Fetching views via REST API /projects/{projectId}/views...');
          
          const response = await this.fetchAPI<any[]>(`/projects/${this.projectId}/views`);
          
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

          logger.info(`✅ Retrieved ${views.length} views from REST API`);
          return views;
        } catch (error) {
          logger.error('Failed to fetch views from REST API', { error });
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
export function createWorkspaceAPIAdapter(params: {
  workspaceAPI: TrimbleWorkspaceAPI;
  projectInfo: any;
  accessToken?: string;
  baseUrl?: string;
}): any {
  return new WorkspaceAPIAdapter(
    params.workspaceAPI, 
    params.projectInfo.id, 
    params.projectInfo.location,
    params.accessToken,
    params.baseUrl
  );
}
