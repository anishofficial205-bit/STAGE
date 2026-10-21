/**
 * Object registry. To add a set piece, create /objects/<name>/index.tsx
 * exporting a SetObjectType and add it here. The library, properties panel,
 * handles and layers all read from this list.
 */
import type { SetObjectType } from './types';
import { blockObject } from './block';

export const objectTypes: SetObjectType[] = [blockObject];

export const getObjectType = (id: string) => objectTypes.find((t) => t.id === id);

/** Categories in library order. */
export const objectCategories = () => [...new Set(objectTypes.map((t) => t.category))];
