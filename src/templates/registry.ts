/**
 * Template registry. To add a stage type, create /templates/<name>/index.tsx
 * exporting a StageTemplate and add it to this list. Nothing else in the app
 * needs to change: the picker, properties panel and views read from here.
 */
import type { StageTemplate } from '../types';
import { placeholderTemplate } from './placeholder';
import { prosceniumTemplate } from './proscenium';
import { endStageTemplate } from './endStage';
import { thrustTemplate } from './thrust';

export const templates: StageTemplate[] = [placeholderTemplate, prosceniumTemplate, endStageTemplate, thrustTemplate];

export const getTemplate = (id: string) => templates.find((t) => t.id === id);
