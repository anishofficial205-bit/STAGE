/**
 * The light plot: the standard top-down drawing for crews. Stage outline, set
 * pieces as light grey outlines, hanging positions as lines, and every light as
 * a symbol for its type, turned to where it points, labelled with its channel
 * and colour. Legend, title block and scale bar; export as PDF, PNG and CSV.
 */
import { useMemo, useRef, useState } from 'react';
import { Modal } from '../Modal';
import { useActiveData, useActiveLighting, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { getTemplate } from '../../templates/registry';
import { placedAll } from '../../objects/actions';
import { GROUP_TYPE } from '../../objects/types';
import { FIXTURES, type Fixture, type FixtureType } from '../../lighting/types';
import { positionLine } from '../../lighting/hang';
import { colourName, hookup, hookupCsv, plotPdf, plotPng } from '../../lighting/plot';
import { lightActions } from '../../lighting/actions';
import { useLightsUI } from '../../lighting/ui';
import { download } from '../../graphics/specSheet';
import { exportName } from '../../export/exports';
import { formatLength } from '../../units';
import { printPdf } from '../export/PdfPreview';

/** Symbols drawn pointing along +x (the beam direction), about 0.6 m long. */
export function LightSymbol({ type, color }: { type: FixtureType; color?: string }) {
  const s = { fill: color ?? '#fff', stroke: '#111', strokeWidth: 0.035 };
  switch (type) {
    case 'profile':
      return <path d="M-0.32 -0.12 H0.08 L0.3 -0.2 V0.2 L0.08 0.12 H-0.32 Z" {...s} />;
    case 'follow':
      return <path d="M-0.45 -0.1 H0.1 L0.35 -0.18 V0.18 L0.1 0.1 H-0.45 Z M-0.45 0 H-0.6" {...s} />;
    case 'fresnel':
      return <path d="M-0.25 -0.17 H0.1 A0.17 0.17 0 0 1 0.1 0.17 H-0.25 Z" {...s} />;
    case 'par':
      return <ellipse cx={0} cy={0} rx={0.27} ry={0.15} {...s} />;
    case 'moving':
      return (
        <>
          <rect x={-0.2} y={-0.2} width={0.4} height={0.4} rx={0.04} {...s} />
          <circle cx={0.05} cy={0} r={0.12} {...s} />
        </>
      );
    case 'cyc':
      return (
        <>
          <rect x={-0.1} y={-0.42} width={0.2} height={0.84} {...s} />
          <path d="M-0.1 -0.14 H0.1 M-0.1 0.14 H0.1" stroke="#111" strokeWidth={0.03} />
        </>
      );
    case 'uplight':
      return <path d="M0.22 0 L-0.15 -0.2 V0.2 Z" {...s} />;
    case 'practical':
      return (
        <>
          <circle r={0.17} {...s} />
          <path d="M-0.12 -0.12 L0.12 0.12 M-0.12 0.12 L0.12 -0.12" stroke="#111" strokeWidth={0.03} />
        </>
      );
    case 'house':
      return (
        <>
          <circle r={0.16} {...s} />
          <path d="M0 -0.3 V-0.2 M0 0.2 V0.3 M-0.3 0 H-0.2 M0.2 0 H0.3" stroke="#111" strokeWidth={0.03} />
        </>
      );
  }
}

const PX = 1400; // drawing width in px
const MARGIN = 2.5; // metres round the drawing

function PlotSvg({ svgRef, venue, designer }: { svgRef: React.Ref<SVGSVGElement>; venue: string; designer: string }) {
  const lighting = useActiveLighting();
  const templateId = useProjectStore((s) => s.templateId);
  const projectName = useProjectStore((s) => s.projectName);
  const units = useProjectStore((s) => s.units);
  const params = useActiveParams();
  const data = useActiveData();
  const objects = useProjectStore((s) => s.objectsByTemplate[s.templateId]);
  const geo = useMemo(() => {
    const t = getTemplate(templateId)!;
    const floors = (t.stage?.(params, data).floors ?? []).filter((f) => f.height > 0.01).map((f) => f.outline);
    const pieces = placedAll().filter((p) => p.obj.type !== GROUP_TYPE && !p.obj.hidden);
    const xs = [...floors.flat().map((p) => p[0]), ...lighting.fixtures.map((f) => f.pos[0]), ...lighting.positions.flatMap((p) => [positionLine(p).a[0], positionLine(p).b[0]])];
    const zs = [...floors.flat().map((p) => p[1]), ...lighting.fixtures.map((f) => f.pos[2]), ...lighting.positions.map((p) => p.z)];
    const b = { x0: Math.min(...xs) - MARGIN, x1: Math.max(...xs) + MARGIN, z0: Math.min(...zs) - MARGIN, z1: Math.max(...zs) + MARGIN };
    return { floors, pieces, b };
  }, [templateId, params, data, objects, lighting]); // eslint-disable-line react-hooks/exhaustive-deps
  const { b } = geo;
  const wM = b.x1 - b.x0;
  const hM = b.z1 - b.z0;
  const k = PX / wM; // px per metre
  const legendH = 150;
  const H = Math.round(hM * k) + legendH;
  const pts = (p: [number, number][]) => p.map(([x, z]) => `${x},${z}`).join(' ');
  const used = [...new Set(lighting.fixtures.map((f) => f.type))];
  const angle = (f: Fixture) => {
    const dx = f.target[0] - f.pos[0];
    const dz = f.target[2] - f.pos[2];
    return Math.hypot(dx, dz) < 0.05 ? 90 : (Math.atan2(dz, dx) * 180) / Math.PI;
  };
  // Scale bar: a round number of metres about 1/6 of the width.
  const bar = [1, 2, 5, 10, 20].find((n) => n * k > PX / 8) ?? 20;
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <svg ref={svgRef} width={PX} height={H} viewBox={`0 0 ${PX} ${H}`} className="plot-svg" fontFamily="Helvetica, Arial, sans-serif">
      <rect width={PX} height={H} fill="#fff" />
      <g transform={`scale(${k}) translate(${-b.x0} ${-b.z0})`}>
        {geo.floors.map((f, i) => (
          <polygon key={i} points={pts(f)} fill="#f6f6f4" stroke="#222" strokeWidth={0.05} />
        ))}
        {geo.pieces.map((p) => (
          <rect key={p.obj.id} x={-p.size.width / 2} y={-p.size.depth / 2} width={p.size.width} height={Math.max(0.05, p.size.depth)} transform={`translate(${p.wx} ${p.wz}) rotate(${-p.obj.rotation})`} fill="none" stroke="#b9bcc1" strokeWidth={0.04} />
        ))}
        {lighting.positions.map((p) => {
          const l = positionLine(p);
          return p.kind === 'boom' ? (
            <g key={p.id}>
              <circle cx={p.x} cy={p.z} r={0.18} fill="#222" />
              <text x={p.x} y={p.z - 0.45} fontSize={0.38} textAnchor="middle" fill="#222">
                {p.name}
              </text>
            </g>
          ) : (
            <g key={p.id}>
              <line x1={l.a[0]} y1={l.a[2]} x2={l.b[0]} y2={l.b[2]} stroke="#222" strokeWidth={p.kind === 'foh' ? 0.16 : 0.08} strokeDasharray={p.kind === 'foh' ? '0.5 0.15' : undefined} />
              <text x={l.a[0] - 0.3} y={l.a[2] + 0.13} fontSize={0.38} textAnchor="end" fill="#222">
                {p.name}
              </text>
            </g>
          );
        })}
        {lighting.fixtures.map((f) => {
          const a = angle(f);
          const r = (a * Math.PI) / 180;
          // Channel behind the symbol, colour in front of it.
          const back = [f.pos[0] - Math.cos(r) * 0.62, f.pos[2] - Math.sin(r) * 0.62];
          return (
            <g key={f.id}>
              <g transform={`translate(${f.pos[0]} ${f.pos[2]}) rotate(${a})`}>
                <LightSymbol type={f.type} />
              </g>
              <circle cx={back[0]} cy={back[1]} r={0.24} fill="#fff" stroke="#111" strokeWidth={0.03} />
              <text x={back[0]} y={back[1] + 0.1} fontSize={0.28} fontWeight="bold" textAnchor="middle">
                {f.channel}
              </text>
              <text x={f.pos[0]} y={f.pos[2] + 0.6} fontSize={0.2} textAnchor="middle" fill="#333">
                {/* One word per line so neighbouring lights' labels don't run into each other. */}
                {colourName(f).replace(' (', '\u00a0(').split(' ').map((w, i) => (
                  <tspan key={i} x={f.pos[0]} dy={i ? 0.22 : 0}>
                    {w}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>
      {/* Legend */}
      <g transform={`translate(20 ${H - legendH + 16})`}>
        <text fontSize={14} fontWeight="bold">
          Legend
        </text>
        {used.map((t, i) => (
          <g key={t} transform={`translate(${(i % 4) * 190} ${26 + Math.floor(i / 4) * 34})`}>
            <g transform="translate(18 0) scale(40)">
              <LightSymbol type={t} />
            </g>
            <text x={44} y={5} fontSize={12}>
              {FIXTURES[t].label}
            </text>
          </g>
        ))}
      </g>
      {/* Scale bar */}
      <g transform={`translate(20 ${H - 26})`}>
        <rect width={bar * k} height={6} fill="#111" />
        <rect width={(bar * k) / 2} height={6} fill="#fff" stroke="#111" />
        <text x={bar * k + 8} y={7} fontSize={12}>
          {formatLength(bar, units)}
        </text>
      </g>
      {/* Title block */}
      <g transform={`translate(${PX - 340} ${H - legendH + 6})`}>
        <rect width={320} height={legendH - 16} fill="#fff" stroke="#111" strokeWidth={1.5} />
        <text x={12} y={28} fontSize={18} fontWeight="bold">
          {projectName}
        </text>
        <text x={12} y={50} fontSize={12}>
          Light plot · {getTemplate(templateId)!.name}
        </text>
        <text x={12} y={72} fontSize={12}>
          Venue: {venue || '—'}
        </text>
        <text x={12} y={92} fontSize={12}>
          Designer: {designer || '—'}
        </text>
        <text x={12} y={112} fontSize={12}>
          Date: {date} · {lighting.fixtures.length} lights
        </text>
      </g>
    </svg>
  );
}

export function LightPlot() {
  const open = useLightsUI((s) => s.plotOpen);
  const lighting = useActiveLighting();
  const projectName = useProjectStore((s) => s.projectName);
  const svg = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!open) return null;
  const close = () => useLightsUI.getState().setPlotOpen(false);
  const setPlot = (change: Partial<{ venue: string; designer: string }>) => useProjectStore.getState().setLighting((l) => ({ ...l, plot: { ...l.plot, ...change } }), `plot:${Object.keys(change).join()}`);
  const rows = hookup(lighting);
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal title="Lighting plan" onClose={close} wide>
      <div className="plot">
        <div className="plot__drawing">
          <PlotSvg svgRef={svg} venue={lighting.plot.venue} designer={lighting.plot.designer} />
        </div>
        <div className="plot__side">
          <label className="field">
            <span className="field__label">Venue</span>
            <input className="field__input" value={lighting.plot.venue} onChange={(e) => setPlot({ venue: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">Designer</span>
            <input className="field__input" value={lighting.plot.designer} onChange={(e) => setPlot({ designer: e.target.value })} />
          </label>
          <div className="btn-row">
            <button className="btn btn--primary" disabled={!!busy} onClick={() => run('pdf', async () => { if (svg.current) download(await plotPdf(svg.current, rows, projectName), exportName('light-plot.pdf')); })}>
              {busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}
            </button>
            <button className="btn" disabled={!!busy} onClick={() => run('print', async () => { if (svg.current) printPdf(await plotPdf(svg.current, rows, projectName)); })} title="The plot and the channel hookup, as on the PDF">
              {busy === 'print' ? 'Preparing…' : 'Print…'}
            </button>
            <button className="btn" disabled={!!busy} onClick={() => run('png', async () => { if (svg.current) download(await plotPng(svg.current), exportName('light-plot.png')); })}>
              PNG
            </button>
            <button className="btn" disabled={!!busy} onClick={() => run('csv', async () => download(hookupCsv(rows), exportName('hookup.csv')))}>
              Hookup CSV
            </button>
          </div>
          <h3 className="group__title">Channel hookup</h3>
          <div className="hookup">
            <table>
              <thead>
                <tr>
                  <th>Ch</th>
                  <th>Type</th>
                  <th>Position</th>
                  <th>Colour</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[...lighting.fixtures]
                  .sort((a, b) => a.channel - b.channel)
                  .map((f) => {
                    const r = rows.find((x) => x.channel === f.channel && x.type === FIXTURES[f.type].label)!;
                    return (
                      <tr key={f.id}>
                        <td>{f.channel}</td>
                        <td>{r?.type}</td>
                        <td>{r?.position}</td>
                        <td>{r?.colour}</td>
                        <td>
                          <input value={f.purpose ?? ''} placeholder="—" onChange={(e) => lightActions.patch([f.id], { purpose: e.target.value }, `purpose:${f.id}`)} aria-label={`Purpose of channel ${f.channel}`} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
