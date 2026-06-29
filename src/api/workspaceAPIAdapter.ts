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
import { normalizeFilePath } from '../utils/filePath';
import {
  build2DViewerUrl,
  mapProjectLocationToWebRegion,
} from '../utils/trimbleViewer';

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
  view?: {
    getViews: () => Promise<any[]>;
    getView: (viewId: string) => Promise<any>;
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
   * Mettre à jour le token d'accès (appelé lors du refresh automatique)
   */
  updateAccessToken(newToken: string): void {
    this.accessToken = newToken;
    logger.info('🔑 Access token updated');
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
        'X-Project-Region': this.projectLocation, // Envoyer la région du projet au backend
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
          
          const files: ProjectFile[] = response.map((file: any) => {
            const fileName = file.name || file.nm || file.label || 'Unknown';

            // Backend now resolves user IDs to names, so createdBy should be a readable string
            const uploadedBy = file.createdBy && file.createdBy !== 'Unknown'
              ? String(file.createdBy)
              : (file.modifiedBy && file.modifiedBy !== 'Unknown'
                ? String(file.modifiedBy)
                : 'Inconnu');

            const activityDate = file.modifiedOn || file.mt || file.createdOn || file.ct;

            return {
              id: file.id,
              name: fileName,
              extension: fileName.includes('.') ? fileName.split('.').pop() || '' : '',
              size: file.size || file.sz || 0,
              uploadedBy,
              uploadedAt: new Date(activityDate || new Date()),
              lastModified: new Date(activityDate || new Date()),
              path: normalizeFilePath(file.parentPath || file.path),
              parentId: file.parentId || undefined,
              downloadUrl: file.downloadUrl || undefined,
            };
          });

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
   * Navigation — open files in Trimble Connect web viewers
   */
  get navigation() {
    const get2DViewerUrl = async (fileId: string): Promise<string> => {
      try {
        const data = await this.fetchAPI<{ viewerUrl: string }>(
          `/projects/${this.projectId}/files/${fileId}/viewer-2d`,
        );
        return data.viewerUrl;
      } catch (error) {
        logger.warn('viewer-2d API failed, using direct URL fallback', { fileId, error });
        const webRegion = mapProjectLocationToWebRegion(this.projectLocation);
        return build2DViewerUrl(this.projectId, fileId, webRegion);
      }
    };

    return {
      get2DViewerUrl,
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
          const notes: TrimbleNote[] = response.map((todo: any) => {
            let author = 'Unknown';
            if (todo.createdBy) {
              if (typeof todo.createdBy === 'string') {
                author = todo.createdBy;
              } else {
                author = todo.createdBy.name
                  || [todo.createdBy.firstName, todo.createdBy.lastName].filter(Boolean).join(' ')
                  || todo.createdBy.email
                  || 'Unknown';
              }
            }
            
            return {
              id: todo.id,
              title: todo.label || todo.title || 'Sans titre',
              content: todo.description || '',
              author,
              createdAt: new Date(todo.createdOn || new Date()),
              updatedAt: new Date(todo.modifiedOn || todo.createdOn || new Date()),
              archived: todo.done || false,
              projectId: this.projectId,
            };
          });

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
   * Endpoint: GET /projects/{projectId}/bcf/topics
   */
  get bcf() {
    return {
      getTopics: async (): Promise<BCFTopic[]> => {
        try {
          logger.info('🔧 Fetching BCF topics via REST API /projects/{projectId}/bcf/topics...');
          
          const response = await this.fetchAPI<any[]>(`/projects/${this.projectId}/bcf/topics`);
          
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
   * API des vues - Tries Workspace API first (provides imageData/thumbnail), falls back to REST API
   */
  get views() {
    // Cache to store imageData/thumbnail from view objects for later use by getThumbnail
    const viewImageCache = new Map<string, string>();

    return {
      getAll: async (): Promise<ProjectView[]> => {
        // Try Workspace API first (returns ViewSpec with imageData/thumbnail)
        if (this.workspaceAPI.view) {
          try {
            logger.info('👁️ Fetching views via Workspace API view.getViews()...');
            const wsViews = await this.workspaceAPI.view.getViews();

            const views: ProjectView[] = wsViews.map((view: any) => {
              // Cache imageData or thumbnail for later getThumbnail calls
              if (view.imageData) {
                viewImageCache.set(view.id, view.imageData);
              } else if (view.thumbnail) {
                viewImageCache.set(view.id, view.thumbnail);
              }

              let createdBy = 'Unknown';
              if (view.createdBy) {
                createdBy = typeof view.createdBy === 'string'
                  ? view.createdBy
                  : (view.createdBy.name || [view.createdBy.firstName, view.createdBy.lastName].filter(Boolean).join(' ') || view.createdBy.email || 'Unknown');
              }

              return {
                id: view.id,
                name: view.name || 'Sans nom',
                description: view.description || undefined,
                createdBy,
                createdAt: new Date(view.createdOn || view.modifiedOn || new Date()),
                thumbnail: view.imageData || view.thumbnail || view.thumbnailUrl || undefined,
                isDefault: view.isDefault || false,
              };
            });

            logger.info(`✅ Retrieved ${views.length} views via Workspace API (${viewImageCache.size} with thumbnails)`);
            return views;
          } catch (wsError) {
            logger.warn('Workspace API view.getViews() failed, falling back to REST API', { wsError });
          }
        }

        // Fallback: REST API
        try {
          logger.info('👁️ Fetching views via REST API /projects/{projectId}/views...');
          const response = await this.fetchAPI<any[]>(`/projects/${this.projectId}/views`);

          const views: ProjectView[] = response.map((view: any) => {
            if (view.thumbnail || view.thumbnailUrl) {
              viewImageCache.set(view.id, view.thumbnail || view.thumbnailUrl);
            }

            let createdBy = 'Unknown';
            if (view.createdBy) {
              createdBy = typeof view.createdBy === 'string'
                ? view.createdBy
                : (view.createdBy.name || [view.createdBy.firstName, view.createdBy.lastName].filter(Boolean).join(' ') || view.createdBy.email || 'Unknown');
            }

            return {
              id: view.id,
              name: view.name || 'Sans nom',
              description: view.description || undefined,
              createdBy,
              createdAt: new Date(view.createdOn || view.modifiedOn || new Date()),
              thumbnail: view.thumbnail || view.thumbnailUrl || undefined,
              isDefault: view.isDefault || false,
            };
          });

          logger.info(`✅ Retrieved ${views.length} views from REST API`);
          return views;
        } catch (error) {
          logger.error('Failed to fetch views from REST API', { error });
          return [];
        }
      },

      get: async (id: string): Promise<ProjectView | null> => {
        try {
          const allViews = await this.views.getAll();
          return allViews.find(v => v.id === id) || null;
        } catch (error) {
          logger.error(`Failed to fetch view ${id}`, { error });
          return null;
        }
      },

      getThumbnail: async (viewId: string): Promise<string | null> => {
        try {
          // Check cache first: imageData (base64 data URL) can be used directly
          const cached = viewImageCache.get(viewId);
          if (cached) {
            if (cached.startsWith('data:')) {
              logger.info(`✅ Using cached base64 imageData for view ${viewId}`);
              return cached;
            }
            // If it's a full HTTP URL, try fetching it directly with auth
            if (cached.startsWith('http')) {
              logger.info(`🔗 Trying cached thumbnail URL for view ${viewId}: ${cached}`);
              try {
                const token = await this.getAccessToken();
                const resp = await fetch(cached, {
                  headers: { 'Authorization': `Bearer ${token}` },
                });
                if (resp.ok) {
                  const blob = await resp.blob();
                  if (blob.size > 0) return URL.createObjectURL(blob);
                }
              } catch (e) {
                logger.warn(`Direct thumbnail URL fetch failed for ${viewId}`, { e });
              }
            }
          }

          // Fallback: use the backend proxy
          const token = await this.getAccessToken();
          const url = `${this.backendUrl}/api/projects/${this.projectId}/views/${viewId}/thumbnail`;

          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Project-Region': this.projectLocation,
            },
          });

          if (!response.ok) return null;

          const blob = await response.blob();
          return blob.size > 0 ? URL.createObjectURL(blob) : null;
        } catch (error) {
          logger.error(`Failed to fetch thumbnail for view ${viewId}`, { error });
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
