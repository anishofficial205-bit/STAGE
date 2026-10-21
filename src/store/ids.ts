let idCounter = 0;
/** Unique id for objects and groups. */
export const newObjectId = () => `o${Date.now().toString(36)}${(idCounter++).toString(36)}`;
