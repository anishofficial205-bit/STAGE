/**
 * Curtain open/close animation. While playing, the live "open" value lives
 * here (not in the project) so the history isn't flooded with frames; the
 * final value is written once at the end, as one undo step.
 */
import { create } from 'zustand';
import { setParams } from '../actions';
import { useProjectStore } from '../../store/useProjectStore';

export const useCurtainAnim = create<{ live: Record<string, number> }>(() => ({ live: {} }));

const running = new Map<string, number>();

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function stopCurtain(id: string) {
  const raf = running.get(id);
  if (raf !== undefined) cancelAnimationFrame(raf);
  running.delete(id);
  useCurtainAnim.setState((s) => {
    const { [id]: _gone, ...live } = s.live; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { live };
  });
}

/** Animate a curtain's `open` param (0–100) to `to` over `seconds`. */
export function playCurtain(id: string, to: number, seconds: number) {
  const s = useProjectStore.getState();
  const obj = (s.objectsByTemplate[s.templateId] ?? []).find((o) => o.id === id);
  if (!obj) return;
  const from = useCurtainAnim.getState().live[id] ?? Number(obj.params.open ?? 0);
  stopCurtain(id);
  const start = performance.now();
  const ms = Math.max(0.1, seconds) * 1000 * (Math.abs(to - from) / 100 || 1);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const v = from + (to - from) * ease(t);
    useCurtainAnim.setState((st) => ({ live: { ...st.live, [id]: v } }));
    if (t < 1) running.set(id, requestAnimationFrame(step));
    else {
      setParams(id, { open: to });
      stopCurtain(id);
    }
  };
  running.set(id, requestAnimationFrame(step));
}
