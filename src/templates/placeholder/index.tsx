/**
 * Placeholder template — a plain box stage with a demo seating block.
 *
 * It exists only to prove the template system end to end (generated panel,
 * units, dimension labels, preset views, save/load). Removed in the polish step
 * once the real stage templates exist.
 *
 * Layout: the stage's front edge sits on z = 0 and the stage extends back to
 * z = -depth. The audience faces it from +Z.
 */
import type { Bounds, Params, PresetView, StageTemplate, Surface } from '../../types';
import { num } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating, rowCentre, seatingExtent, type SeatingOptions } from '../../helpers/Seating';
import { COLORS, ROUGHNESS } from '../../helpers/materials';
import { EYE_HEIGHT } from '../../helpers/views';

/** Seating options derived from params, shared by build, views and bounds. */
function seating(p: Params): SeatingOptions {
  return {
    rows: num(p, 'rows'),
    firstRowDistance: num(p, 'gap'),
    rowSpacing: num(p, 'rowSpacing'),
    rise: num(p, 'rake'),
    rowWidth: num(p, 'seatingWidth'),
    curve: num(p, 'curve'),
  };
}

function Scene({ p }: { p: Params }) {
  const w = num(p, 'width');
  const d = num(p, 'depth');
  const h = num(p, 'height');
  const thickness = Math.max(h, 0.02); // a zero-height stage is still drawn as a thin plate
  return (
    <group>
      <mesh position={[0, thickness / 2, -d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, thickness, d]} />
        <meshStandardMaterial color={COLORS.stageFloor} roughness={ROUGHNESS} />
      </mesh>

      <Seating {...seating(p)} />

      <DimensionLabel start={[-w / 2, h, 0]} end={[w / 2, h, 0]} offset={[0, 0.6, 0.4]} label="Width" />
      <DimensionLabel start={[w / 2, h, 0]} end={[w / 2, h, -d]} offset={[0.8, 0.3, 0]} label="Depth" />
      {h > 0.01 && <DimensionLabel start={[-w / 2, 0, 0]} end={[-w / 2, h, 0]} offset={[-0.6, 0, 0.3]} label="Height" />}
    </group>
  );
}

export const placeholderTemplate: StageTemplate = {
  id: 'placeholder',
  name: 'Placeholder',
  description: 'A simple box stage for testing',
  audienceSides: ['front'],

  params: [
    { key: 'width', label: 'Width', group: 'Stage', type: 'number', default: 8, min: 2, max: 40, step: 0.1 },
    { key: 'depth', label: 'Depth', group: 'Stage', type: 'number', default: 6, min: 1, max: 30, step: 0.1 },
    { key: 'height', label: 'Height', group: 'Stage', type: 'number', default: 1, min: 0, max: 3, step: 0.05, help: 'Height of the stage floor above the audience floor.' },
    { key: 'rows', label: 'Rows', group: 'Seating', type: 'number', unit: 'none', default: 8, min: 0, max: 50, step: 1 },
    { key: 'seatingWidth', label: 'Seating width', group: 'Seating', type: 'number', default: 12, min: 2, max: 60, step: 0.1, visible: (p) => num(p, 'rows') > 0 },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Seating', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, visible: (p) => num(p, 'rows') > 0 },
    { key: 'rake', label: 'Rake (rise per row)', group: 'Seating', type: 'number', default: 0.15, min: 0, max: 0.5, step: 0.01, help: 'How much higher each row is than the one in front.', visible: (p) => num(p, 'rows') > 0 },
    { key: 'curve', label: 'Seating curve', group: 'Seating', type: 'number', unit: 'none', default: 0.3, min: 0, max: 1, step: 0.05, help: '0 = straight rows, 1 = strongly curved around the stage.', visible: (p) => num(p, 'rows') > 0 },
    { key: 'gap', label: 'Gap to first row', group: 'Seating', type: 'number', default: 2, min: 0.5, max: 10, step: 0.1, visible: (p) => num(p, 'rows') > 0 },
  ],

  constraints: (p) => p, // nothing interdependent in the placeholder

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const h = num(p, 'height');
    const d = num(p, 'depth');
    const s = seating(p);
    const stageTarget: [number, number, number] = [0, h + 1.2, -d / 2];
    const views: PresetView[] = [];
    if (s.rows > 0) {
      const front = rowCentre(s, 0);
      const back = rowCentre(s, s.rows - 1);
      views.push(
        { id: 'front-row', label: 'Front row', position: [0, front[1] + EYE_HEIGHT, front[2]], target: stageTarget },
        { id: 'back-row', label: 'Back row', position: [0, back[1] + EYE_HEIGHT, back[2]], target: stageTarget },
      );
    }
    views.push({ id: 'side', label: 'Side', position: [num(p, 'width') / 2 + 8, h + 2, -d / 2 + 2], target: [0, h, -d / 2] });
    return views;
  },

  surfaces: (p): Surface[] => {
    const w = num(p, 'width');
    const d = num(p, 'depth');
    const h = num(p, 'height');
    return [
      { id: 'stage-floor', label: 'Stage floor', position: [0, h, -d / 2], rotation: [-Math.PI / 2, 0, 0], width: w, height: d },
      { id: 'stage-front', label: 'Stage front edge', position: [0, h / 2, 0], rotation: [0, 0, 0], width: w, height: h },
    ];
  },

  bounds: (p): Bounds => {
    const e = seatingExtent(seating(p));
    const half = Math.max(num(p, 'width') / 2, e.halfWidth);
    return {
      min: [-half, 0, Math.min(-num(p, 'depth'), e.minZ)],
      max: [half, Math.max(num(p, 'height') + 1, e.top), Math.max(1, e.maxZ)],
    };
  },
};
