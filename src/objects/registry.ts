/**
 * Object registry. To add a set piece, create /objects/<name>/index.tsx
 * exporting a SetObjectType and add it here. The library, properties panel,
 * handles and layers all read from this list.
 */
import type { SetObjectType } from './types';
import { boxObject } from './box';
import { flatObject } from './flat';
import { flatOpeningObject } from './flatOpening';
import { wallRunObject } from './wallRun';
import { backdropObject } from './backdrop';
import { platformObject } from './platform';
import { roundPlatformObject } from './roundPlatform';
import { stepsObject } from './steps';
import { rampObject } from './ramp';

export const objectTypes: SetObjectType[] = [
  boxObject,
  flatObject,
  flatOpeningObject,
  wallRunObject,
  backdropObject,
  platformObject,
  roundPlatformObject,
  stepsObject,
  rampObject,
];

/** Old type ids still found in saved projects. */
const RENAMED: Record<string, string> = { block: 'box' };

export const getObjectType = (id: string) => objectTypes.find((t) => t.id === (RENAMED[id] ?? id));

/** Categories in library order. */
export const objectCategories = () => [...new Set(objectTypes.map((t) => t.category))];
