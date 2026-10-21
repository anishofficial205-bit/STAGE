import { useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { ACCEPT, importFiles, replaceGraphic, usageCounts, useGraphicUrl } from '../../graphics/library';
import { GRAPHIC_DRAG_TYPE } from '../../objects/ui';
import type { GraphicMeta } from '../../graphics/types';

function GraphicRow({ g, used }: { g: GraphicMeta; used: number }) {
  const url = useGraphicUrl(g.id);
  const replaceInput = useRef<HTMLInputElement>(null);
  const removeGraphic = useProjectStore((s) => s.removeGraphic);
  return (
    <li
      className="graphic"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(GRAPHIC_DRAG_TYPE, g.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      title="Drag onto a face in the view, or onto a face in the properties panel"
    >
      <span className="graphic__thumb">{url ? <img src={url} alt="" draggable={false} /> : null}</span>
      <span className="graphic__info">
        <span className="graphic__name">{g.name}</span>
        <span className="graphic__meta">
          {g.vector ? 'Vector' : `${g.width} × ${g.height} px`} · {used ? `used on ${used} face${used === 1 ? '' : 's'}` : 'not used'}
        </span>
      </span>
      <span className="graphic__actions">
        <button className="btn btn--link" onClick={() => replaceInput.current?.click()} title="Replace the artwork everywhere it's used">
          Replace
        </button>
        <button
          className="btn btn--link btn--danger-link"
          onClick={() => (!used || confirm(`“${g.name}” is used on ${used} face(s). Remove it from them and the library?`)) && removeGraphic(g.id)}
        >
          Delete
        </button>
      </span>
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void replaceGraphic(g.id, f);
          e.target.value = '';
        }}
      />
    </li>
  );
}

/** The project's graphics library: add files, see where each is used, drag them onto faces. */
export function GraphicsPanel() {
  const graphics = useProjectStore((s) => s.graphics);
  // Recount usage whenever faces change.
  useProjectStore((s) => s.objectsByTemplate);
  useProjectStore((s) => s.surfaceStylesByTemplate);
  const used = usageCounts();
  const input = useRef<HTMLInputElement>(null);
  const list = Object.values(graphics);
  return (
    <div className="graphics">
      <button className="btn btn--wide" onClick={() => input.current?.click()}>
        + Add graphics
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          void importFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      {list.length === 0 ? (
        <p className="hint">JPG, PNG, WebP, SVG or PDF. You can also drag an image from your computer straight onto a face.</p>
      ) : (
        <ul className="graphic-list">
          {list.map((g) => (
            <GraphicRow key={g.id} g={g} used={used[g.id] ?? 0} />
          ))}
        </ul>
      )}
    </div>
  );
}
