/**
 * Open project resources in Trimble Connect web viewers.
 */
import { BCFTopic, ProjectFile, ProjectView } from '../models/types';
export interface ViewerContext {
    projectId: string;
    webRegion: string;
}
export declare function setViewerContext(ctx: ViewerContext): void;
export declare function getViewerContext(): ViewerContext | null;
/**
 * Opens a file in the 2D or 3D viewer (new tab). The initial window.open is synchronous.
 */
export declare function openProjectFileInViewer(file: ProjectFile): Promise<void>;
export declare function openBcfTopicInViewer(topic: BCFTopic): Promise<void>;
export declare function openSavedViewInViewer(view: ProjectView): Promise<void>;
//# sourceMappingURL=fileNavigationService.d.ts.map