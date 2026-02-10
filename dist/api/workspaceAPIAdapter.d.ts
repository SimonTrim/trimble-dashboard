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
export declare class WorkspaceAPIAdapter {
    private workspaceAPI;
    private projectId;
    private projectLocation;
    private baseUrl;
    private accessToken;
    constructor(workspaceAPI: TrimbleWorkspaceAPI, projectId: string, projectLocation?: string, accessToken?: string);
    /**
     * Obtenir l'URL de l'API selon la région
     */
    private getRegionalApiUrl;
    /**
     * Obtenir le token d'accès (avec gestion du consentement utilisateur)
     */
    private getAccessToken;
    /**
     * Faire un appel REST authentifié vers l'API Trimble Connect
     */
    private fetchAPI;
    /**
     * Interface compatible avec notre code existant
     */
    get project(): {
        get: () => Promise<any>;
    };
    /**
     * API des fichiers - Utilise REST API Core
     * Endpoint: GET /projects/{projectId}/files
     */
    get files(): {
        getAll: () => Promise<ProjectFile[]>;
        getRecent: (options?: {
            limit?: number;
            since?: number;
        }) => Promise<ProjectFile[]>;
    };
    /**
     * API des notes (Todos) - Utilise REST API Core
     * Endpoint: GET /projects/{projectId}/todos
     */
    get notes(): {
        getAll: () => Promise<TrimbleNote[]>;
        get: (id: string) => Promise<TrimbleNote | null>;
    };
    /**
     * API des BCF Topics - Utilise REST API Topics (BCF 2.1/3.0)
     * Endpoint: GET /projects/{projectId}/topics
     */
    get bcf(): {
        getTopics: () => Promise<BCFTopic[]>;
    };
    /**
     * API des vues - Utilise REST API Core
     * Endpoint: GET /projects/{projectId}/views
     */
    get views(): {
        getAll: () => Promise<ProjectView[]>;
        get: (id: string) => Promise<ProjectView | null>;
    };
}
/**
 * Créer un adaptateur à partir du TrimbleConnectWorkspace API
 */
export declare function createWorkspaceAPIAdapter(params: {
    workspaceAPI: TrimbleWorkspaceAPI;
    projectInfo: any;
    accessToken?: string;
    baseUrl?: string;
}): any;
export {};
//# sourceMappingURL=workspaceAPIAdapter.d.ts.map