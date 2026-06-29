/**
 * Helpers for opening resources in Trimble Connect web viewers.
 */

export function mapProjectLocationToWebRegion(location?: string): string {
  const loc = (location || 'europe').toLowerCase();
  if (loc === 'eu' || loc === 'europe') return 'europe';
  if (loc === 'us' || loc === 'northamerica') return 'northamerica';
  if (loc === 'ap' || loc === 'asia') return 'asia';
  if (loc === 'ap-au' || loc === 'australia') return 'australia';
  return loc;
}

const VIEWER_3D_EXTENSIONS = new Set([
  'ifc', 'rvt', 'skp', 'nwd', 'nwc', '3dm', 'obj', 'fbx', 'stp', 'step', 'dgn',
]);

export function is3DModelExtension(extension?: string): boolean {
  return VIEWER_3D_EXTENSIONS.has((extension || '').toLowerCase());
}

function appendRegion(params: URLSearchParams, webRegion?: string): void {
  if (webRegion) params.set('region', webRegion);
}

export function build2DViewerUrl(
  projectId: string,
  versionId: string,
  webRegion?: string,
): string {
  const params = new URLSearchParams({
    id: versionId,
    version: versionId,
    type: 'revisions',
    etag: versionId,
  });
  appendRegion(params, webRegion);
  return `https://web.connect.trimble.com/projects/${encodeURIComponent(projectId)}/viewer/2D?${params.toString()}`;
}

export function build3DModelViewerUrl(
  projectId: string,
  modelId: string,
  webRegion?: string,
): string {
  const params = new URLSearchParams({ modelId });
  appendRegion(params, webRegion);
  return `https://web.connect.trimble.com/projects/${encodeURIComponent(projectId)}/viewer/3d/?${params.toString()}`;
}

export function buildBcfTopicViewerUrl(
  projectId: string,
  topicId: string,
  webRegion?: string,
): string {
  const params = new URLSearchParams({ topicId });
  appendRegion(params, webRegion);
  return `https://web.connect.trimble.com/projects/${encodeURIComponent(projectId)}/viewer/3d/?${params.toString()}`;
}

export function buildSavedViewUrl(
  projectId: string,
  viewId: string,
  webRegion?: string,
): string {
  const params = new URLSearchParams({ viewId });
  appendRegion(params, webRegion);
  return `https://web.connect.trimble.com/projects/${encodeURIComponent(projectId)}/viewer/3d/?${params.toString()}`;
}

/**
 * Open a URL in a new tab from the extension iframe.
 * Must be called synchronously inside a user click handler to avoid popup blockers.
 */
export function openInNewTab(url: string, existingTab?: Window | null): Window | null {
  if (existingTab && !existingTab.closed) {
    try {
      existingTab.location.href = url;
      return existingTab;
    } catch {
      // Fall through to window.open
    }
  }
  return window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * @deprecated Use openInNewTab — window.top is blocked cross-origin in TC iframes.
 */
export function openTrimbleConnectUrl(url: string): void {
  const tab = openInNewTab(url);
  if (!tab) {
    window.location.assign(url);
  }
}
