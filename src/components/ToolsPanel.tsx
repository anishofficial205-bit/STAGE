import { useEffect, useState } from 'react';
import { templates } from '../templates/registry';
import { useProjectStore } from '../store/useProjectStore';
import { Modal } from './Modal';
import { Collapsible } from './Collapsible';
import { ObjectLibrary } from './objects/ObjectLibrary';
import { GraphicsPanel } from './graphics/GraphicsPanel';
import { VenueLeft } from './venue/VenuePanels';
import { EXAMPLES, loadExampleProject } from '../starters/projects';

/** Complete example projects (one per stage type) that use every mode. */
export function ExampleProjects() {
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
export function MyTemplates() {
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

/** What the left panel's Add tab holds in each mode (Pictures is Set's graphics). */
export function ModeTools({ tab }: { tab: 'add' | 'pictures' }) {
  const mode = useProjectStore((s) => s.mode);
  if (mode === 'set') return tab === 'pictures' ? <GraphicsPanel /> : <ObjectLibrary />;
  if (mode === 'venue') return <VenueLeft />;
  if (mode === 'lights') return <LightsLeft />;
  if (mode === 'blocking') return <BlockingLeft />;
  return null;
}
