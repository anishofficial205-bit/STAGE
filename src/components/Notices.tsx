/**
 * Small notices at the bottom of the stage about how the app is running:
 * - slow: the 3D view has been running slowly for a while (other tabs or apps,
 *   or an older computer), with one-click ways to lighten it;
 * - offline: the connection dropped (work still saves in this browser);
 * - slow-net: a big download (an AI model) is starting on a slow connection.
 * A web page can't see other tabs, so these go by what the app can measure.
 * Each shows at most once per session and can be turned off for good.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { useSeatsView } from '../helpers/seatsView';

export type NoticeId = 'slow' | 'offline' | 'online' | 'slow-net';

const NEVER_KEY = 'stage-builder:notices-off';
const never = (): NoticeId[] => {
  try {
    return JSON.parse(localStorage.getItem(NEVER_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const shown = new Set<NoticeId>();

export const useNotices = create<{ current: NoticeId | null; show: (id: NoticeId, again?: boolean) => void; dismiss: (forGood?: boolean) => void }>((set, get) => ({
  current: null,
  show: (id, again = false) => {
    if (never().includes(id) || (!again && shown.has(id))) return;
    shown.add(id);
    set({ current: id });
  },
  dismiss: (forGood = false) => {
    const id = get().current;
    if (forGood && id) {
      try {
        localStorage.setItem(NEVER_KEY, JSON.stringify([...new Set([...never(), id])]));
      } catch {
        /* not remembered */
      }
    }
    set({ current: null });
  },
}));

type Connection = { effectiveType?: string; downlink?: number };
/** Chrome and Edge say roughly how fast the connection is; other browsers don't. */
export function slowConnection() {
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  if (!c) return false;
  return ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? '') || (c.downlink !== undefined && c.downlink > 0 && c.downlink < 1.5);
}

/** Before a big download: say so if the connection looks slow. */
export function noteBigDownload() {
  if (slowConnection()) useNotices.getState().show('slow-net');
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const SLOW = 'M12 3a9 9 0 1 0 9 9M12 12l4-4M12 3v2';
const OFF = 'M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18';
const ON = 'M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01';

/** The notice itself, plus the online/offline watcher. */
export function Notices() {
  const current = useNotices((s) => s.current);
  const quality = useProjectStore((s) => s.lightQuality);
  const seats = useSeatsView((s) => s.show);
  const { dismiss, show } = useNotices.getState();

  useEffect(() => {
    const off = () => show('offline', true);
    const on = () => {
      if (useNotices.getState().current === 'offline') show('online', true);
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    if (!navigator.onLine) off();
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, [show]);

  // "Back online" clears itself.
  useEffect(() => {
    if (current !== 'online') return;
    const t = window.setTimeout(() => dismiss(), 4000);
    return () => window.clearTimeout(t);
  }, [current, dismiss]);

  if (!current) return null;
  const close = (
    <button className="notice__x" onClick={() => dismiss()} aria-label="Close">
      <Icon d="M6 6l12 12M18 6L6 18" />
    </button>
  );
  const forGood = (
    <button className="notice__link" onClick={() => dismiss(true)}>
      Don’t show again
    </button>
  );

  if (current === 'slow')
    return (
      <div className="notice" role="status">
        <Icon d={SLOW} />
        <span className="notice__text">
          <b>Things are running slowly.</b> Closing other tabs or apps can help, or make the view lighter:
        </span>
        {quality === 'presentation' && (
          <button className="notice__btn" onClick={() => useProjectStore.getState().setLightQuality('draft')}>
            Draft quality
          </button>
        )}
        {seats && (
          <button className="notice__btn" onClick={() => useSeatsView.getState().setShow(false)}>
            Hide seats
          </button>
        )}
        {forGood}
        {close}
      </div>
    );
  if (current === 'offline')
    return (
      <div className="notice" role="status">
        <Icon d={OFF} />
        <span className="notice__text">
          <b>You’re offline.</b> Keep working: everything still saves in this browser.
        </span>
        {close}
      </div>
    );
  if (current === 'online')
    return (
      <div className="notice notice--good" role="status">
        <Icon d={ON} />
        <span className="notice__text">
          <b>Back online.</b>
        </span>
        {close}
      </div>
    );
  return (
    <div className="notice" role="status">
      <Icon d={OFF} />
      <span className="notice__text">
        <b>Your connection looks slow.</b> This tool downloads about 15–30 MB the first time, so it may take a few minutes. After that it’s kept on this computer.
      </span>
      {forGood}
      {close}
    </div>
  );
}
