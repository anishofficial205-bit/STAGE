import { useEffect, useState } from 'react';
import { getTemplate, templates } from '../templates/registry';
import { useProjectStore } from '../store/useProjectStore';
import type { StageTemplate } from '../types';
import { useThumbnails } from './Thumbnails';
import { Modal } from './Modal';
import { Collapsible } from './Collapsible';
import { ObjectLibrary } from './objects/ObjectLibrary';
import { GraphicsPanel } from './graphics/GraphicsPanel';
import { VenueLeft } from './venue/VenuePanels';
import { EXAMPLES, loadExampleProject } from '../starters/projects';

/** Complete example projects (one per stage type) that use every mode. */
function ExampleProjects() {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Collapsible id="examples" title="Example projects" defaultOpen={false}>
      <p className="hint">Complete projects with a venue, set, curtains, lights and blocking — a good way to see every mode.</p>
      <ul className="venue-list">
        {templates.map((t) => (
          <li key={t.id}>
            <button className="btn btn--ghost" onClick={() => setConfirm(t.id)}>
              {EXAMPLES[t.id]?.title} <span className="hint">{t.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {confirm && (
        <Modal title={`Open “${EXAMPLES[confirm]?.title}”?`} onClose={() => setConfirm(null)}>
          <p className="modal__text">This replaces the current project with the example. You can undo it.</p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              autoFocus
              onClick={() => {
                loadExampleProject(confirm);
                setConfirm(null);
              }}
            >
              Open example
            </button>
          </div>
        </Modal>
      )}
    </Collapsible>
  );
}
import { LightsLeft } from './lights/LightsPanels';
import { BlockingLeft } from './blocking/BlockingPanels';
import { deleteMyTemplate, refreshMyTemplates, useMyTemplates, applySavedTemplate, type SavedTemplate } from '../templates/custom/myTemplates';

/** Custom stages saved from Build Your Own, usable in any project. */
function MyTemplates() {
  const list = useMyTemplates((s) => s.list);
  const [confirm, setConfirm] = useState<SavedTemplate | null>(null);
  useEffect(() => {
    void refreshMyTemplates();
  }, []);
  return (
    <Collapsible id="my-templates" title={`My templates${list.length ? ` (${list.length})` : ''}`}>
      {list.length === 0 ? (
        <p className="hint">Draw a stage in Build Your Own, then use “Save as my template” to keep it here for other projects.</p>
      ) : (
        <ul className="picker">
          {list.map((t) => (
            <li key={t.id} className="my-template">
              <button className="card" onClick={() => setConfirm(t)} title={`Use “${t.name}” in this project`}>
                <span className="card__thumb">{t.thumbnail ? <img src={t.thumbnail} alt="" /> : <span className="card__loading" />}</span>
                <span className="card__name">{t.name}</span>
                <span className="card__desc">Saved {new Date(t.savedAt).toLocaleDateString()}</span>
              </button>
              <button className="my-template__x" onClick={() => void deleteMyTemplate(t.id)} title="Delete this saved template" aria-label={`Delete ${t.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <Modal title={`Use “${confirm.name}”?`} onClose={() => setConfirm(null)}>
          <p className="modal__text">This switches to Build Your Own and replaces its shapes and seating with the saved ones. You can undo it.</p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              autoFocus
              onClick={() => {
                applySavedTemplate(confirm);
                setConfirm(null);
              }}
            >
              Use it
            </button>
          </div>
        </Modal>
      )}
    </Collapsible>
  );
}

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
  const mode = useProjectStore((s) => s.mode);
  if (mode === 'set')
    return (
      <aside className="sidebar sidebar--left">
        <Collapsible id="library" title="Add objects">
          <ObjectLibrary />
        </Collapsible>
        <Collapsible id="graphics" title="Graphics">
          <GraphicsPanel />
        </Collapsible>
      </aside>
    );
  if (mode === 'venue')
    return (
      <aside className="sidebar sidebar--left">
        <VenueLeft />
      </aside>
    );
  if (mode === 'lights')
    return (
      <aside className="sidebar sidebar--left">
        <LightsLeft />
      </aside>
    );
  if (mode === 'blocking')
    return (
      <aside className="sidebar sidebar--left">
        <BlockingLeft />
      </aside>
    );
  if (mode !== 'stage') return <aside className="sidebar sidebar--left" />;
  return (
    <aside className="sidebar sidebar--left">
      <div data-tour="picker">
      <Collapsible id="picker" title="Stage type">
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
      </Collapsible>
      </div>
      <MyTemplates />
      <ExampleProjects />
      {pending && <SwitchDialog to={pending} onClose={() => setPending(null)} />}
    </aside>
  );
}
