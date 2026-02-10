/**
 * Service d'authentification pour gérer le flux OAuth2
 * via le backend proxy
 */

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  region: string;
}

interface AuthStatus {
  authenticated: boolean;
  tokens?: AuthTokens;
  error?: string;
}

export class AuthService {
  private backendUrl: string;
  private sessionId: string | null = null;
  private tokens: AuthTokens | null = null;

  constructor() {
    // Utiliser window.BACKEND_URL si défini (mode local), sinon URL production
    this.backendUrl = (window as any).BACKEND_URL || 'https://your-backend-url.vercel.app';
    
    // Vérifier si on revient du callback OAuth
    this.checkAuthCallback();
  }

  /**
   * Vérifie si l'URL contient des paramètres de callback OAuth
   */
  private checkAuthCallback(): void {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    const authStatus = params.get('auth');

    if (session && authStatus === 'success') {
      this.sessionId = session;
      console.log('✅ Authentification réussie, session:', session);
      
      // Récupérer les tokens depuis le backend
      this.fetchTokens().then(() => {
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  async isAuthenticated(): Promise<boolean> {
    if (this.tokens && this.tokens.expiresAt > Date.now()) {
      return true;
    }

    if (this.sessionId) {
      try {
        await this.fetchTokens();
        return this.tokens !== null;
      } catch (error) {
        console.error('Erreur vérification auth:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Récupère les tokens depuis le backend
   */
  private async fetchTokens(): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Aucune session active');
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/auth/status?session=${this.sessionId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Échec récupération tokens');
      }

      const data: AuthStatus = await response.json();
      
      if (data.authenticated && data.tokens) {
        this.tokens = data.tokens;
        console.log('✅ Tokens récupérés, expire dans:', 
          Math.round((data.tokens.expiresAt - Date.now()) / 1000), 's');
      } else {
        throw new Error('Tokens non disponibles');
      }
    } catch (error) {
      console.error('❌ Erreur fetchTokens:', error);
      throw error;
    }
  }

  /**
   * Initie le flux d'authentification OAuth2
   */
  async login(): Promise<void> {
    // Générer ou récupérer un ID de session
    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
    }

    // Rediriger vers le backend pour démarrer le flux OAuth
    const loginUrl = `${this.backendUrl}/auth/login?session=${this.sessionId}`;
    console.log('🔐 Redirection vers:', loginUrl);
    
    window.location.href = loginUrl;
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.tokens = null;
    this.sessionId = null;
    console.log('👋 Déconnexion');
  }

  /**
   * Récupère l'access token actuel
   */
  getAccessToken(): string | null {
    if (!this.tokens || this.tokens.expiresAt <= Date.now()) {
      return null;
    }
    return this.tokens.accessToken;
  }

  /**
   * Récupère la région du projet
   */
  getRegion(): string {
    return this.tokens?.region || 'us';
  }

  /**
   * Génère un ID de session aléatoire
   */
  private generateSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Effectue un appel API avec authentification
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getAccessToken();
    
    if (!token) {
      throw new Error('Non authentifié - token manquant');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Si 401, le token a peut-être expiré
    if (response.status === 401) {
      console.warn('⚠️ Token expiré, reconnexion nécessaire');
      this.tokens = null;
      throw new Error('Token expiré');
    }

    return response;
  }
}

// Export d'une instance singleton
export const authService = new AuthService();
