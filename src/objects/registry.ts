/**
 * Object registry. To add a set piece, create /objects/<name>/index.tsx
 * exporting a SetObjectType and add it here. The library, properties panel,
 * handles and layers all read from this list.
 */
import type { SetObjectType } from './types';
import { boxObject } from './box';
import { floorDecalObject } from './floorDecal';
import { flatObject } from './flat';
import { flatOpeningObject } from './flatOpening';
import { wallRunObject } from './wallRun';
import { backdropObject } from './backdrop';
import { platformObject } from './platform';
import { roundPlatformObject } from './roundPlatform';
import { stepsObject } from './steps';
import { rampObject } from './ramp';
import { columnObject } from './column';
import { archFrameObject } from './archFrame';
import { curvedWallObject } from './curvedWall';
import { cycloramaObject } from './cyclorama';
import { doorFrameObject } from './doorFrame';
import { windowFrameObject } from './windowFrame';
import { staircaseObject } from './staircase';
import { trussObject } from './truss';
import { trussFrameObject } from './trussFrame';
import { ledWallObject } from './ledWall';
import { projectionScreenObject } from './projectionScreen';
import { bannerObject } from './banner';
import { hangingPanelObject } from './hangingPanel';
import { fixtureObject } from './fixture';
import { mainCurtainObject } from './curtains/mainCurtain';
import { valanceObject } from './curtains/valance';
import { borderObject, cycClothObject, legObject, scrimObject, stageSkirtObject, travelerObject } from './curtains/drapes';
import { propObjects } from './props';
import { photoPropObject } from './photoProp';
import { showpieceObjects } from './showpieces';

export const objectTypes: SetObjectType[] = [
  boxObject,
  floorDecalObject,
  flatObject,
  flatOpeningObject,
  wallRunObject,
  backdropObject,
  platformObject,
  roundPlatformObject,
  stepsObject,
  rampObject,
  columnObject,
  archFrameObject,
  curvedWallObject,
  cycloramaObject,
  doorFrameObject,
  windowFrameObject,
  staircaseObject,
  trussObject,
  trussFrameObject,
  ledWallObject,
  projectionScreenObject,
  bannerObject,
  hangingPanelObject,
  mainCurtainObject,
  valanceObject,
  legObject,
  borderObject,
  travelerObject,
  cycClothObject,
  scrimObject,
  stageSkirtObject,
  fixtureObject,
  ...propObjects,
  ...showpieceObjects,
  photoPropObject,
];

/** Old type ids still found in saved projects. */
const RENAMED: Record<string, string> = { block: 'box' };

export const getObjectType = (id: string) => objectTypes.find((t) => t.id === (RENAMED[id] ?? id));

/** Categories in library order. */
export const objectCategories = () => [...new Set(objectTypes.filter((t) => t.library !== false).map((t) => t.category))];
