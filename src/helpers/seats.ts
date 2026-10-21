import type { SeatInfo, Vec3 } from '../types';
import type { SeatPlacement } from './Seating';

/** Row letters: A–Z, then AA, AB… (I and O are skipped, as in most theatres). */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function rowLetter(i: number): string {
  return i < LETTERS.length ? LETTERS[i] : rowLetter(Math.floor(i / LETTERS.length) - 1) + LETTERS[i % LETTERS.length];
}

/**
 * World-space seats for a seating block placed at `position` and turned by
 * `rotationY` (the same placement the <Seating> component gets).
 */
export function blockSeats(placements: SeatPlacement[], position: Vec3, rotationY: number, block: string): SeatInfo[] {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return placements.map((p) => {
    const row = p.row ?? 0;
    const num = p.seat ?? 0;
    return {
      x: position[0] + p.x * c + p.z * s,
      y: position[1] + p.y,
      z: position[2] - p.x * s + p.z * c,
      facing: p.rotY + rotationY,
      block,
      row,
      num,
      label: `${block ? `${block} ` : ''}${rowLetter(row)}${num}`,
    };
  });
}
