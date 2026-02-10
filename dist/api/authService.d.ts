/**
 * Service d'authentification pour gérer le flux OAuth2
 * via le backend proxy
 */
export declare class AuthService {
    private backendUrl;
    private sessionId;
    private tokens;
    constructor();
    /**
     * Vérifie si l'URL contient des paramètres de callback OAuth
     */
    private checkAuthCallback;
    /**
     * Vérifie si l'utilisateur est authentifié
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Récupère les tokens depuis le backend
     */
    private fetchTokens;
    /**
     * Initie le flux d'authentification OAuth2
     */
    login(): Promise<void>;
    /**
     * Déconnexion
     */
    logout(): void;
    /**
     * Récupère l'access token actuel
     */
    getAccessToken(): string | null;
    /**
     * Récupère la région du projet
     */
    getRegion(): string;
    /**
     * Génère un ID de session aléatoire
     */
    private generateSessionId;
    /**
     * Effectue un appel API avec authentification
     */
    authenticatedFetch(url: string, options?: RequestInit): Promise<Response>;
}
export declare const authService: AuthService;
//# sourceMappingURL=authService.d.ts.map