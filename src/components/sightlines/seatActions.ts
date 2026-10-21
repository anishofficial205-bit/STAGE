import { useProjectStore } from '../../store/useProjectStore';
import { useSightlines } from '../../sightlines/store';
import { collectOccluders, eyeOf, stageTargets, whatBlocks } from '../../sightlines/compute';
import { getTemplate } from '../../templates/registry';
import { getStageInfo } from '../../helpers/stageInfo';
import { viewportBridge } from '../../objects/ui';
import type { PresetView, SeatInfo, Vec3 } from '../../types';

function stageNow() {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const params = s.paramsByTemplate[s.templateId];
  const data = s.dataByTemplate[s.templateId];
  const info = getStageInfo(t, params, data);
  return { seats: t.seats?.(params, data) ?? [], targets: stageTargets(info) };
}

/** The view from a seat: eye height above the seat floor, looking at the middle of the acting area. */
export function seatViewOf(seat: SeatInfo): PresetView {
  const { targets } = stageNow();
  const look: Vec3 = [0, 0, 0];
  for (const t of targets) for (let k = 0; k < 3; k++) look[k] += t[k] / targets.length;
  return { id: `seat:${seat.label}`, label: seat.label, position: eyeOf(seat), target: look };
}

/** Sit in a seat: move the camera there and refresh "what's blocking" if it's showing. */
export function goToSeat(seat: SeatInfo) {
  const sl = useSightlines.getState();
  useProjectStore.getState().requestView(seatViewOf(seat));
  sl.set({ current: seat, blocking: sl.blocking ? blockingFor(seat) : null });
}

export function blockingFor(seat: SeatInfo) {
  const scene = viewportBridge.three?.scene;
  if (!scene) return null;
  return whatBlocks(seat, stageNow().targets, collectOccluders(scene));
}

/** Step to a neighbouring seat: same block, seat ±1 in the row, or the same seat number a row behind/in front. */
export function stepSeat(dSeat: number, dRow: number) {
  const cur = useSightlines.getState().current;
  if (!cur) return;
  const block = stageNow().seats.filter((s) => s.block === cur.block);
  let next: SeatInfo | undefined;
  if (dSeat) next = block.find((s) => s.row === cur.row && s.num === cur.num + dSeat);
  if (dRow) {
    const row = block.filter((s) => s.row === cur.row + dRow);
    next = row.find((s) => s.num === cur.num) ?? row.sort((a, b) => Math.abs(a.num - cur.num) - Math.abs(b.num - cur.num))[0];
  }
  if (next) goToSeat(next);
}
