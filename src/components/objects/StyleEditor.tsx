import { useState } from 'react';
import { Field } from '../fields';
import { MATERIALS, defaultStyle, getMaterial, type FaceStyle, type MaterialId } from '../../objects/materials';
import { useProjectStore } from '../../store/useProjectStore';

const RECENT_KEY = 'stage-builder:recent-colours';
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
};
function pushRecent(c: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([c, ...readRecent().filter((x) => x !== c)].slice(0, 10)));
  } catch {
    // ignore
  }
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Material, colour and roughness for one face (or surface). `onChange(null)` clears it. */
export function StyleEditor({ style, onChange, extra }: { style?: FaceStyle; onChange: (s: FaceStyle | null, key?: string) => void; extra?: React.ReactNode }) {
  const units = useProjectStore((s) => s.units);
  const current = style ?? defaultStyle();
  const [hex, setHex] = useState(current.color);
  const [recent, setRecent] = useState(readRecent);
  const setColor = (c: string, key = 'colour') => {
    setHex(c);
    if (HEX.test(c)) onChange({ ...current, color: c.toLowerCase() }, key);
  };
  const commitRecent = (c: string) => {
    if (!HEX.test(c)) return;
    pushRecent(c.toLowerCase());
    setRecent(readRecent());
  };
  const pickMaterial = (id: MaterialId) => {
    const m = getMaterial(id);
    // Solid colour keeps the current colour; other materials start from their natural tint.
    const next = { ...defaultStyle(id), color: id === 'paint' ? current.color : m.color, graphic: current.graphic };
    setHex(next.color);
    onChange(next);
  };
  return (
    <div className="style-editor">
      <div className="materials">
        {MATERIALS.map((m) => (
          <button key={m.id} className={`material ${current.material === m.id && style ? 'is-active' : ''}`} onClick={() => pickMaterial(m.id)} title={m.name}>
            <span className={`material__swatch material__swatch--${m.id}`} style={{ background: m.color }} />
            <span className="material__name">{m.name}</span>
          </button>
        ))}
      </div>
      <div className="colour-row">
        <input type="color" value={HEX.test(hex) ? hex : current.color} onChange={(e) => setColor(e.target.value)} onBlur={(e) => commitRecent(e.target.value)} aria-label="Colour" />
        <input className="colour-hex" value={hex} onChange={(e) => setColor(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} onBlur={() => commitRecent(hex)} aria-label="Hex colour" spellCheck={false} />
      </div>
      {recent.length > 0 && (
        <div className="recent">
          {recent.map((c) => (
            <button key={c} className="recent__chip" style={{ background: c }} title={c} onClick={() => setColor(c, 'recent')} />
          ))}
        </div>
      )}
      <Field
        def={{ key: 'roughness', label: 'Roughness', group: '', type: 'number', unit: 'none', default: 0.8, min: 0, max: 1, step: 0.05, help: '0 = glossy, 1 = matte.' }}
        value={current.roughness}
        units={units}
        onChange={(v) => onChange({ ...current, roughness: v as number }, 'roughness')}
      />
      {extra}
    </div>
  );
}

/** A small preview dot for a style. */
export function Swatch({ style }: { style?: FaceStyle }) {
  return (
    <span className={`swatch ${style ? '' : 'swatch--none'} ${style ? `material__swatch--${style.material}` : ''} ${style?.graphic ? 'swatch--graphic' : ''}`} style={style ? { background: style.color } : undefined}>
      {style?.graphic ? '▣' : ''}
    </span>
  );
}
