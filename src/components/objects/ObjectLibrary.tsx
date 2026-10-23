import { useMemo, useState } from 'react';
import { objectCategories, objectTypes } from '../../objects/registry';
import { addObjectAt } from '../../objects/actions';
import { OBJECT_DRAG_TYPE } from '../../objects/ui';
import { CurtainTools } from '../../objects/curtains/Tools';
import { CURTAINS } from '../../objects/curtains/mainCurtain';
import { Plain } from '../../glossary/Plain';
import { lookup } from '../../glossary/terms';
import { mostUsed, usePlacing, useUsage } from '../../objects/placing';
import { Collapsible } from '../Collapsible';
import { Modal } from '../Modal';
import { useProjectStore } from '../../store/useProjectStore';
import { STARTER_SETS } from '../../starters';
import type { SetObjectType } from '../../objects/types';

const CATEGORY_TOOLS: Record<string, () => JSX.Element> = { [CURTAINS]: CurtainTools };

/** Quick actions for a category (e.g. curtains), rendered as a component so its own state is kept. */
function CategoryTools({ cat }: { cat: string }) {
  const Tools = CATEGORY_TOOLS[cat];
  return Tools ? <Tools /> : null;
}

/** Every word a piece can be found by: its name, the plain and technical terms, its category. */
function searchText(t: SetObjectType) {
  const term = lookup(t.name);
  return [t.name, t.id.replace(/-/g, ' '), t.category, term?.plain, term?.tech].filter(Boolean).join(' ').toLowerCase();
}

function Tile({ t }: { t: SetObjectType }) {
  const placing = usePlacing((s) => s.typeId === t.id);
  return (
    <button
      className={`tile ${placing ? 'is-active' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(OBJECT_DRAG_TYPE, t.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => {
        // Pieces with a usual spot (e.g. a main curtain behind the arch) go straight there.
        if (t.autoPlace) return addObjectAt(t.id);
        const p = usePlacing.getState();
        if (p.typeId === t.id) p.cancel();
        else p.start(t.id);
      }}
      title={`${t.name} — click, then click on the stage to place it (or drag it into the view)`}
    >
      <span className="tile__icon">{t.icon}</span>
      <span className="tile__name">
        <Plain text={t.name} stacked />
      </span>
    </button>
  );
}

/** "Start from a ready-made set": a gallery of starter sets for this stage. */
function ReadyMadeSets() {
  const templateId = useProjectStore((s) => s.templateId);
  const count = useProjectStore((s) => (s.objectsByTemplate[s.templateId] ?? []).length);
  const [open, setOpen] = useState(false);
  const sets = STARTER_SETS[templateId] ?? [];
  if (!sets.length) return null;
  return (
    <>
      <button className="btn btn--wide library__readymade" onClick={() => setOpen(true)}>
        Start from a ready-made set…
      </button>
      {open && (
        <Modal title="Ready-made sets" onClose={() => setOpen(false)}>
          <p className="modal__text">{count ? 'Loading a set replaces the pieces on this stage. You can undo it.' : 'Pick one to start from, then change anything.'}</p>
          <div className="starters">
            {sets.map((s) => (
              <button
                key={s.id}
                className="starter"
                onClick={() => {
                  useProjectStore.getState().loadStarterSet(s);
                  setOpen(false);
                }}
              >
                <span className="starter__name">{s.name}</span>
                <span className="starter__desc">{s.description}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

/** Find pieces by search, the most-used row, then every category (collapsed). */
export function ObjectLibrary() {
  const [q, setQ] = useState('');
  const counts = useUsage((s) => s.counts);
  const query = q.trim().toLowerCase();
  const found = useMemo(() => (query ? objectTypes.filter((t) => query.split(/\s+/).every((w) => searchText(t).includes(w.length > 3 ? w.replace(/(es|s)$/, '') : w))) : []), [query]);
  const top = mostUsed(counts)
    .map((id) => objectTypes.find((t) => t.id === id))
    .filter((t): t is SetObjectType => !!t);
  return (
    <div className="library" data-tour="library">
      <ReadyMadeSets />
      <label className="library__search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
        </svg>
        <input type="search" placeholder="Search pieces, e.g. wall, stairs, sofa" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pieces" />
      </label>
      {query ? (
        found.length ? (
          <div className="library__grid">
            {found.map((t) => (
              <Tile key={t.id} t={t} />
            ))}
          </div>
        ) : (
          <p className="hint">Nothing called “{q}”. Try another word.</p>
        )
      ) : (
        <>
          <h3 className="group__title">Most used</h3>
          <div className="library__grid">
            {top.map((t) => (
              <Tile key={t.id} t={t} />
            ))}
          </div>
          {objectCategories().map((cat) => (
            <Collapsible key={cat} id={`lib:${cat}`} title={cat} defaultOpen={false}>
              {CATEGORY_TOOLS[cat] && <CategoryTools cat={cat} />}
              <div className="library__grid">
                {objectTypes
                  .filter((t) => t.category === cat)
                  .map((t) => (
                    <Tile key={t.id} t={t} />
                  ))}
              </div>
            </Collapsible>
          ))}
        </>
      )}
    </div>
  );
}
