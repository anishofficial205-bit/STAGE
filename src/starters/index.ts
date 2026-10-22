/**
 * Starter sets: example sets per stage template that users can load and edit.
 * Positions are relative to the stage centre and sized for each template's
 * default dimensions. Loading one replaces the current set (and can be undone).
 */
import type { Params } from '../types';

export interface StarterPiece {
  type: string;
  name?: string;
  x: number;
  z: number;
  rotation?: number;
  elevation?: number;
  params?: Params;
}

export interface StarterSet {
  id: string;
  name: string;
  description: string;
  pieces: StarterPiece[];
}

const P = (type: string, x: number, z: number, params: Params = {}, extra: Partial<StarterPiece> = {}): StarterPiece => ({ type, x, z, params, ...extra });

export const STARTER_SETS: Record<string, StarterSet[]> = {
  proscenium: [
    {
      id: 'living-room',
      name: 'Living room',
      description: 'A box set with a door and window, sofa, armchair and coffee table.',
      pieces: [
        P('wall-run', 0, -2.5, { panels: 3, panelWidth: 4.8, height: 3, angle: 90 }, { name: 'Box set walls' }),
        P('door-frame', -1.4, -4.8, { width: 1.1, height: 2.2, doorAngle: 25 }, { name: 'Front door' }),
        P('window-frame', 1.3, -4.83, { width: 1.4, height: 1.2, panes: 6 }, { name: 'Window', params: { width: 1.4, height: 1.2, panes: 6, sillHeight: 0.9 } }),
        P('sofa', 0, -2.2, { width: 2.1 }),
        P('chair', -1.9, -0.8, { style: 'armchair' }, { rotation: 35, name: 'Armchair' }),
        P('table', 0, -0.9, { shape: 'round', diameter: 0.8, height: 0.45 }, { name: 'Coffee table' }),
        P('plant', 2.0, -4.1, { height: 1.3 }),
        P('person-standing', 1.4, -0.4, { height: 1.75 }, { rotation: -20, name: 'Actor (scale)' }),
      ],
    },
    {
      id: 'concert',
      name: 'Concert',
      description: 'Drum riser, LED wall, speakers and microphone stands for a band.',
      pieces: [
        P('led-wall', 0, -4.4, { panelsWide: 16, panelsHigh: 7 }, { name: 'LED wall' }),
        P('drum-riser', 0, -2.4, { width: 2.4, depth: 2.4 }),
        P('mic-stand', -2.5, 1.2),
        P('mic-stand', 0, 1.6, { boom: true }),
        P('mic-stand', 2.5, 1.2),
        P('speaker', -5, 3.6, { speakerSize: 'large' }, { name: 'Speaker L' }),
        P('speaker', 5, 3.6, { speakerSize: 'large' }, { name: 'Speaker R' }),
        P('speaker', -1.2, 3, { kind: 'wedge', speakerSize: 'small' }, { rotation: 180, name: 'Monitor 1' }),
        P('speaker', 1.2, 3, { kind: 'wedge', speakerSize: 'small' }, { rotation: 180, name: 'Monitor 2' }),
      ],
    },
    {
      id: 'grand-staircase',
      name: 'Grand staircase',
      description: 'A sweeping staircase under a pointed arch, framed by columns.',
      pieces: [
        P('arch-frame', 0, -4.5, { outerWidth: 6.5, outerHeight: 6, openingWidth: 4.4, openingHeight: 5, topShape: 'pointed', thickness: 0.4 }),
        P('staircase', 0, -2.4, { width: 3, steps: 14, totalHeight: 2.4 }),
        P('platform', 0, -4.2, { width: 3.6, depth: 1.2, heightPreset: 'custom', customHeight: 2.4 }, { name: 'Landing' }),
        P('column', -3.5, -1.5, { height: 4.5, diameter: 0.5 }),
        P('column', 3.5, -1.5, { height: 4.5, diameter: 0.5 }),
        P('column', -3.5, 1.5, { height: 4.5, diameter: 0.5 }),
        P('column', 3.5, 1.5, { height: 4.5, diameter: 0.5 }),
      ],
    },
  ],
  'end-stage': [
    {
      id: 'keynote',
      name: 'Keynote / conference',
      description: 'Projection screen, lectern, panel chairs and plants.',
      pieces: [
        P('projection-screen', -1, -2.6, { width: 5 }),
        P('lectern', 3.8, 1.5, {}, { rotation: -20 }),
        P('chair', -4.6, 1.6, { style: 'armchair' }, { rotation: 25, name: 'Panel chair 1' }),
        P('chair', -3.3, 2.1, { style: 'armchair' }, { rotation: 10, name: 'Panel chair 2' }),
        P('table', -4, 2.6, { shape: 'round', diameter: 0.6, height: 0.5 }, { name: 'Side table' }),
        P('plant', -5.4, -3.2, { height: 1.6 }),
        P('plant', 5.4, -3.2, { height: 1.6 }),
      ],
    },
    {
      id: 'school-play',
      name: 'School play',
      description: 'A wall of flats, a raised platform with steps and some scenery.',
      pieces: [
        P('wall-run', 0, -3.6, { panels: 5, panelWidth: 2.4, height: 3, angle: 0 }, { name: 'Back flats' }),
        P('platform', 2.2, -1.6, { width: 2.4, depth: 1.2 }),
        P('steps', 2.2, -0.55, { width: 1.2, steps: 2, totalHeight: 0.4, stepDepth: 0.3 }),
        P('flat-opening', -3.6, -1.4, { width: 2.2, openingType: 'window', openingWidth: 1, openingHeight: 1 }, { rotation: 20, name: 'Cottage wall' }),
        P('plant', -1.2, -2.6, { height: 2.2 }, { name: 'Tree' }),
        P('stool', 0, 0.8),
      ],
    },
  ],
  thrust: [
    {
      id: 'shakespeare',
      name: 'Shakespearean',
      description: 'A columned upstage with a central arch over a raised balcony platform.',
      pieces: [
        P('arch-frame', 0, -5.6, { outerWidth: 5, outerHeight: 5, openingWidth: 3, openingHeight: 3.8, topShape: 'rounded', thickness: 0.4 }),
        P('column', -3.2, -3, { height: 4.5, diameter: 0.45 }),
        P('column', 3.2, -3, { height: 4.5, diameter: 0.45 }),
        P('platform', -4.2, -5.2, { width: 2.4, depth: 1.2, heightPreset: '0.8' }, { name: 'Balcony' }),
        P('steps', -4.2, -4.1, { width: 1.2, steps: 4, totalHeight: 0.8 }),
        P('stool', 1.5, 1),
        P('person-standing', 0, 2.5, { height: 1.75 }, { name: 'Actor (scale)' }),
      ],
    },
    {
      id: 'courtroom',
      name: 'Courtroom',
      description: "Judge's bench on a platform, counsel tables and a witness stand.",
      pieces: [
        P('platform', 0, -4.6, { width: 4, depth: 1.6, heightPreset: '0.4' }, { name: 'Bench platform' }),
        P('box', 0, -4.2, { width: 3, depth: 0.6, height: 1.1 }, { name: "Judge's bench", elevation: 0 }),
        P('chair', 0, -5, { style: 'armchair' }, { name: "Judge's chair" }),
        P('table', -2.2, 1.5, { width: 1.8, depth: 0.8 }, { name: 'Defence table' }),
        P('table', 2.2, 1.5, { width: 1.8, depth: 0.8 }, { name: 'Prosecution table' }),
        P('chair', -2.6, 2.2, {}, { rotation: 180 }),
        P('chair', -1.8, 2.2, {}, { rotation: 180 }),
        P('chair', 1.8, 2.2, {}, { rotation: 180 }),
        P('chair', 2.6, 2.2, {}, { rotation: 180 }),
        P('lectern', 3.2, -2, {}, { rotation: -40, name: 'Witness stand' }),
      ],
    },
  ],
  'in-the-round': [
    {
      id: 'arena-concert',
      name: 'Arena concert',
      description: 'A central drum riser with performers facing every section.',
      pieces: [
        P('drum-riser', 0, 0, { width: 2.4, depth: 2.4 }),
        P('mic-stand', 0, 2.6, { boom: true }),
        P('mic-stand', 2.6, 0, {}, { rotation: 90 }),
        P('mic-stand', -2.6, 0, {}, { rotation: -90 }),
        P('speaker', 0, 3.4, { kind: 'wedge', speakerSize: 'small' }, { rotation: 180, name: 'Monitor' }),
        P('person-standing', 0, 2.2, { height: 1.75 }, { name: 'Singer (scale)' }),
      ],
    },
    {
      id: 'boxing',
      name: 'Boxing night',
      description: 'Corner posts and stools — all kept low so every section can see.',
      pieces: [
        P('column', -2.8, -2.8, { shape: 'square', diameter: 0.15, height: 1.4, baseCapital: false }, { name: 'Corner post 1' }),
        P('column', 2.8, -2.8, { shape: 'square', diameter: 0.15, height: 1.4, baseCapital: false }, { name: 'Corner post 2' }),
        P('column', 2.8, 2.8, { shape: 'square', diameter: 0.15, height: 1.4, baseCapital: false }, { name: 'Corner post 3' }),
        P('column', -2.8, 2.8, { shape: 'square', diameter: 0.15, height: 1.4, baseCapital: false }, { name: 'Corner post 4' }),
        P('stool', -2.3, -2.3, { height: 0.6 }),
        P('stool', 2.3, 2.3, { height: 0.6 }),
        P('floor-decal', 0, 0, { width: 2, depth: 2 }, { name: 'Centre logo' }),
      ],
    },
  ],
  traverse: [
    {
      id: 'fashion-show',
      name: 'Fashion show',
      description: 'An LED wall at the entrance, plants along the runway and speakers at the far end.',
      pieces: [
        P('led-wall', 0, -9.4, { panelsWide: 10, panelsHigh: 6 }, { name: 'Entrance screen' }),
        P('plant', -1.6, -5, { height: 0.9, pot: 0.3 }),
        P('plant', 1.6, -5, { height: 0.9, pot: 0.3 }),
        P('plant', -1.6, 3, { height: 0.9, pot: 0.3 }),
        P('plant', 1.6, 3, { height: 0.9, pot: 0.3 }),
        P('speaker', -1.6, 9.6, { speakerSize: 'medium' }, { rotation: 180, name: 'Speaker L' }),
        P('speaker', 1.6, 9.6, { speakerSize: 'medium' }, { rotation: 180, name: 'Speaker R' }),
        P('person-standing', 0, 0, { height: 1.8 }, { name: 'Model (scale)' }),
      ],
    },
    {
      id: 'arch-walk',
      name: 'Arch walk',
      description: 'A procession of arches down the runway.',
      pieces: [-7, -3, 1, 5].map((z, i) =>
        P('arch-frame', 0, z, { outerWidth: 3.8, outerHeight: 3.6, openingWidth: 3, openingHeight: 3, thickness: 0.25, topShape: i % 2 ? 'multifoil' : 'rounded' }, { name: `Arch ${i + 1}` }),
      ),
    },
  ],
  'black-box': [
    {
      id: 'studio-drama',
      name: 'Studio drama',
      description: 'A small interior on the platforms: door, sofa, table and chair.',
      pieces: [
        P('flat-opening', -2, -9.3, { width: 2.4, openingType: 'door' }, { name: 'Door flat' }),
        P('flat', 1.2, -9.3, { width: 2.4, height: 2.4 }),
        P('sofa', 0, -7.8, { width: 1.8 }),
        P('table', 2.2, -6.8, { width: 1, depth: 0.7 }),
        P('chair', 2.2, -6.1, {}, { rotation: 180 }),
      ],
    },
    {
      id: 'rehearsal',
      name: 'Rehearsal',
      description: 'Stools and music stands in a semicircle.',
      pieces: [-2.4, -1.2, 0, 1.2, 2.4].flatMap((x, i) => [
        P('stool', x, -6.4 + Math.abs(x) * 0.3, { height: 0.6 }, { name: `Stool ${i + 1}` }),
        P('mic-stand', x, -5.7 + Math.abs(x) * 0.3, { height: 1.1 }, { name: `Stand ${i + 1}` }),
      ]),
    },
  ],
  'open-air': [
    {
      id: 'festival-band',
      name: 'Festival band',
      description: 'LED wall, drum riser, side-fill speakers and lights on the truss.',
      pieces: [
        P('led-wall', 0, -4.2, { panelsWide: 18, panelsHigh: 8 }, { name: 'LED wall' }),
        P('drum-riser', 0, -2, { width: 3, depth: 2.4 }),
        P('mic-stand', -3, 2),
        P('mic-stand', 0, 2.6, { boom: true }),
        P('mic-stand', 3, 2),
        P('speaker', -6.2, 3.8, { speakerSize: 'large' }, { name: 'Side fill L' }),
        P('speaker', 6.2, 3.8, { speakerSize: 'large' }, { name: 'Side fill R' }),
        ...[-6, -3, 0, 3, 6].map((x, i) => P('fixture', x, -4.5, { kind: i % 2 ? 'par' : 'spot', tilt: 35 }, { name: `Light ${i + 1}`, elevation: 5.93 })),
      ],
    },
    {
      id: 'wedding',
      name: 'Wedding stage',
      description: 'A floral arch with the couple’s chairs and an officiant’s lectern.',
      pieces: [
        P('arch-frame', 0, -3, { outerWidth: 3.4, outerHeight: 3.6, openingWidth: 2.4, openingHeight: 3, thickness: 0.2, topShape: 'rounded' }, { name: 'Wedding arch' }),
        P('plant', -2.1, -2.8, { height: 1.4 }),
        P('plant', 2.1, -2.8, { height: 1.4 }),
        P('lectern', 0, -1.6, { width: 0.6 }, { name: "Officiant's lectern" }),
        P('chair', -0.6, 0.6, {}, { rotation: 180, name: 'Chair 1' }),
        P('chair', 0.6, 0.6, {}, { rotation: 180, name: 'Chair 2' }),
      ],
    },
  ],
};
