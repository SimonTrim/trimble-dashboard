/**
 * Open project resources in Trimble Connect web viewers.
 */

import { BCFTopic, ProjectFile, ProjectView } from '../models/types';
import { trimbleClient } from './trimbleClient';
import {
  build2DViewerUrl,
  build3DModelViewerUrl,
  buildBcfTopicViewerUrl,
  buildSavedViewUrl,
  is3DModelExtension,
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

async function resolveViewerContext(): Promise<ViewerContext> {
  const cached = resolveViewerContextSync();
  if (cached) return cached;

  const api = trimbleClient.getApi();
  const project = await api.project.get();
  const ctx = {
    projectId: project.id,
    webRegion: mapProjectLocationToWebRegion(project.location || project.region),
  };
  setViewerContext(ctx);
  return ctx;
}

function openWithOptionalRefine(
  immediateUrl: string,
  refine?: () => Promise<string>,
  logContext?: Record<string, unknown>,
): void {
  const tab = openInNewTab(immediateUrl);
  if (!tab && immediateUrl !== 'about:blank') {
    logger.warn('Popup blocked — could not open Trimble Connect tab', logContext);
  }

  if (!refine) {
    logger.info('Opened resource in Trimble Connect', { ...logContext, url: immediateUrl });
    return;
  }

  void (async () => {
    try {
      const refinedUrl = await refine();
      if (refinedUrl && refinedUrl !== immediateUrl) {
        if (tab && !tab.closed) {
          tab.location.href = refinedUrl;
        } else {
          openInNewTab(refinedUrl);
        }
      }
      logger.info('Opened resource in Trimble Connect', { ...logContext, url: refinedUrl || immediateUrl });
    } catch (error) {
      logger.warn('Could not refine Trimble Connect URL, using initial URL', {
        ...logContext,
        error,
      });
      if (!tab && immediateUrl !== 'about:blank') {
        openInNewTab(immediateUrl);
      }
    }
  })();
}

/**
 * Opens a file in the 2D or 3D viewer (new tab). The initial window.open is synchronous.
 */
export async function openProjectFileInViewer(file: ProjectFile): Promise<void> {
  const ctx = resolveViewerContextSync();
  const versionId = file.versionId || file.id;
  const use3D = is3DModelExtension(file.extension);

  if (use3D && ctx) {
    const url = build3DModelViewerUrl(ctx.projectId, file.id, ctx.webRegion);
    openWithOptionalRefine(url, undefined, { fileId: file.id, name: file.name, viewer: '3d' });
    return;
  }

  const immediateUrl = ctx
    ? (use3D
      ? build3DModelViewerUrl(ctx.projectId, file.id, ctx.webRegion)
      : build2DViewerUrl(ctx.projectId, versionId, ctx.webRegion))
    : 'about:blank';

  const api = trimbleClient.getApi();
  openWithOptionalRefine(
    immediateUrl,
    async () => {
      if (use3D) {
        const resolved = await resolveViewerContext();
        return build3DModelViewerUrl(resolved.projectId, file.id, resolved.webRegion);
      }
      if (api.navigation?.get2DViewerUrl) {
        return api.navigation.get2DViewerUrl(file.id);
      }
      const resolved = await resolveViewerContext();
      return build2DViewerUrl(resolved.projectId, versionId, resolved.webRegion);
    },
    { fileId: file.id, name: file.name, viewer: use3D ? '3d' : '2d' },
  );
}

export async function openBcfTopicInViewer(topic: BCFTopic): Promise<void> {
  const ctx = resolveViewerContextSync();
  const immediateUrl = ctx
    ? buildBcfTopicViewerUrl(ctx.projectId, topic.id, ctx.webRegion)
    : 'about:blank';

  openWithOptionalRefine(
    immediateUrl,
    async () => {
      const resolved = await resolveViewerContext();
      return buildBcfTopicViewerUrl(resolved.projectId, topic.id, resolved.webRegion);
    },
    { topicId: topic.id, title: topic.title, viewer: '3d-bcf' },
  );
}

export async function openSavedViewInViewer(view: ProjectView): Promise<void> {
  const ctx = resolveViewerContextSync();
  const immediateUrl = ctx
    ? buildSavedViewUrl(ctx.projectId, view.id, ctx.webRegion)
    : 'about:blank';

  openWithOptionalRefine(
    immediateUrl,
    async () => {
      const resolved = await resolveViewerContext();
      return buildSavedViewUrl(resolved.projectId, view.id, resolved.webRegion);
    },
    { viewId: view.id, name: view.name, viewer: '3d-view' },
  );
}
