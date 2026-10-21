import { useMemo } from 'react';
import { useActiveData, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { getTemplate } from '../../templates/registry';
import { getStageInfo } from '../../helpers/stageInfo';
import { stageTargets } from '../../sightlines/compute';
import type { SeatInfo } from '../../types';

const NONE: SeatInfo[] = [];

/** The current stage's seats, stage info and sightline targets. */
export function useStageSeats() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  return useMemo(() => {
    const t = getTemplate(templateId)!;
    const info = getStageInfo(t, params, data);
    return { seats: t.seats?.(params, data) ?? NONE, info, targets: stageTargets(info) };
  }, [templateId, params, data]);
}
