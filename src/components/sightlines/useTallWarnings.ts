import { useMemo } from 'react';
import { useActiveObjects, useProjectStore } from '../../store/useProjectStore';
import { place, type Placed } from '../../objects/geometry';
import { placementOf } from '../../objects/types';
import { inherited } from '../../objects/groups';
import { floorHeightAt } from '../../helpers/stageInfo';
import { tallWarnings, type TallWarning } from '../../sightlines/compute';
import { useSightlines } from '../../sightlines/store';
import { useStageSeats } from './useStageSeats';

/** Stages with audience round the acting area, where tall pieces block someone's view. */
const SURROUND = ['in-the-round', 'thrust', 'traverse'];
const NONE: TallWarning[] = [];

export function useTallWarnings(): TallWarning[] {
  const templateId = useProjectStore((s) => s.templateId);
  const objects = useActiveObjects();
  const threshold = useSightlines((s) => s.tallThreshold);
  const { seats, info, targets } = useStageSeats();
  return useMemo(() => {
    if (!SURROUND.includes(templateId) || !seats.length) return NONE;
    const placed = objects
      .filter((o) => !inherited(o, objects, 'hidden'))
      .map((o) => place(o, info))
      .filter((p): p is Placed => !!p && placementOf(p.type, p.obj.params) !== 'hanging');
    return tallWarnings(placed, seats, targets, threshold, (x, z) => floorHeightAt(info, x, z));
  }, [templateId, objects, threshold, seats, info, targets]);
}
