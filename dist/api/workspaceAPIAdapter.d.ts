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
    private baseUrl;
    private projectLocation;
    constructor(workspaceAPI: WorkspaceAPIInstance, projectId: string, projectLocation?: string);
    /**
     * Obtenir l'URL de l'API selon la région
     */
    private getRegionalApiUrl;
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
    get project(): {
        get: () => Promise<any>;
    };
    /**
     * API des fichiers - Utilise les méthodes WorkspaceAPI natives
     */
    get files(): {
        getAll: () => Promise<ProjectFile[]>;
        getRecent: (options?: {
            limit?: number;
            since?: number;
        }) => Promise<ProjectFile[]>;
    };
    /**
     * API des notes - Utilise les méthodes WorkspaceAPI natives
     */
    get notes(): {
        getAll: () => Promise<TrimbleNote[]>;
        get: (id: string) => Promise<TrimbleNote | null>;
    };
    /**
     * API des BCF Topics - Utilise les méthodes WorkspaceAPI natives
     */
    get bcf(): {
        getTopics: () => Promise<BCFTopic[]>;
    };
    /**
     * API des vues - Utilise les méthodes WorkspaceAPI natives
     */
    get views(): {
        getAll: () => Promise<ProjectView[]>;
        get: (id: string) => Promise<ProjectView | null>;
    };
}
/**
 * Créer un adaptateur à partir du WorkspaceAPI
 */
export declare function createWorkspaceAPIAdapter(workspaceAPI: WorkspaceAPIInstance, projectId: string, projectLocation?: string): any;
export {};
//# sourceMappingURL=workspaceAPIAdapter.d.ts.map