/**
 * Open project files in the Trimble Connect 2D viewer.
 */

import { ProjectFile } from '../models/types';
import { trimbleClient } from './trimbleClient';
import {
  build2DViewerUrl,
  mapProjectLocationToWebRegion,
  openInNewTab,
} from '../utils/trimbleViewer';
import { logger } from '../utils/logger';

export interface ViewerContext {
  projectId: string;
  webRegion: string;
}

let viewerContext: ViewerContext | null = null;

export function setViewerContext(ctx: ViewerContext): void {
  viewerContext = ctx;
}

export function getViewerContext(): ViewerContext | null {
  return viewerContext;
}

function resolveViewerContextSync(): ViewerContext | null {
  if (viewerContext) return viewerContext;
  try {
    const projectId = trimbleClient.getProjectId();
    if (projectId) {
      return { projectId, webRegion: 'europe' };
    }
  } catch {
    // Project id not cached yet
  }
  return null;
}

/**
 * Opens the 2D viewer in a new tab. The initial window.open call is synchronous
 * so it stays within the browser's user-gesture window (avoids popup blockers).
 */
export async function openProjectFileInViewer(file: ProjectFile): Promise<void> {
  const api = trimbleClient.getApi();
  const ctx = resolveViewerContextSync();
  const versionId = file.versionId || file.id;

  const immediateUrl = ctx
    ? build2DViewerUrl(ctx.projectId, versionId, ctx.webRegion)
    : 'about:blank';

  const tab = openInNewTab(immediateUrl);
  if (!tab && ctx) {
    logger.warn('Popup blocked — could not open 2D viewer tab', { fileId: file.id });
  }

  try {
    let refinedUrl = immediateUrl;

    if (api.navigation?.get2DViewerUrl) {
      refinedUrl = await api.navigation.get2DViewerUrl(file.id);
    } else if (!ctx) {
      const project = await api.project.get();
      const webRegion = mapProjectLocationToWebRegion(project.location || project.region);
      refinedUrl = build2DViewerUrl(project.id, versionId, webRegion);
      setViewerContext({ projectId: project.id, webRegion });
    }

    if (refinedUrl && refinedUrl !== immediateUrl) {
      if (tab && !tab.closed) {
        tab.location.href = refinedUrl;
      } else {
        openInNewTab(refinedUrl);
      }
    }

    logger.info('Opened file in Trimble Connect 2D viewer', {
      fileId: file.id,
      name: file.name,
      url: refinedUrl,
    });
  } catch (error) {
    logger.warn('Could not refine 2D viewer URL, using initial URL', {
      fileId: file.id,
      error,
    });
    if (!tab && ctx) {
      openInNewTab(immediateUrl);
    }
  }
}
