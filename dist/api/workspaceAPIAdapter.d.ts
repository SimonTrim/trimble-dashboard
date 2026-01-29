/**
 * Adaptateur pour transformer le WorkspaceAPI en interface compatible avec nos services
 * Permet d'utiliser les vraies données du projet Trimble Connect
 */
import { ProjectFile, TrimbleNote, BCFTopic, ProjectView } from '../models/types';
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
export declare class WorkspaceAPIAdapter {
    private workspaceAPI;
    private projectId;
    private accessToken;
    private baseUrl;
    constructor(workspaceAPI: WorkspaceAPIInstance, projectId: string);
    /**
     * Obtenir le token d'accès pour les appels API
     */
    private getAccessToken;
    /**
     * Faire un appel REST à l'API Trimble Connect
     */
    private makeApiCall;
    /**
     * Interface compatible avec notre code existant
     */
    get project(): {
        get: () => Promise<any>;
    };
    /**
     * API des fichiers
     */
    get files(): {
        getAll: () => Promise<ProjectFile[]>;
        getRecent: (options?: {
            limit?: number;
            since?: number;
        }) => Promise<ProjectFile[]>;
    };
    /**
     * API des notes
     */
    get notes(): {
        getAll: () => Promise<TrimbleNote[]>;
        get: (id: string) => Promise<TrimbleNote | null>;
    };
    /**
     * API des BCF Topics
     */
    get bcf(): {
        getTopics: () => Promise<BCFTopic[]>;
    };
    /**
     * API des vues
     */
    get views(): {
        getAll: () => Promise<ProjectView[]>;
        get: (id: string) => Promise<ProjectView | null>;
    };
}
/**
 * Créer un adaptateur à partir du WorkspaceAPI
 */
export declare function createWorkspaceAPIAdapter(workspaceAPI: WorkspaceAPIInstance, projectId: string): any;
export {};
//# sourceMappingURL=workspaceAPIAdapter.d.ts.map