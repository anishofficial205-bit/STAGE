import * as THREE from 'three';

/** Additive glowing cone for a beam in haze: brightest near the light and along its middle, fading out. */
export function hazeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uStrength: { value: 0.1 }, uLength: { value: 10 } },
    vertexShader: `
      uniform float uLength;
      varying float vT;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vT = clamp(position.z / uLength, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vT;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        // Faces seen edge-on are the beam's outline: fade them, keep the core.
        float core = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.1);
        float along = (1.0 - vT) * (1.0 - vT) * 0.85 + 0.15;
        float a = uStrength * core * along * smoothstep(0.0, 0.04, vT);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Cone with its tip at the origin opening along +Z. */
export function beamCone(length: number, radius: number, segments = 40) {
  const g = new THREE.ConeGeometry(Math.max(0.01, radius), length, segments, 1, true);
  g.translate(0, -length / 2, 0);
  g.rotateX(-Math.PI / 2);
  return g;
}

let pool: THREE.Texture | null = null;
/** Soft round pool of light (for lights beyond the real-light budget). */
export function poolTexture() {
  if (pool) return pool;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  pool = new THREE.CanvasTexture(c);
  return pool;
}
