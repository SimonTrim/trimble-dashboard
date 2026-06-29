/**
 * Helpers for opening resources in Trimble Connect web viewers.
 */
export declare function mapProjectLocationToWebRegion(location?: string): string;
export declare function is3DModelExtension(extension?: string): boolean;
export declare function build2DViewerUrl(projectId: string, versionId: string, webRegion?: string): string;
export declare function build3DModelViewerUrl(projectId: string, modelId: string, webRegion?: string): string;
export declare function buildBcfTopicViewerUrl(projectId: string, topicId: string, webRegion?: string): string;
export declare function buildSavedViewUrl(projectId: string, viewId: string, webRegion?: string): string;
/**
 * Open a URL in a new tab from the extension iframe.
 * Must be called synchronously inside a user click handler to avoid popup blockers.
 */
export declare function openInNewTab(url: string, existingTab?: Window | null): Window | null;
/**
 * @deprecated Use openInNewTab — window.top is blocked cross-origin in TC iframes.
 */
export declare function openTrimbleConnectUrl(url: string): void;
//# sourceMappingURL=trimbleViewer.d.ts.map