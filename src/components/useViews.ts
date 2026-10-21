import { useMemo } from 'react';
import { getTemplate } from '../templates/registry';
import { useActiveParams, useProjectStore } from '../store/useProjectStore';
import { resetView, topView } from '../helpers/views';
import type { PresetView } from '../types';

/** The active template's preset views, plus the app's own Top view and Reset view. */
export function useViews(): PresetView[] {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const aspect = useProjectStore((s) => s.viewportAspect);
  return useMemo(() => {
    const t = getTemplate(templateId)!;
    const b = t.bounds(params);
    return [...t.presetViews(params), topView(b, aspect), resetView(b, aspect)];
  }, [templateId, params, aspect]);
}
