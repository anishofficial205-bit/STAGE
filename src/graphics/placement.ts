/**
 * Turning a graphic placement into texture coordinates.
 *
 * Every face's UVs run 0–1 across its width and height. A placement is a
 * single affine map from face UV to image UV, built in three steps:
 *   1. place  — Fit / Fill / Stretch / Tile, plus pan and zoom, in "displayed
 *               image" space (the image as it appears after rotation/flips);
 *   2. flip   — mirror horizontally/vertically;
 *   3. unrotate — undo the quarter turns to reach the original image.
 * The map is set as the texture's matrix, so one image upload serves every
 * face that uses it.
 */
import * as THREE from 'three';
import type { GraphicPlacement } from './types';

/** Affine map (u, v) → (a·u + b·v + c, d·u + e·v + f). */
type Affine = [number, number, number, number, number, number];
const compose = (outer: Affine, inner: Affine): Affine => {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [a1 * a2 + b1 * d2, a1 * b2 + b1 * e2, a1 * c2 + b1 * f2 + c1, d1 * a2 + e1 * d2, d1 * b2 + e1 * e2, d1 * c2 + e1 * f2 + f1];
};

/** Face UV → displayed-image UV for the placement. */
function placeMap(p: GraphicPlacement, face: { w: number; h: number }, displayAspect: number): Affine {
  const fa = face.w / Math.max(face.h, 1e-6);
  const da = displayAspect;
  switch (p.fit) {
    case 'stretch':
      return [1, 0, 0, 0, 1, 0];
    case 'fit': {
      // Whole image visible and centred; the rest is background.
      if (da > fa) {
        const hf = fa / da;
        return [1, 0, 0, 0, 1 / hf, -(1 - hf) / 2 / hf];
      }
      const wf = da / fa;
      return [1 / wf, 0, -(1 - wf) / 2 / wf, 0, 1, 0];
    }
    case 'fill': {
      // Covers the face; the visible window is a fraction of the image, panned within it.
      let rx = da > fa ? fa / da : 1;
      let ry = da > fa ? 1 : da / fa;
      const zoom = Math.max(1, p.scale);
      rx /= zoom;
      ry /= zoom;
      const cx = 0.5 - p.offsetX * (1 - rx);
      const cy = 0.5 - p.offsetY * (1 - ry);
      return [rx, 0, cx - rx / 2, 0, ry, cy - ry / 2];
    }
    case 'tile': {
      // Tiles of a real-world width; height follows the image's proportions.
      const tw = Math.max(0.01, p.tileSize);
      const th = tw / da;
      return [face.w / tw, 0, -p.offsetX, 0, face.h / th, -p.offsetY];
    }
  }
}

/** The full face-UV → image-UV map. `imageAspect` is width / height of the stored image. */
export function placementAffine(p: GraphicPlacement, face: { w: number; h: number }, imageAspect: number): Affine {
  const turns = ((Math.round(p.rotation) % 4) + 4) % 4;
  const displayAspect = turns % 2 ? 1 / imageAspect : imageAspect;
  let m = placeMap(p, face, displayAspect);
  if (p.flipH) m = compose([-1, 0, 1, 0, 1, 0], m);
  if (p.flipV) m = compose([1, 0, 0, 0, -1, 1], m);
  // Displayed = original turned clockwise; to go back, turn anticlockwise: (x, y) → (1 - y, x).
  for (let i = 0; i < turns; i++) m = compose([0, -1, 1, 1, 0, 0], m);
  return m;
}

/** A texture showing `base` placed on a face (shares the image with `base`). */
export function placedTexture(base: THREE.Texture, p: GraphicPlacement, face: { w: number; h: number }): THREE.Texture {
  const img = base.image as { width: number; height: number };
  const t = base.clone();
  const [a, b, c, d, e, f] = placementAffine(p, face, img.width / Math.max(1, img.height));
  t.matrixAutoUpdate = false;
  t.matrix.set(a, b, c, d, e, f, 0, 0, 1);
  t.wrapS = t.wrapT = p.fit === 'tile' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/**
 * Fit mode: outside the image, show the background colour instead of
 * stretched edge pixels. Patches MeshStandardMaterial's map sampling.
 */
export function fitBackgroundPatch(background: string) {
  const colour = new THREE.Color(background);
  return {
    onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uFitBg = { value: colour };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uFitBg;')
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vMapUv );
            if ( vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0 ) sampledDiffuseColor = vec4( uFitBg, 1.0 );
            diffuseColor *= sampledDiffuseColor;
          #endif`,
        );
    },
    // One program for all Fit materials; the colour is a per-material uniform.
    customProgramCacheKey: () => 'fit-bg',
  };
}

/** Fill mode: the visible fraction of the displayed image (width, height). Used to turn drags into pan. */
export function fillWindow(p: GraphicPlacement, face: { w: number; h: number }, imageAspect: number): [number, number] {
  const turns = ((Math.round(p.rotation) % 4) + 4) % 4;
  const da = turns % 2 ? 1 / imageAspect : imageAspect;
  const fa = face.w / Math.max(face.h, 1e-6);
  const zoom = Math.max(1, p.scale);
  return [(da > fa ? fa / da : 1) / zoom, (da > fa ? 1 : da / fa) / zoom];
}
