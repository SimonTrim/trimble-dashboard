/**
 * Adaptateur pour utiliser TrimbleConnectWorkspace API
 * Documentation: https://app.connect.trimble.com/tc/app/5.0.0/doc/
 *
 * ⚠️ IMPORTANT: Utiliser UNIQUEMENT les méthodes natives de l'API
 * NE JAMAIS faire d'appels fetch() directs - ils sont bloqués par CORS
 */
import { ProjectFile, TrimbleNote, BCFTopic, ProjectView } from '../models/types';
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
export declare class WorkspaceAPIAdapter {
    private workspaceAPI;
    private projectId;
    constructor(workspaceAPI: TrimbleWorkspaceAPI, projectId: string);
    /**
     * Interface compatible avec notre code existant
     */
    get project(): {
        get: () => Promise<any>;
    };
    /**
     * API des fichiers - Utilise project.getFiles()
     */
    get files(): {
        getAll: () => Promise<ProjectFile[]>;
        getRecent: (options?: {
            limit?: number;
            since?: number;
        }) => Promise<ProjectFile[]>;
    };
    /**
     * API des notes (Todos) - Utilise project.getTodos()
     */
    get notes(): {
        getAll: () => Promise<TrimbleNote[]>;
        get: (id: string) => Promise<TrimbleNote | null>;
    };
    /**
     * API des BCF Topics - Utilise project.getBCFTopics()
     */
    get bcf(): {
        getTopics: () => Promise<BCFTopic[]>;
    };
    /**
     * API des vues - Utilise project.getViews()
     */
    get views(): {
        getAll: () => Promise<ProjectView[]>;
        get: (id: string) => Promise<ProjectView | null>;
    };
}
/**
 * Créer un adaptateur à partir du TrimbleConnectWorkspace API
 */
export declare function createWorkspaceAPIAdapter(workspaceAPI: TrimbleWorkspaceAPI, projectId: string): any;
export {};
//# sourceMappingURL=workspaceAPIAdapter.d.ts.map