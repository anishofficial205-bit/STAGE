import type { ReactNode } from 'react';
import { Collapsible } from './Collapsible';

/**
 * The rest of a panel's controls, collapsed by default. Remembers whether you
 * opened it (per panel). Nothing is ever removed — it moves in here.
 */
export function MoreOptions({ id, children, title = 'More options' }: { id: string; children: ReactNode; title?: string }) {
  return (
    <div className="more-options">
      <Collapsible id={`more:${id}`} title={title} defaultOpen={false}>
        {children}
      </Collapsible>
    </div>
  );
}
