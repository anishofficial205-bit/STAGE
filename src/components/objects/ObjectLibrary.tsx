import { objectCategories, objectTypes } from '../../objects/registry';
import { addObjectAt } from '../../objects/actions';
import { OBJECT_DRAG_TYPE } from '../../objects/ui';

/** Object tiles by category: drag one into the 3D view, or click to place it at stage centre. */
export function ObjectLibrary() {
  return (
    <div className="library" data-tour="library">
      {objectCategories().map((cat) => (
        <div key={cat} className="library__group">
          <h3 className="group__title">{cat}</h3>
          <div className="library__grid">
            {objectTypes
              .filter((t) => t.category === cat)
              .map((t) => (
                <button
                  key={t.id}
                  className="tile"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(OBJECT_DRAG_TYPE, t.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => addObjectAt(t.id)}
                  title={`${t.name} — drag into the view, or click to place at stage centre`}
                >
                  <span className="tile__icon">{t.icon}</span>
                  <span className="tile__name">{t.name}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
