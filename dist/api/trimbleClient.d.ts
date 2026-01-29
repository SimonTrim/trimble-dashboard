/**
 * Client principal pour l'API Trimble Connect
 * Gère la connexion et l'initialisation de l'API
 */
export type TrimbleAPI = any;
declare class TrimbleClient {
    private api;
    private projectId;
    private isInitialized;
    /**
     * Initialiser la connexion avec Trimble Connect
     */
    initialize(): Promise<TrimbleAPI>;
    /**
     * Créer une API de fallback minimale
     */
    private createFallbackAPI;
    /**
     * Récupérer l'instance de l'API
     */
    getApi(): TrimbleAPI;
    /**
     * Récupérer l'ID du projet actuel
     */
    getProjectId(): string;
    /**
     * Vérifier si l'API est initialisée
     */
    isReady(): boolean;
    /**
     * Réinitialiser la connexion
     */
    reconnect(): Promise<TrimbleAPI>;
    /**
     * Exécuter une opération API avec retry automatique
     */
    executeWithRetry<T>(operation: (api: TrimbleAPI) => Promise<T>, context: string): Promise<T>;
}
export declare const trimbleClient: TrimbleClient;
export {};
//# sourceMappingURL=trimbleClient.d.ts.map