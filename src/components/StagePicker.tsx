import { useState } from 'react';
import { getTemplate, templates } from '../templates/registry';
import { useProjectStore } from '../store/useProjectStore';
import type { StageTemplate } from '../types';
import { useThumbnails } from './Thumbnails';
import { Modal } from './Modal';

const DIM_NAMES = { width: 'width', depth: 'depth', height: 'height' } as const;

/** Which of stage width/depth/height both templates understand. */
function sharedDimensions(a: StageTemplate, b: StageTemplate) {
  return (Object.keys(DIM_NAMES) as (keyof typeof DIM_NAMES)[]).filter((d) => a.dimensions?.[d] && b.dimensions?.[d]);
}

function SwitchDialog({ to, onClose }: { to: StageTemplate; onClose: () => void }) {
  const from = getTemplate(useProjectStore.getState().templateId)!;
  const switchTemplate = useProjectStore((s) => s.switchTemplate);
  const shared = sharedDimensions(from, to);
  const go = (mode: 'fresh' | 'similar') => {
    switchTemplate(to.id, mode);
    onClose();
  };
  return (
    <Modal title={`Switch to ${to.name}?`} onClose={onClose}>
      <p className="modal__text">
        {shared.length > 0
          ? `Start fresh with ${to.name}’s default sizes, or keep similar dimensions — the stage ${shared.join(', ')} — from your ${from.name}?`
          : `Start fresh with ${to.name}’s default sizes, or keep the settings it had last time? (${from.name} and ${to.name} don’t share stage dimensions.)`}
      </p>
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" onClick={() => go('fresh')}>
          Start fresh
        </button>
        <button className="btn btn--primary" onClick={() => go('similar')} autoFocus>
          {shared.length > 0 ? 'Keep similar dimensions' : 'Keep last settings'}
        </button>
      </div>
    </Modal>
  );
}

export function StagePicker() {
  const templateId = useProjectStore((s) => s.templateId);
  const images = useThumbnails((s) => s.images);
  const [pending, setPending] = useState<StageTemplate | null>(null);
  return (
    <aside className="sidebar sidebar--left" data-tour="picker">
      <h2 className="panel-title">Stage type</h2>
      <ul className="picker">
        {templates.map((t) => (
          <li key={t.id}>
            <button
              className={`card ${t.id === templateId ? 'is-active' : ''}`}
              onClick={() => t.id !== templateId && setPending(t)}
              aria-pressed={t.id === templateId}
            >
              <span className="card__thumb">{images[t.id] ? <img src={images[t.id]} alt="" /> : <span className="card__loading" />}</span>
              <span className="card__name">{t.name}</span>
              <span className="card__desc">{t.description}</span>
            </button>
          </li>
        ))}
      </ul>
      {pending && <SwitchDialog to={pending} onClose={() => setPending(null)} />}
    </aside>
  );
}
