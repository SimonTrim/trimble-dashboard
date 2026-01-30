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
  private accessToken: string | null = null;
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
   * Obtenir le token d'accès pour les appels API
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      this.accessToken = await this.workspaceAPI.extension.requestPermission('accesstoken');
      logger.info('✓ Access token obtained');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get access token', { error });
      throw error;
    }
  }

  /**
   * Faire un appel REST à l'API Trimble Connect
   */
  private async makeApiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    
    const url = `${this.baseUrl}${endpoint}`;
    logger.info(`🌐 API Call: ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ API call failed: ${response.status} ${response.statusText}`, {
        url,
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    logger.info(`✅ API call success: ${url}`, { 
      dataLength: Array.isArray(data) ? data.length : 'not an array'
    });
    return data;
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
   * API des fichiers
   */
  get files() {
    return {
      getAll: async (): Promise<ProjectFile[]> => {
        try {
          logger.info('Fetching real files from Trimble Connect...');
          const response = await this.makeApiCall<any>(
            `/projects/${this.projectId}/files`
          );
          
          // Transformer la réponse en notre format ProjectFile
          const files: ProjectFile[] = response.map((file: any) => ({
            id: file.id,
            name: file.name,
            extension: file.name.split('.').pop() || '',
            size: file.size || 0,
            uploadedBy: file.createdBy?.name || 'Unknown',
            uploadedAt: new Date(file.createdOn || new Date()),
            lastModified: new Date(file.modifiedOn || file.createdOn || new Date()),
            path: file.path || '/',
            downloadUrl: file.downloadUrl || undefined,
          }));

          logger.info(`✓ Retrieved ${files.length} real files`);
          return files;
        } catch (error) {
          logger.error('Failed to fetch real files, using empty array', { error });
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
   * API des notes
   */
  get notes() {
    return {
      getAll: async (): Promise<TrimbleNote[]> => {
        try {
          logger.info('Fetching real notes from Trimble Connect...');
          const response = await this.makeApiCall<any>(
            `/projects/${this.projectId}/todos`
          );
          
          // Transformer en notre format TrimbleNote
          const notes: TrimbleNote[] = response.map((note: any) => ({
            id: note.id,
            title: note.label || 'Sans titre',
            content: note.description || '',
            author: note.createdBy?.name || 'Unknown',
            createdAt: new Date(note.createdOn || new Date()),
            updatedAt: new Date(note.modifiedOn || note.createdOn || new Date()),
            archived: note.done || false,
            projectId: this.projectId,
          }));

          logger.info(`✓ Retrieved ${notes.length} real notes`);
          return notes;
        } catch (error) {
          logger.error('Failed to fetch real notes, using empty array', { error });
          return [];
        }
      },

      get: async (id: string): Promise<TrimbleNote | null> => {
        try {
          const response = await this.makeApiCall<any>(
            `/projects/${this.projectId}/todos/${id}`
          );
          
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
          logger.error(`Failed to fetch note ${id}`, { error });
          return null;
        }
      }
    };
  }

  /**
   * API des BCF Topics
   */
  get bcf() {
    return {
      getTopics: async (): Promise<BCFTopic[]> => {
        try {
          logger.info('Fetching real BCF topics from Trimble Connect...');
          // L'API BCF utilise un endpoint différent
          const response = await this.makeApiCall<any>(
            `/projects/${this.projectId}/bcf/topics`
          );
          
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

          logger.info(`✓ Retrieved ${topics.length} real BCF topics`);
          return topics;
        } catch (error) {
          logger.error('Failed to fetch real BCF topics, using empty array', { error });
          return [];
        }
      }
    };
  }

  /**
   * API des vues
   */
  get views() {
    return {
      getAll: async (): Promise<ProjectView[]> => {
        try {
          logger.info('Fetching real views from Trimble Connect...');
          const response = await this.makeApiCall<any>(
            `/projects/${this.projectId}/views`
          );
          
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

          logger.info(`✓ Retrieved ${views.length} real views`);
          return views;
        } catch (error) {
          logger.error('Failed to fetch real views, using empty array', { error });
          return [];
        }
      },

      get: async (id: string): Promise<ProjectView | null> => {
        try {
          const response = await this.makeApiCall<any>(
            `/projects/${this.projectId}/views/${id}`
          );
          
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
