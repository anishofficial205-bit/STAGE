import { useMemo } from 'react';
import { useActiveBlocking, useProjectStore } from '../../store/useProjectStore';
import { computeEntrances } from '../../blocking/entrances';
import { sceneDuration, sceneTracks } from '../../blocking/motion';

/** Length (s) and name of the current scene. */
export function useSceneDuration() {
  const b = useActiveBlocking();
  const s = useProjectStore();
  return useMemo(() => {
    const scene = b.scenes.find((x) => x.id === b.sceneId) ?? b.scenes[0];
    const map = new Map(computeEntrances(s, b).map((e) => [e.id, e]));
    return { duration: sceneDuration(sceneTracks(scene, b.performers, map)), name: scene.name };
  }, [b, s.templateId, s.objectsByTemplate, s.venue, s.paramsByTemplate]); // eslint-disable-line react-hooks/exhaustive-deps
}
