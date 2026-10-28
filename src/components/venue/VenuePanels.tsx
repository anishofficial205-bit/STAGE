import { useRef, useState } from 'react';
import { Field } from '../fields';
import { Collapsible } from '../Collapsible';
import { useProjectStore } from '../../store/useProjectStore';
import { formatLength } from '../../units';
import type { ParamDef } from '../../types';
import { wallLength } from '../../venue/geometry';
import { DOOR_PRESETS, ENTRANCE_NAMES, FLOOR_MATERIALS, ROOM_TYPES, WALL_MATERIALS, type Door } from '../../venue/types';
import { venueActions } from '../../venue/actions';
import { useVenueUI, type VenueTool } from '../../venue/ui';
import { polygonArea, roomAt, roomOutline } from '../../venue/rooms';
import { FURNITURE, getFurniture } from '../../venue/furniture';
import { formatArea } from './format';
import { HURRY, WALK, endName, formatTime, solveRoute } from '../../venue/routes';
import { importTrace, patchTrace, removeTrace } from '../../venue/trace';
import { removePick } from '../layers/ops';
import { Modal } from '../Modal';

const TOOLS: { id: VenueTool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Select', key: 'V', hint: 'Click anything (here or in 3D) to select it. Drag walls, wall ends, doors and furniture to move them. Drag the background to pan, scroll to zoom.' },
  { id: 'wall', label: 'Wall', key: 'W', hint: 'Click to start, click to add corners, double-click (or Enter) to finish; click the first corner to close. Snaps to the grid, 90°/45°, wall ends and the stage — Shift for any angle, ⌘/Ctrl to place freely.' },
  { id: 'room', label: 'Room', key: 'M', hint: 'Drag out a rectangle to make a room with four walls — or click inside an area your walls already close in.' },
  { id: 'door', label: 'Door', key: 'D', hint: 'Click on a wall to put a door there. It swings to the side you click on.' },
  { id: 'furniture', label: 'Furniture', key: 'U', hint: 'Pick a piece, then click in the plan to place it. Near a wall it turns its back to the wall. R rotates the selected piece 90° (Shift: 15°).' },
  { id: 'route', label: 'Route', key: 'P', hint: 'Click where the route starts (a room or a door), then where it ends. The walking path goes through doors, around walls, and is saved with its length and walking time.' },
];

/** Import a floor plan to trace over, then calibrate its scale. */
function TraceSection() {
  const trace = useProjectStore((s) => s.venue.trace);
  const tool = useVenueUI((s) => s.tool);
  const selected = useVenueUI((s) => s.selected?.kind === 'trace');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      await importTrace(f);
      useVenueUI.getState().setTool('calibrate');
      useVenueUI.getState().setNotice('Now click two points on the plan whose real distance you know (e.g. the ends of a dimension line).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import that file.');
    }
    setBusy(false);
  };
  return (
    <Collapsible id="venue-trace" title="Trace a floor plan">
      <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />
      {!trace ? (
        <>
          <p className="hint">Import a JPG, PNG or PDF of the venue’s floor plan. It shows faintly under the plan so you can draw walls and rooms over it.</p>
          <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? 'Importing…' : 'Import plan to trace…'}
          </button>
        </>
      ) : (
        <>
          <p className="hint">{trace.name}</p>
          <Field def={{ key: 'opacity', label: 'Opacity (%)', group: '', type: 'number', unit: 'none', default: 50, min: 5, max: 100, step: 5 }} value={Math.round(trace.opacity * 100)} units="m" onChange={(v) => patchTrace({ opacity: (v as number) / 100 })} />
          <div className="btn-row">
            <button className={`btn btn--small ${tool === 'calibrate' ? 'is-active' : ''}`} onClick={() => { useVenueUI.getState().setTool('calibrate'); useVenueUI.getState().setNotice('Click two points on the plan whose real distance you know.'); }}>
              Calibrate scale…
            </button>
            <button className={`btn btn--small ${selected ? 'is-active' : ''}`} onClick={() => { useVenueUI.getState().setTool('select'); useVenueUI.getState().select(selected ? null : { kind: 'trace', id: trace.id }); }} disabled={trace.locked} title={trace.locked ? 'Unlock it first' : 'Drag the image to line it up'}>
              Move image
            </button>
          </div>
          <div className="btn-row">
            <button className={`btn btn--small ${trace.locked ? 'is-active' : ''}`} onClick={() => patchTrace({ locked: !trace.locked })}>
              {trace.locked ? '🔒 Locked' : 'Lock'}
            </button>
            <button className={`btn btn--small ${trace.hidden ? 'is-active' : ''}`} onClick={() => patchTrace({ hidden: !trace.hidden })}>
              {trace.hidden ? 'Hidden' : 'Hide'}
            </button>
            <button className="btn btn--small" onClick={() => input.current?.click()}>
              Replace…
            </button>
            <button className="btn btn--small btn--danger" onClick={removeTrace}>
              Remove
            </button>
          </div>
          <p className="hint">Scale: 1 px = {(trace.mPerPx * 1000).toFixed(1)} mm · image {(trace.width * trace.mPerPx).toFixed(1)} × {(trace.height * trace.mPerPx).toFixed(1)} m</p>
        </>
      )}
      {error && <p className="panel-msg panel-msg--warning">{error}</p>}
    </Collapsible>
  );
}

/** Left side in Venue mode: the drawing tools and their options. */
export function VenueTools() {
  const tool = useVenueUI((s) => s.tool);
  const draft = useVenueUI((s) => s.draft.length);
  const roomType = useVenueUI((s) => s.roomType);
  const doorPreset = useVenueUI((s) => s.doorPreset);
  const furnitureType = useVenueUI((s) => s.furnitureType);
  const counts = { walls: useProjectStore((s) => s.venue.walls.length), rooms: useProjectStore((s) => s.venue.rooms.length), doors: useProjectStore((s) => s.venue.doors.length) };
  const ui = useVenueUI.getState();
  const hint = TOOLS.find((t) => t.id === tool)?.hint;
  return (
    <Collapsible id="venue-tools" title="Plan tools" tour="venue-tools">
      <div className="tool-list" role="toolbar" aria-label="Plan tools">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool-btn ${tool === t.id ? 'is-active' : ''}`} onClick={() => ui.setTool(t.id)} aria-pressed={tool === t.id} title={`${t.label} (${t.key})`}>
            <span>{t.label}</span>
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>
      {tool === 'room' && (
        <label className="field">
          <span className="field__label">Room type</span>
          <select className="field__select" value={roomType} onChange={(e) => ui.setChoice({ roomType: e.target.value })}>
            {Object.entries(ROOM_TYPES).map(([id, t]) => (
              <option key={id} value={id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {tool === 'door' && (
        <div className="chips">
          {Object.entries(DOOR_PRESETS).map(([id, p]) => (
            <button key={id} className={`chip ${doorPreset === id ? 'is-active' : ''}`} onClick={() => ui.setChoice({ doorPreset: id as keyof typeof DOOR_PRESETS })}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {tool === 'furniture' && (
        <div className="furniture-list">
          {FURNITURE.map((f) => (
            <button key={f.id} className={`tool-btn ${furnitureType === f.id ? 'is-active' : ''}`} onClick={() => ui.setChoice({ furnitureType: f.id })}>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
      <p className="hint">{hint}</p>
      {tool === 'wall' && draft > 0 && <p className="panel-msg panel-msg--info">{draft} corner{draft === 1 ? '' : 's'} placed. Esc cancels, Backspace removes the last one.</p>}
      <p className="hint">
        {counts.walls} wall{counts.walls === 1 ? '' : 's'} · {counts.rooms} room{counts.rooms === 1 ? '' : 's'} · {counts.doors} door{counts.doors === 1 ? '' : 's'}
      </p>
    </Collapsible>
  );
}

/** Left side in Venue mode. */
export function VenueLeft() {
  return (
    <>
      <VenueTools />
      <TraceSection />
    </>
  );
}

/** Start the backstage again: removes everything drawn here, after asking (and can be undone). */
export function ClearVenue() {
  const v = useProjectStore((s) => s.venue);
  const [asking, setAsking] = useState(false);
  const count = v.walls.length + v.rooms.length + v.doors.length + v.furniture.length + v.routes.length + (v.trace ? 1 : 0);
  if (!count) return null;
  return (
    <>
      <button className="btn btn--danger venue-clear" onClick={() => setAsking(true)}>
        Clear the backstage…
      </button>
      {asking && (
        <Modal title="Clear the backstage?" onClose={() => setAsking(false)}>
          <p className="modal__text">
            Removes everything drawn here: {v.walls.length} wall{v.walls.length === 1 ? '' : 's'}, {v.rooms.length} room{v.rooms.length === 1 ? '' : 's'}, {v.doors.length} door{v.doors.length === 1 ? '' : 's'}, {v.furniture.length} piece{v.furniture.length === 1 ? '' : 's'} of furniture and {v.routes.length} route{v.routes.length === 1 ? '' : 's'}
            {v.trace ? ', and the traced floor plan' : ''}. The stage, set, lights and performers stay. You can undo it.
          </p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setAsking(false)} autoFocus>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                setAsking(false);
                venueActions.clearAll();
              }}
            >
              Clear it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

const WALL_FIELDS: ParamDef[] = [
  { key: 'length', label: 'Length', group: '', type: 'number', default: 1, min: 0.1, max: 200, step: 0.05 },
  { key: 'thickness', label: 'Thickness', group: '', type: 'number', default: 0.2, min: 0.05, max: 2, step: 0.01 },
  { key: 'height', label: 'Height', group: '', type: 'number', default: 4, min: 0.5, max: 30, step: 0.1 },
  { key: 'material', label: 'Material', group: '', type: 'select', default: 'plaster', options: Object.entries(WALL_MATERIALS).map(([value, m]) => ({ value, label: m.label })) },
];
const ROOM_FIELDS: ParamDef[] = [
  { key: 'type', label: 'Type', group: '', type: 'select', default: 'custom', options: Object.entries(ROOM_TYPES).map(([value, t]) => ({ value, label: t.label })) },
  { key: 'floor', label: 'Floor', group: '', type: 'select', default: 'vinyl', options: Object.entries(FLOOR_MATERIALS).map(([value, m]) => ({ value, label: m.label })) },
  { key: 'wallHeight', label: 'Wall height', group: '', type: 'number', default: 4, min: 0.5, max: 30, step: 0.1 },
];
const DOOR_FIELDS: ParamDef[] = [
  { key: 'kind', label: 'Type', group: '', type: 'select', default: 'single', options: [
    { value: 'single', label: 'Single door' },
    { value: 'double', label: 'Double door' },
    { value: 'opening', label: 'Opening (no door)' },
  ] },
  { key: 'width', label: 'Width', group: '', type: 'number', default: 0.9, min: 0.4, max: 10, step: 0.05 },
  { key: 'height', label: 'Height', group: '', type: 'number', default: 2.1, min: 1, max: 10, step: 0.05 },
];

function Head({ title }: { title: string }) {
  return (
    <div className="panel-head">
      <h2 className="panel-title">{title}</h2>
      <button className="btn btn--link" onClick={() => useVenueUI.getState().select(null)} title="Deselect (Esc)">
        Done
      </button>
    </div>
  );
}

function DoorProps({ door }: { door: Door }) {
  const units = useProjectStore((s) => s.units);
  return (
    <div className="props">
      <Head title={door.entrance ? `Door · ${door.entrance}` : 'Door'} />
      {DOOR_FIELDS.map((def) => (
        <Field key={def.key} def={def} value={(door as unknown as Record<string, number | string>)[def.key]} units={units} onChange={(v) => venueActions.patchDoor(door.id, { [def.key]: v })} />
      ))}
      <div className="btn-row">
        <button className="btn btn--small" onClick={() => venueActions.patchDoor(door.id, { width: DOOR_PRESETS.loading.width, height: DOOR_PRESETS.loading.height, kind: 'double' })} title="3 m wide, 3.5 m high">
          Loading door size
        </button>
        {door.kind !== 'opening' && (
          <>
            <button className="btn btn--small" onClick={() => venueActions.patchDoor(door.id, { side: door.side === 1 ? -1 : 1 })} title="Swing to the other side of the wall">
              ⇅ Flip swing
            </button>
            {door.kind === 'single' && (
              <button className="btn btn--small" onClick={() => venueActions.patchDoor(door.id, { hinge: door.hinge === 'a' ? 'b' : 'a' })} title="Hinge on the other side">
                ⇆ Flip hinge
              </button>
            )}
          </>
        )}
      </div>
      <section className="group">
        <h3 className="group__title">Stage connection</h3>
        <label className="field field--inline">
          <span className="field__label">Leads onto the stage</span>
          <button type="button" role="switch" aria-checked={!!door.entrance} className={`switch ${door.entrance ? 'is-on' : ''}`} onClick={() => venueActions.patchDoor(door.id, { entrance: door.entrance ? undefined : nextEntranceName() })}>
            <span className="switch__knob" />
          </button>
        </label>
        {door.entrance !== undefined && (
          <label className="field">
            <span className="field__label">Entrance name</span>
            <input className="field__input" list="entrance-names" value={door.entrance} onChange={(e) => venueActions.patchDoor(door.id, { entrance: e.target.value }, `door-name:${door.id}`)} />
            <datalist id="entrance-names">
              {ENTRANCE_NAMES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
        )}
        <p className="hint">Named entrances are used in Blocking for performers’ entrances and exits.</p>
      </section>
      <div className="btn-row">
        <button className="btn btn--danger" onClick={() => removePick({ domain: 'venue', kind: 'door', ids: [door.id] })}>
          Delete door
        </button>
      </div>
    </div>
  );
}

/** The first suggested entrance name not used yet. */
function nextEntranceName() {
  const used = new Set(useProjectStore.getState().venue.doors.map((d) => d.entrance));
  return ENTRANCE_NAMES.find((n) => !used.has(n)) ?? 'Stage entrance';
}

/** Right side in Venue mode: the selection's properties, or an overview. */
export function VenueProperties() {
  const units = useProjectStore((s) => s.units);
  const venue = useProjectStore((s) => s.venue);
  const selected = useVenueUI((s) => s.selected);
  const cutaway = useVenueUI((s) => s.cutaway);
  const { walls, rooms, doors, furniture } = venue;

  if (selected?.kind === 'wall') {
    const wall = walls.find((w) => w.id === selected.id);
    if (wall)
      return (
        <div className="props">
          <Head title="Wall" />
          {WALL_FIELDS.map((def) => (
            <Field
              key={def.key}
              def={def}
              value={def.key === 'length' ? wallLength(wall) : (wall as unknown as Record<string, number | string>)[def.key]}
              units={units}
              onChange={(v) => (def.key === 'length' ? venueActions.setLength(wall.id, v as number) : venueActions.patchWall(wall.id, { [def.key]: v }))}
            />
          ))}
          <p className="hint">
            {doors.filter((d) => d.wallId === wall.id).length} door(s) in this wall
          </p>
          <div className="btn-row">
            <button className="btn btn--danger" onClick={() => removePick({ domain: 'venue', kind: 'wall', ids: [wall.id] })} title="Delete (Delete key)">
              Delete wall
            </button>
          </div>
        </div>
      );
  }
  if (selected?.kind === 'room') {
    const room = rooms.find((r) => r.id === selected.id);
    if (room) {
      const { polygon, closed } = roomOutline(walls, room);
      return (
        <div className="props">
          <Head title="Room" />
          <label className="field">
            <span className="field__label">Name</span>
            <input className="field__input" value={room.name} onChange={(e) => venueActions.patchRoom(room.id, { name: e.target.value }, `room-name:${room.id}`)} />
          </label>
          <p className="hint">Area {formatArea(polygonArea(polygon), units)}</p>
          {!closed && <p className="panel-msg panel-msg--warning">The walls around this room no longer close it in; it shows its last outline.</p>}
          {ROOM_FIELDS.map((def) => (
            <Field
              key={def.key}
              def={def}
              value={(room as unknown as Record<string, number | string>)[def.key]}
              units={units}
              onChange={(v) => (def.key === 'wallHeight' ? venueActions.setRoomWallHeight(room.id, v as number, polygon) : venueActions.patchRoom(room.id, { [def.key]: v }))}
            />
          ))}
          <div className="btn-row">
            <button className="btn btn--danger" onClick={() => removePick({ domain: 'venue', kind: 'room', ids: [room.id] })} title="Removes the room label and floor; its walls stay">
              Delete room
            </button>
          </div>
        </div>
      );
    }
  }
  if (selected?.kind === 'door') {
    const door = doors.find((d) => d.id === selected.id);
    if (door) return <DoorProps door={door} />;
  }
  if (selected?.kind === 'furniture') {
    const item = furniture.find((f) => f.id === selected.id);
    const f = item && getFurniture(item.type);
    if (item && f) {
      const inRoom = roomAt(walls, rooms, [item.x, item.z]);
      return (
        <div className="props">
          <Head title={f.label} />
          <p className="hint">{inRoom ? `In ${inRoom.name}` : 'Not inside a room'}</p>
          <Field
            def={{ key: 'rotation', label: 'Rotation (°)', group: '', type: 'number', unit: 'none', default: 0, min: -180, max: 180, step: 15 }}
            value={item.rotation}
            units={units}
            onChange={(v) => venueActions.patchFurniture(item.id, { rotation: v as number })}
          />
          <div className="btn-row">
            <button className="btn btn--danger" onClick={() => removePick({ domain: 'venue', kind: 'furniture', ids: [item.id] })}>
              Delete
            </button>
          </div>
        </div>
      );
    }
  }
  if (selected?.kind === 'route') {
    const route = venue.routes.find((r) => r.id === selected.id);
    if (route) {
      const res = solveRoute(venue, route);
      return (
        <div className="props">
          <Head title="Route" />
          <label className="field">
            <span className="field__label">Name</span>
            <input className="field__input" value={route.name} onChange={(e) => venueActions.patchRoute(route.id, { name: e.target.value }, `route-name:${route.id}`)} />
          </label>
          <p className="hint">
            From {endName(venue, route.from)} to {endName(venue, route.to)}
          </p>
          {res.path ? (
            <dl className="route-stats">
              <dt>Distance</dt>
              <dd>{formatLength(res.length, units)}</dd>
              <dt>Walking (1.2 m/s)</dt>
              <dd>{formatTime(res.length / WALK)}</dd>
              <dt>Hurrying (2 m/s)</dt>
              <dd>{formatTime(res.length / HURRY)}</dd>
            </dl>
          ) : (
            <p className="panel-msg panel-msg--warning">No way through — the walls close it off. Add a door between those spaces.</p>
          )}
          {res.audience.length > 0 && <p className="panel-msg panel-msg--warning">Passes through {res.audience.join(', ')} — an audience area during the show.</p>}
          <label className="field field--inline">
            <span className="field__label">Show on the plan</span>
            <button type="button" role="switch" aria-checked={route.visible} className={`switch ${route.visible ? 'is-on' : ''}`} onClick={() => venueActions.patchRoute(route.id, { visible: !route.visible })}>
              <span className="switch__knob" />
            </button>
          </label>
          <div className="btn-row">
            <button className="btn btn--danger" onClick={() => removePick({ domain: 'venue', kind: 'route', ids: [route.id] })}>
              Delete route
            </button>
          </div>
        </div>
      );
    }
  }
  const total = walls.reduce((t, w) => t + wallLength(w), 0);
  return (
    <div className="props">
      <div className="panel-head">
        <h2 className="panel-title">Venue</h2>
      </div>
      <p className="sidebar__empty">{walls.length === 0 ? 'Nothing drawn yet. Use Draw on the left to draw the walls of the building around your stage.' : 'Click anything on the plan to edit it. The stage and seating show in grey.'}</p>
      <p className="hint">
        {walls.length} wall{walls.length === 1 ? '' : 's'}
        {walls.length ? ` · ${formatLength(total, units)} in total` : ''}
      </p>
      <label className="field field--inline">
        <span className="field__label">Cut-away 3D view</span>
        <button type="button" role="switch" aria-checked={cutaway} className={`switch ${cutaway ? 'is-on' : ''}`} onClick={() => useVenueUI.getState().toggleCutaway()}>
          <span className="switch__knob" />
        </button>
      </label>
      <p className="hint">Everything you draw is listed in Layers, where you can delete it piece by piece.</p>
      <ClearVenue />
    </div>
  );
}

/** Split / plan / 3D toggle and the cut-away button, over the venue views. */
export function VenueViewBar() {
  const layout = useVenueUI((s) => s.layout);
  const cutaway = useVenueUI((s) => s.cutaway);
  return (
    <div className="venue-bar">
      <div className="segmented" role="group" aria-label="Venue layout">
        {(['split', 'plan', '3d'] as const).map((l) => (
          <button key={l} className={layout === l ? 'is-active' : ''} onClick={() => useVenueUI.getState().setLayout(l)}>
            {l === 'split' ? 'Split' : l === 'plan' ? 'Plan' : '3D'}
          </button>
        ))}
      </div>
      {layout !== 'plan' && (
        <button className={`btn ${cutaway ? 'is-active' : ''}`} onClick={() => useVenueUI.getState().toggleCutaway()} title="Lower every wall to 1 m in 3D to look into the rooms">
          Cut-away
        </button>
      )}
    </div>
  );
}
