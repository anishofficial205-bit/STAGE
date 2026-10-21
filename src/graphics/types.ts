/** How a graphic sits on a face. */
export type FitMode = 'fit' | 'fill' | 'stretch' | 'tile';

export interface GraphicPlacement {
  /** Graphic library id. */
  id: string;
  fit: FitMode;
  /** Tile mode: real-world width of one tile (m). */
  tileSize: number;
  /** Pan, as a fraction of the face (−0.5…0.5). Used by Fill and Tile. */
  offsetX: number;
  offsetY: number;
  /** Extra zoom (Fill), 1 = just covering the face. */
  scale: number;
  /** Quarter turns clockwise (0–3). */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  opacity: number;
  /** Colour of the empty area in Fit mode. */
  background: string;
}

/** A graphic in the project's library. The image itself lives in IndexedDB under `id`. */
export interface GraphicMeta {
  id: string;
  name: string;
  /** Pixel size of the stored image. */
  width: number;
  height: number;
  mime: string;
  bytes: number;
  /** SVG or PDF artwork: scales without losing quality. */
  vector?: boolean;
  /** For PDFs: which page was imported. */
  page?: number;
}

export const defaultPlacement = (id: string): GraphicPlacement => ({
  id,
  fit: 'fill',
  tileSize: 0.5,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  opacity: 1,
  background: '#ffffff',
});
