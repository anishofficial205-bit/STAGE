import { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { getObjectType } from '../objects/registry';
import { GROUP_TYPE } from '../objects/types';
import { lookup } from '../glossary/terms';
import { usageCounts, useGraphicUrl } from '../graphics/library';
import { FIXTURES, emptyLighting } from '../lighting/types';
import { useLightsUI } from '../lighting/ui';
import { useBlockingUI } from '../blocking/ui';
import { getTemplate } from '../templates/registry';
import { useShell } from './shell';
import type { GraphicMeta } from '../graphics/types';

function Picture({ g, used }: { g: GraphicMeta; used: number }) {
  const url = useGraphicUrl(g.id);
  return (
    <li>
      <button className="lib__row" onClick={() => useShell.getState().setDock('pictures')} title="Open in Pictures">
        <span className="graphic__thumb lib__thumb">{url ? <img src={url} alt="" /> : null}</span>
        <span className="lib__name">{g.name}</span>
        <span className="lib__count">{used ? `on ${used} face${used === 1 ? '' : 's'}` : 'not used'}</span>
      </button>
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="lib__section">
      <h3 className="lib__title">
        {title} <span>{count}</span>
      </h3>
      {count ? children : <p className="hint">None yet.</p>}
    </section>
  );
}

/**
 * Everything the project uses, in one place: set pieces by kind, pictures,
 * lights and performers. Clicking something picks it (in its own mode).
 */
export function ProjectLibrary() {
  const templateId = useProjectStore((s) => s.templateId);
  const all = useProjectStore((s) => s.objectsByTemplate[s.templateId]) ?? [];
  // Groups are just containers: list what's in them.
  const objects = all.filter((o) => o.type !== GROUP_TYPE);
  const lighting = useProjectStore((s) => s.lightingByTemplate[s.templateId]) ?? emptyLighting();
  const performers = useProjectStore((s) => s.blockingByTemplate[s.templateId]?.performers) ?? [];
  const graphics = Object.values(useProjectStore((s) => s.graphics));
  // Recount picture use whenever template surfaces change too.
  useProjectStore((s) => s.surfaceStylesByTemplate);
  const [open, setOpen] = useState<string | null>(null);
  const s = useProjectStore.getState();
  const used = usageCounts();
  const template = getTemplate(templateId);

  const kinds = Object.entries(
    objects.reduce<Record<string, typeof objects>>((m, o) => {
      const label = getObjectType(o.type)?.name ?? o.type;
      (m[label] ??= []).push(o);
      return m;
    }, {}),
  ).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const lightKinds = Object.entries(
    lighting.fixtures.reduce<Record<string, string[]>>((m, f) => {
      (m[FIXTURES[f.type].label] ??= []).push(f.id);
      return m;
    }, {}),
  ).sort((a, b) => b[1].length - a[1].length);

  const pick = (ids: string[]) => {
    s.setMode('set');
    s.select(ids);
  };

  return (
    <div className="lib">
      <button className="lib__row lib__stage" onClick={() => s.selectStage(true)} title="Stage settings">
        <span className="lib__name">Stage</span>
        <span className="lib__count">{template ? (lookup(template.name)?.plain ?? template.name) : templateId}</span>
      </button>

      <Section title="Set pieces" count={objects.length}>
        <ul className="lib__list">
          {kinds.map(([label, list]) => (
            <li key={label}>
              <span className="lib__row lib__group">
                <button className="lib__expand" onClick={() => setOpen(open === label ? null : label)} aria-expanded={open === label} aria-label={`Show each ${label}`}>
                  {open === label ? '▾' : '▸'}
                </button>
                <button className="lib__name lib__link" onClick={() => pick(list.map((o) => o.id))} title={`Pick every ${label.toLowerCase()}`}>
                  {label}
                </button>
                <span className="lib__count">× {list.length}</span>
              </span>
              {open === label && (
                <ul className="lib__sub">
                  {list.map((o) => (
                    <li key={o.id}>
                      <button className="lib__row" onClick={() => pick([o.id])}>
                        <span className="lib__name">{o.name}</span>
                        {o.hidden && <span className="lib__count">hidden</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Pictures" count={graphics.length}>
        <ul className="lib__list">
          {graphics.map((g) => (
            <Picture key={g.id} g={g} used={used[g.id] ?? 0} />
          ))}
        </ul>
      </Section>

      <Section title="Lights" count={lighting.fixtures.length}>
        <ul className="lib__list">
          {lightKinds.map(([label, ids]) => (
            <li key={label}>
              <button
                className="lib__row"
                onClick={() => {
                  s.setMode('lights');
                  useLightsUI.getState().select({ kind: 'fixture', ids });
                }}
                title={`Pick every ${label.toLowerCase()} in Lights`}
              >
                <span className="lib__name">{label}</span>
                <span className="lib__count">× {ids.length}</span>
              </button>
            </li>
          ))}
          {lighting.haze.on && (
            <li className="lib__row lib__note">
              <span className="lib__name">Haze</span>
              <span className="lib__count">{Math.round(lighting.haze.density)}%</span>
            </li>
          )}
          {lighting.looks.length > 0 && (
            <li className="lib__row lib__note">
              <span className="lib__name">Saved looks</span>
              <span className="lib__count">{lighting.looks.length}</span>
            </li>
          )}
        </ul>
      </Section>

      <Section title="Performers" count={performers.length}>
        <ul className="lib__list">
          {performers.map((p) => (
            <li key={p.id}>
              <button
                className="lib__row"
                onClick={() => {
                  s.setMode('blocking');
                  useBlockingUI.getState().select({ kind: 'performer', ids: [p.id] });
                }}
              >
                <span className="lib__dot" style={{ background: p.color }} />
                <span className="lib__name">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
