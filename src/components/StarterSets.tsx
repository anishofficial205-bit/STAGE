import { useProjectStore } from '../store/useProjectStore';
import { STARTER_SETS } from '../starters';
import { Collapsible } from './Collapsible';

/** Example sets for the current stage type, loadable with one click (undoable). */
export function StarterSets() {
  const templateId = useProjectStore((s) => s.templateId);
  const count = useProjectStore((s) => (s.objectsByTemplate[s.templateId] ?? []).length);
  const sets = STARTER_SETS[templateId] ?? [];
  if (!sets.length) return null;
  return (
    <Collapsible id="starters" title="Starter sets" defaultOpen={count === 0}>
      <p className="hint">{count ? 'Loading a starter set replaces the pieces on this stage (you can undo it).' : 'Start from an example set and edit it.'}</p>
      <div className="starters">
        {sets.map((s) => (
          <button key={s.id} className="starter" onClick={() => useProjectStore.getState().loadStarterSet(s)} title={s.description}>
            <span className="starter__name">{s.name}</span>
            <span className="starter__desc">{s.description}</span>
          </button>
        ))}
      </div>
    </Collapsible>
  );
}
