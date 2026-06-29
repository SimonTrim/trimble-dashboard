/**
 * Open project files in the Trimble Connect 2D viewer.
 */
import { ProjectFile } from '../models/types';
export interface ViewerContext {
    projectId: string;
    webRegion: string;
}
export declare function setViewerContext(ctx: ViewerContext): void;
export declare function getViewerContext(): ViewerContext | null;
/**
 * Opens the 2D viewer in a new tab. The initial window.open call is synchronous
 * so it stays within the browser's user-gesture window (avoids popup blockers).
 */
export declare function openProjectFileInViewer(file: ProjectFile): Promise<void>;
//# sourceMappingURL=fileNavigationService.d.ts.map