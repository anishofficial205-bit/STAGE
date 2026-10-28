/**
 * Artwork for the showcase templates (screen content, wallpaper, backdrops),
 * drawn on a canvas when the template is opened. All of it is original.
 */
export type Art = { name: string; width: number; height: number; draw: (x: CanvasRenderingContext2D, w: number, h: number) => void };

/** Same picture every time: a small seeded random generator. */
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ART = {
  clock: {
    name: 'Clock face',
    width: 1920,
    height: 1080,
    draw: (x, w, h) => {
      x.fillStyle = '#06040c';
      x.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = 470;
      const g = x.createRadialGradient(cx, cy, 40, cx, cy, R);
      g.addColorStop(0, '#2a1c4a');
      g.addColorStop(1, '#0c0820');
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, R, 0, 7);
      x.fill();
      [['#f5c96a', 22, 0], ['#b8862e', 6, 34], ['#ffe7a8', 4, 48], ['#d9a441', 10, 140]].forEach(([c, lw, inset]) => {
        x.strokeStyle = c as string;
        x.lineWidth = lw as number;
        x.beginPath();
        x.arc(cx, cy, R - (inset as number), 0, 7);
        x.stroke();
      });
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30;
        const r1 = R - 60, r2 = R - (i % 5 ? 78 : 110);
        x.strokeStyle = '#ffe7a8';
        x.lineWidth = i % 5 ? 3 : 9;
        x.beginPath();
        x.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        x.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        x.stroke();
      }
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      x.fillStyle = '#ffe7a8';
      x.font = '600 64px Georgia, serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      numerals.forEach((t, i) => {
        const a = (i * Math.PI) / 6 - Math.PI / 2;
        x.fillText(t, cx + Math.cos(a) * (R - 175), cy + Math.sin(a) * (R - 175));
      });
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        x.fillStyle = i % 2 ? '#ff5fa8' : '#7ad7ff';
        x.beginPath();
        x.arc(cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18), 14, 0, 7);
        x.fill();
      }
      x.lineCap = 'round';
      x.strokeStyle = '#fff3cf';
      x.lineWidth = 18;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + 120, cy - 190);
      x.stroke();
      x.lineWidth = 10;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx - 250, cy + 60);
      x.stroke();
      x.fillStyle = '#f5c96a';
      x.beginPath();
      x.arc(cx, cy, 26, 0, 7);
      x.fill();
      for (const sx of [-1, 1]) {
        x.strokeStyle = '#b8862e';
        x.lineWidth = 6;
        for (let j = 0; j < 5; j++) {
          x.beginPath();
          x.arc(cx + sx * (R + 170), cy, 40 + j * 28, sx > 0 ? Math.PI * 0.6 : -Math.PI * 0.4, sx > 0 ? Math.PI * 1.4 : Math.PI * 0.4);
          x.stroke();
        }
      }
    },
  },
  halo: {
    name: 'Halo visual',
    width: 2048,
    height: 400,
    draw: (x, w, h) => {
      const r = rng(3);
      const g = x.createLinearGradient(0, 0, w, 0);
      ['#ff3d9a', '#7a3dff', '#2ad4ff', '#ffb13d', '#ff3d9a'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 40; i++) {
        x.beginPath();
        x.arc(r() * w, r() * h, 2 + r() * 6, 0, 7);
        x.fill();
      }
      x.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 4, h);
    },
  },
  header: {
    name: 'Header visual',
    width: 3000,
    height: 300,
    draw: (x, w, h) => {
      x.fillStyle = '#120400';
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 6) {
        const v = Math.sin(i / 90) * 0.5 + 0.5;
        x.fillStyle = `hsl(${8 + v * 30},100%,${30 + v * 30}%)`;
        x.fillRect(i, 0, 5, h);
      }
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = 'rgba(255,244,230,0.95)';
      x.font = '700 170px Impact, "Arial Black", sans-serif';
      x.fillText('VOLTAGE', w / 2, h / 2 + 6);
      x.font = '700 110px Impact, "Arial Black", sans-serif';
      x.fillStyle = 'rgba(30,6,0,0.7)';
      for (const cx of [w * 0.15, w * 0.85]) x.fillText('WORLD TOUR', cx, h / 2 + 4);
    },
  },
  feed: {
    name: 'Camera feed',
    width: 1920,
    height: 1080,
    draw: (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h * 0.45, 50, w / 2, h / 2, w * 0.6);
      g.addColorStop(0, '#ff9a3d');
      g.addColorStop(0.5, '#a0300c');
      g.addColorStop(1, '#1a0602');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#120402';
      x.beginPath();
      x.ellipse(w / 2, h * 0.36, 120, 150, 0, 0, 7);
      x.fill();
      x.beginPath();
      x.moveTo(w / 2 - 380, h);
      x.quadraticCurveTo(w / 2 - 300, h * 0.55, w / 2, h * 0.55);
      x.quadraticCurveTo(w / 2 + 300, h * 0.55, w / 2 + 380, h);
      x.fill();
      x.fillRect(w / 2 + 160, h * 0.25, 22, 420);
      x.beginPath();
      x.ellipse(w / 2 + 171, h * 0.25, 36, 50, 0, 0, 7);
      x.fill();
      x.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < h; y += 6) x.fillRect(0, y, w, 2);
    },
  },
  velvet: {
    name: 'Red velvet and gold',
    width: 1600,
    height: 1600,
    draw: (x, w, h) => {
      for (let i = 0; i < w; i += 40) {
        const g = x.createLinearGradient(i, 0, i + 40, 0);
        g.addColorStop(0, '#4a040e');
        g.addColorStop(0.5, '#8e1424');
        g.addColorStop(1, '#4a040e');
        x.fillStyle = g;
        x.fillRect(i, 0, 40, h);
      }
      x.strokeStyle = '#d9a441';
      x.lineWidth = 6;
      for (let y = 80; y < h; y += 160)
        for (let xx = 80; xx < w; xx += 160) {
          x.beginPath();
          x.moveTo(xx, y - 40);
          x.quadraticCurveTo(xx + 40, y, xx, y + 40);
          x.quadraticCurveTo(xx - 40, y, xx, y - 40);
          x.stroke();
        }
    },
  },
  sunburst: {
    name: 'Art deco sunburst',
    width: 2400,
    height: 1400,
    draw: (x, w, h) => {
      const r = rng(5);
      x.fillStyle = '#1a0306';
      x.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h * 1.02;
      for (let i = 0; i < 48; i++) {
        const a0 = Math.PI + (i * Math.PI) / 48;
        x.fillStyle = i % 2 ? '#7a0a1e' : '#3a0410';
        x.beginPath();
        x.moveTo(cx, cy);
        x.arc(cx, cy, h * 1.6, a0, a0 + Math.PI / 96);
        x.fill();
      }
      x.strokeStyle = 'rgba(217,164,65,0.55)';
      x.lineWidth = 5;
      for (let rr = 200; rr < h; rr += 110) {
        x.beginPath();
        x.arc(cx, cy, rr, Math.PI, 2 * Math.PI);
        x.stroke();
      }
      x.fillStyle = 'rgba(255,215,140,0.9)';
      for (let i = 0; i < 160; i++) {
        x.beginPath();
        x.arc(r() * w, r() * h * 0.8, 2 + r() * 3, 0, 7);
        x.fill();
      }
    },
  },
  sea: {
    name: 'Under the sea',
    width: 2400,
    height: 1300,
    draw: (x, w, h) => {
      const r = rng(9);
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2fd2ff');
      g.addColorStop(0.55, '#1477e0');
      g.addColorStop(1, '#0a3a9e');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 9; i++) {
        x.beginPath();
        x.moveTo(200 + i * 260, 0);
        x.lineTo(320 + i * 260, 0);
        x.lineTo(380 + i * 260, h);
        x.lineTo(300 + i * 260, h);
        x.fill();
      }
      x.strokeStyle = 'rgba(220,250,255,0.75)';
      x.lineWidth = 4;
      for (let i = 0; i < 70; i++) {
        x.beginPath();
        x.arc(r() * w, r() * h * 0.9, 8 + r() * 40, 0, 7);
        x.stroke();
      }
      const fish = ['#ff5fa8', '#ffd23f', '#3dffb0', '#ff8a3d'];
      for (let i = 0; i < 14; i++) {
        const fx = r() * w, fy = h * 0.5 + r() * h * 0.45, s = 30 + r() * 50;
        x.fillStyle = fish[i % 4];
        x.beginPath();
        x.ellipse(fx, fy, s, s * 0.55, 0, 0, 7);
        x.fill();
        x.beginPath();
        x.moveTo(fx - s * 0.8, fy);
        x.lineTo(fx - s * 1.5, fy - s * 0.5);
        x.lineTo(fx - s * 1.5, fy + s * 0.5);
        x.fill();
      }
      x.lineWidth = 14;
      for (let i = 0; i < 30; i++) {
        x.strokeStyle = ['#2bd46a', '#ff6fb5', '#ffb13d'][i % 3];
        const bx = (i * w) / 30;
        x.beginPath();
        x.moveTo(bx, h);
        x.bezierCurveTo(bx + 40, h - 150, bx - 40, h - 260, bx + 20, h - 320 - r() * 150);
        x.stroke();
      }
    },
  },
  stripes: {
    name: 'Candy stripes',
    width: 1200,
    height: 1200,
    draw: (x, w, h) => {
      const r = rng(4);
      const cols = ['#ff3d9a', '#ffd23f', '#3dc1ff', '#3dffb0'];
      for (let i = -h, k = 0; i < w; i += 80, k++) {
        x.fillStyle = cols[k % 4];
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i + 80, 0);
        x.lineTo(i + 80 + h, h);
        x.lineTo(i + h, h);
        x.fill();
      }
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 60; i++) {
        x.beginPath();
        x.arc(r() * w, r() * h, 6 + r() * 16, 0, 7);
        x.fill();
      }
    },
  },
  damask: {
    name: 'Green damask',
    width: 1024,
    height: 1024,
    draw: (x, w, h) => {
      x.fillStyle = '#24402f';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(214,186,120,0.55)';
      x.lineWidth = 5;
      for (let yy = 0; yy <= h; yy += 256)
        for (let xx = (yy / 256) % 2 ? 128 : 0; xx <= w; xx += 256) {
          x.beginPath();
          x.moveTo(xx, yy - 100);
          x.bezierCurveTo(xx + 70, yy - 60, xx + 70, yy + 60, xx, yy + 100);
          x.bezierCurveTo(xx - 70, yy + 60, xx - 70, yy - 60, xx, yy - 100);
          x.stroke();
          x.beginPath();
          x.arc(xx, yy, 22, 0, 7);
          x.stroke();
        }
      x.fillStyle = '#3a2a1a';
      x.fillRect(0, h - 120, w, 120);
      x.fillStyle = '#c8a050';
      x.fillRect(0, h - 128, w, 8);
    },
  },
  rug: {
    name: 'Persian rug',
    width: 1600,
    height: 1000,
    draw: (x, w, h) => {
      const r = rng(8);
      x.fillStyle = '#7a1a1e';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#d9b26a';
      x.lineWidth = 24;
      x.strokeRect(40, 40, w - 80, h - 80);
      x.strokeStyle = '#1e2a4a';
      x.lineWidth = 40;
      x.strokeRect(100, 100, w - 200, h - 200);
      x.fillStyle = '#1e2a4a';
      x.beginPath();
      x.ellipse(w / 2, h / 2, 300, 200, 0, 0, 7);
      x.fill();
      x.strokeStyle = '#d9b26a';
      x.lineWidth = 10;
      for (let rr = 60; rr < 200; rr += 40) {
        x.beginPath();
        x.ellipse(w / 2, h / 2, rr * 1.5, rr, 0, 0, 7);
        x.stroke();
      }
      for (let i = 0; i < 40; i++) {
        x.fillStyle = ['#d9b26a', '#e8d9b0', '#3a6a5a'][i % 3];
        x.beginPath();
        x.arc(160 + r() * (w - 320), 160 + r() * (h - 320), 10, 0, 7);
        x.fill();
      }
    },
  },
  landscape: {
    name: 'Landscape painting',
    width: 800,
    height: 1000,
    draw: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#e8c98a');
      g.addColorStop(0.5, '#9a6a3a');
      g.addColorStop(1, '#3a2a1a');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#2a3a2a';
      x.beginPath();
      x.moveTo(0, h * 0.7);
      x.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.62);
      x.quadraticCurveTo(w * 0.8, h * 0.7, w, h * 0.55);
      x.lineTo(w, h);
      x.lineTo(0, h);
      x.fill();
      x.fillStyle = '#fff1c8';
      x.beginPath();
      x.arc(w * 0.7, h * 0.25, 60, 0, 7);
      x.fill();
    },
  },
  garden: {
    name: 'Garden at night',
    width: 2000,
    height: 1000,
    draw: (x, w, h) => {
      const r = rng(6);
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a1430');
      g.addColorStop(1, '#26406a');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8f0ff';
      x.beginPath();
      x.arc(w * 0.3, h * 0.25, 50, 0, 7);
      x.fill();
      x.fillStyle = '#0a1a14';
      for (let i = 0; i < w; i += 60) {
        x.beginPath();
        x.arc(i, h * 0.75, 80 + r() * 60, 0, 7);
        x.fill();
      }
      x.fillRect(0, h * 0.8, w, h * 0.2);
    },
  },
  sky: {
    name: 'Blue sky',
    width: 2400,
    height: 1200,
    draw: (x, w, h) => {
      const r = rng(2);
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a7be8');
      g.addColorStop(1, '#9fd6ff');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 9; i++) {
        const cx = r() * w, cy = 100 + r() * h * 0.5;
        for (let k = 0; k < 6; k++) {
          x.beginPath();
          x.ellipse(cx + k * 40 - 100, cy + Math.sin(k) * 20, 90, 50, 0, 0, 7);
          x.fill();
        }
      }
    },
  },
  keynote: {
    name: 'Keynote slide',
    width: 1920,
    height: 1080,
    draw: (x, w, h) => {
      const g = x.createRadialGradient(w * 0.7, h * 0.45, 40, w * 0.6, h * 0.5, w * 0.8);
      g.addColorStop(0, '#ff4a3a');
      g.addColorStop(0.35, '#a0101e');
      g.addColorStop(1, '#12020a');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,200,180,0.25)';
      x.lineWidth = 3;
      for (let i = 0; i < 18; i++) {
        x.beginPath();
        x.ellipse(w * 0.72, h * 0.48, 120 + i * 48, 60 + i * 22, -0.4, 0, 7);
        x.stroke();
      }
      x.fillStyle = '#ffffff';
      x.font = '700 150px Helvetica, Arial, sans-serif';
      x.fillText('Lumen 2', 140, 500);
      x.font = '400 54px Helvetica, Arial, sans-serif';
      x.fillStyle = '#ffd0c8';
      x.fillText('Faster. Lighter. Brighter.', 146, 590);
    },
  },
  keynoteSide: {
    name: 'Keynote side screen',
    width: 1080,
    height: 1620,
    draw: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a0206');
      g.addColorStop(1, '#8a0c18');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.textAlign = 'center';
      x.fillStyle = '#ffffff';
      x.font = '700 110px Helvetica, Arial, sans-serif';
      x.fillText('LUMEN', w / 2, h * 0.42);
      x.font = '400 60px Helvetica, Arial, sans-serif';
      x.fillStyle = '#ff9a8a';
      x.fillText('Live keynote', w / 2, h * 0.5);
      x.fillStyle = '#ff3a3a';
      x.fillRect(w / 2 - 120, h * 0.55, 240, 10);
    },
  },
  banner: {
    name: 'Red banner',
    width: 600,
    height: 1800,
    draw: (x, w, h) => {
      x.fillStyle = '#c8102e';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.arc(w / 2, h * 0.18, 90, 0, 7);
      x.fill();
      x.fillStyle = '#c8102e';
      x.beginPath();
      x.arc(w / 2, h * 0.18, 50, 0, 7);
      x.fill();
      x.save();
      x.translate(w / 2, h * 0.6);
      x.rotate(-Math.PI / 2);
      x.fillStyle = '#ffffff';
      x.font = '700 120px Helvetica, Arial, sans-serif';
      x.textAlign = 'center';
      x.fillText('LUMEN', 0, 40);
      x.restore();
    },
  },
} satisfies Record<string, Art>;

export type ArtKey = keyof typeof ART;

/** Draw one piece of artwork into a PNG file. */
export async function renderArt(a: Art): Promise<File> {
  const c = document.createElement('canvas');
  c.width = a.width;
  c.height = a.height;
  a.draw(c.getContext('2d')!, a.width, a.height);
  const blob = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('No picture'))), 'image/png'));
  return new File([blob], `${a.name}.png`, { type: 'image/png' });
}
