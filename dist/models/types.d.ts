/**
 * Types TypeScript pour l'extension Trimble Dashboard
 * Définit toutes les interfaces et types utilisés dans le projet
 */
/**
 * Interface pour une Note Trimble Connect
 */
export interface TrimbleNote {
    id: string;
    title: string;
    content: string;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    archived: boolean;
    projectId: string;
}
/**
 * Statuts possibles d'un BCF
 */
export type BCFStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
/**
 * Interface pour un Topic BCF (BIM Collaboration Format)
 */
export interface BCFTopic {
    id: string;
    title: string;
    description: string;
    status: BCFStatus;
    priority: 'Low' | 'Medium' | 'High';
    assignedTo?: string;
    createdBy: string;
    createdAt: Date;
    modifiedAt: Date;
    dueDate?: Date;
}
/**
 * Interface pour un Fichier projet
 */
export interface ProjectFile {
    id: string;
    name: string;
    extension: string;
    size: number;
    uploadedBy: string;
    uploadedAt: Date;
    lastModified: Date;
    downloadUrl?: string;
    path: string;
}
/**
 * Interface pour une Vue 3D sauvegardée
 */
export interface ProjectView {
    id: string;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: Date;
    thumbnail?: string;
    isDefault: boolean;
}
/**
 * Métriques principales du dashboard
 */
export interface DashboardMetrics {
    activeNotes: number;
    activeBCF: number;
    recentFiles: number;
    totalViews: number;
}
/**
 * Données pour le graphique de répartition BCF
 */
export interface BCFStatusData {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
}
/**
 * Point de données pour le graphique de tendance fichiers
 */
export interface FileTrendDataPoint {
    date: string;
    count: number;
}
/**
 * Configuration du dashboard
 */
export interface DashboardConfig {
    refreshInterval: number;
    recentFilesThreshold: number;
    maxRecentFilesDisplay: number;
    enableAutoRefresh: boolean;
}
/**
 * Données pour le graphique de priorité BCF
 */
export interface BCFPriorityData {
    high: number;
    medium: number;
    low: number;
}
/**
 * Élément d'activité récente pour la timeline
 */
export interface ActivityItem {
    id: string;
    type: 'file' | 'bcf' | 'note' | 'view';
    title: string;
    date: Date;
    author: string;
}
/**
 * Membre d'équipe avec statistiques de contributions
 */
export interface TeamMember {
    name: string;
    filesCount: number;
    bcfCount: number;
    notesCount: number;
    viewsCount: number;
    totalContributions: number;
    lastActivity: Date;
}
/**
 * Données de tendance pour les métriques (comparaison période courante vs précédente)
 */
export interface TrendData {
    current: number;
    previous: number;
    direction: 'up' | 'down' | 'neutral';
    changeCount: number;
}
/**
 * Niveaux de log
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
/**
 * Interface pour une entrée de log
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
}
/**
 * Type pour les erreurs de l'application
 */
export interface AppError {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
}
/**
 * État de chargement pour les composants UI
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
/**
 * Résultat d'une opération API
 */
export interface ApiResult<T> {
    data?: T;
    error?: AppError;
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
}
/**
 * Configuration pour Chart.js
 */
export interface ChartConfiguration {
    type: 'bar' | 'line' | 'pie' | 'doughnut';
    data: any;
    options: any;
}
/**
 * Couleurs de la charte graphique Trimble
 */
export declare const TRIMBLE_COLORS: {
    readonly primary: "#005F9E";
    readonly secondary: "#00A3E0";
    readonly success: "#28A745";
    readonly warning: "#FFC107";
    readonly danger: "#DC3545";
    readonly light: "#F8F9FA";
    readonly dark: "#212529";
};
//# sourceMappingURL=types.d.ts.map