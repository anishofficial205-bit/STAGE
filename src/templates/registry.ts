/**
 * Template registry. To add a stage type, create /templates/<name>/index.tsx
 * exporting a StageTemplate and add it to this list. Nothing else in the app
 * needs to change: the picker, properties panel and views read from here.
 */
import type { StageTemplate } from '../types';
import { prosceniumTemplate } from './proscenium';
import { endStageTemplate } from './endStage';
import { thrustTemplate } from './thrust';
import { inTheRoundTemplate } from './inTheRound';
import { traverseTemplate } from './traverse';
import { openAirTemplate } from './openAir';
import { blackBoxTemplate } from './blackBox';
import { customTemplate } from './custom';

export const templates: StageTemplate[] = [prosceniumTemplate, endStageTemplate, thrustTemplate, inTheRoundTemplate, traverseTemplate, blackBoxTemplate, openAirTemplate, customTemplate];

export const getTemplate = (id: string) => templates.find((t) => t.id === id);
