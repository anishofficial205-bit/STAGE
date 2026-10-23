import { useEffect } from 'react';

const PAD = 3;

/**
 * Keeps 3D labels from overlapping: every few frames, labels are laid out in
 * order of importance (data-lp) and any that would cover a more important one
 * are hidden. Hovering an object raises its label, so hidden ones show on hover.
 */
export function LabelDeclutter() {
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 120) return;
      last = t;
      const els = [...document.querySelectorAll<HTMLElement>('.viewport [data-lp]')];
      const items = els
        .map((el, i) => ({ el, i, p: Number(el.dataset.lp) || 0, r: el.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0)
        .sort((a, b) => b.p - a.p || a.i - b.i);
      const kept: DOMRect[] = [];
      for (const { el, r } of items) {
        const hit = kept.some((k) => r.left < k.right + PAD && r.right > k.left - PAD && r.top < k.bottom + PAD && r.bottom > k.top - PAD);
        el.style.visibility = hit ? 'hidden' : '';
        if (!hit) kept.push(r);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}
