import { useMemo } from 'react';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { getStageInfo } from '../helpers/stageInfo';
import { isOffStage, place } from './geometry';

/** IDs of objects that are partly off the stage (shown with a warning). */
export function useOffStageIds() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  const objects = useActiveObjects();
  return useMemo(() => {
    const info = getStageInfo(getTemplate(templateId)!, params, data);
    return new Set(
      objects
        .filter((o) => {
          const p = place(o, info);
          return p && isOffStage(p, info);
        })
        .map((o) => o.id),
    );
  }, [templateId, params, data, objects]);
}
