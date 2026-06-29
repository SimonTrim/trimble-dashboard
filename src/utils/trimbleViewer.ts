/**
 * Helpers for opening files in Trimble Connect web viewers.
 */

export function mapProjectLocationToWebRegion(location?: string): string {
  const loc = (location || 'europe').toLowerCase();
  if (loc === 'eu' || loc === 'europe') return 'europe';
  if (loc === 'us' || loc === 'northamerica') return 'northamerica';
  if (loc === 'ap' || loc === 'asia') return 'asia';
  if (loc === 'ap-au' || loc === 'australia') return 'australia';
  return loc;
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
  if (webRegion) params.set('region', webRegion);
  return `https://web.connect.trimble.com/projects/${encodeURIComponent(projectId)}/viewer/2D?${params.toString()}`;
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
