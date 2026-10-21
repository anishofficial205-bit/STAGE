import { useEffect, useMemo } from 'react';
import { fitBackgroundPatch, placedTexture } from './placement';
import { useGraphicTexture } from './library';
import type { GraphicPlacement } from './types';

/**
 * Material props for a graphic on a face of size `size` (metres): the placed
 * texture, opacity, and the Fit-mode background patch. Empty while the image loads.
 */
export function usePlacedGraphic(graphic: GraphicPlacement | undefined, size: { w: number; h: number }) {
  const base = useGraphicTexture(graphic?.id);
  const key = graphic ? JSON.stringify([graphic, size.w.toFixed(3), size.h.toFixed(3)]) : '';
  const map = useMemo(() => (base && graphic ? placedTexture(base, graphic, size) : null), [base, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => map?.dispose(), [map]);
  const patch = useMemo(() => (graphic?.fit === 'fit' ? fitBackgroundPatch(graphic.background) : null), [graphic?.fit, graphic?.background]);
  if (!graphic || !map) return null;
  const opacity = graphic.opacity;
  return {
    map,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    ...(patch ?? {}),
  };
}
