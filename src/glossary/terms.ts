/**
 * The glossary: every technical term the interface uses, with a plain label
 * (shown first) and a one-sentence explanation (shown on hover). Exports for
 * crews — the lighting plan, blocking sheets and spec sheets — keep the
 * technical terms and don't use this.
 */
export interface Term {
  /** The theatre / technical term. */
  tech: string;
  /** What most people would call it. */
  plain: string;
  /** One sentence. */
  explain: string;
}

const T = (tech: string, plain: string, explain: string): Term => ({ tech, plain, explain });

/** Exact matches (case-insensitive) on the technical text. */
export const TERMS: Term[] = [
  // Lights
  T('Profile / spot', 'Spotlight (sharp edge)', 'A light with a hard-edged beam you can shape with shutters or a pattern (gobo).'),
  T('Fresnel', 'Soft light', 'A light with a soft-edged beam, good for an even wash that blends.'),
  T('PAR / wash', 'Flood light', 'A simple, bright light with a wide oval beam.'),
  T('Cyc light / LED bar', 'Backdrop light', 'A wide, even light for washing a backdrop or cyclorama in colour.'),
  T('Moving head', 'Moving light', 'A light that can pan, tilt and change colour by itself.'),
  T('Follow spot', 'Follow spotlight', 'A spotlight an operator aims by hand to follow a performer.'),
  T('Electric', 'Light bar above the stage', 'A pipe over the stage that lights hang from (theatre crews call it an “electric”).'),
  T('Electric (lighting batten)', 'Light bar above the stage', 'A pipe over the stage that lights hang from (theatre crews call it an “electric”).'),
  T('FOH truss', 'Lights above the audience', 'A truss over the audience for lights that face the stage from the front (FOH = front of house).'),
  T('Front-of-house truss', 'Lights above the audience', 'A truss over the audience for lights that face the stage from the front.'),
  T('Boom', 'Side light pole', 'An upright pole in the wings for lights that shine across the stage from the side.'),
  T('Haze', 'Visible beams (haze)', 'A thin mist that makes the light beams visible in the air.'),
  T('Haze (visible beams)', 'Visible beams (haze)', 'A thin mist that makes the light beams visible in the air.'),
  T('Renumber channels', 'Renumber lights', 'Give the lights new control numbers (channels) in order across the rig.'),
  T('Light plot', 'Lighting plan (printable)', 'A drawing of where every light hangs, for the crew who rig them.'),
  T('Gobo', 'Light pattern', 'A small stencil in a spotlight that projects a pattern, such as leaves or windows.'),
  // Stage directions and places
  T('Upstage', 'Back of stage', 'The part of the stage furthest from the audience.'),
  T('Downstage', 'Front of stage', 'The part of the stage nearest the audience.'),
  T('Stage left', 'Stage left (performer’s left)', 'Left as seen by a performer facing the audience — the audience’s right.'),
  T('Stage right', 'Stage right (performer’s right)', 'Right as seen by a performer facing the audience — the audience’s left.'),
  T('Stage left wing', 'Side view (performer’s left)', 'Looking from the side area on the performer’s left.'),
  T('Stage right wing', 'Side view (performer’s right)', 'Looking from the side area on the performer’s right.'),
  T('wings', 'Side areas (hidden from audience)', 'The spaces at the sides of the stage where performers wait out of sight.'),
  T('Wings', 'Side areas (hidden from audience)', 'The spaces at the sides of the stage where performers wait out of sight.'),
  T('DSL vom', 'Front-left tunnel entrance', 'A tunnel through the audience seating that performers use to enter (vomitory), downstage left.'),
  T('DSR vom', 'Front-right tunnel entrance', 'A tunnel through the audience seating that performers use to enter (vomitory), downstage right.'),
  T('House left aisle', 'Audience aisle, left', 'An aisle through the audience on the audience’s left (“house left”).'),
  T('House right aisle', 'Audience aisle, right', 'An aisle through the audience on the audience’s right (“house right”).'),
  T('house', 'Audience area', 'The part of the venue where the audience sits (“the house”).'),
  // Scenery and drapes
  T('Flat', 'Wall panel', 'A lightweight wall panel used to build sets (a “flat”).'),
  T('Flat with opening', 'Wall panel with an opening', 'A wall panel with a door or window cut in it.'),
  T('Cyclorama', 'Curved backdrop', 'A large curved backdrop, often lit in colour to look like sky.'),
  T('Cyc cloth', 'Backdrop cloth', 'A plain stretched cloth at the back of the stage, usually lit in colour.'),
  T('Leg', 'Side curtain', 'A tall narrow curtain at the side of the stage that hides the wings.'),
  T('Legs', 'Side curtains', 'Tall narrow curtains at the sides of the stage that hide the wings.'),
  T('Border', 'Top curtain', 'A short wide curtain hung above the stage to hide lights and pipes.'),
  T('Borders', 'Top curtains', 'Short wide curtains hung above the stage to hide lights and pipes.'),
  T('Legs and borders', 'Side and top curtains', 'Curtains that frame the stage and hide the wings and the rigging.'),
  T('Scrim', 'See-through curtain', 'A gauze curtain that looks solid when lit from the front and see-through when lit from behind.'),
  T('Valance', 'Top drape', 'A short decorative drape across the top of the stage opening.'),
  T('Traveler', 'Sliding curtain', 'A curtain on a track that opens by sliding sideways.'),
  // Stages and blocking
  T('Thrust', 'Stage that extends into the audience', 'A stage that sticks out into the audience, with seats on three sides.'),
  T('Proscenium', 'Framed stage', 'A stage behind a big picture-frame arch, with the audience in front.'),
  T('Traverse', 'Runway stage', 'A long stage between two blocks of audience facing each other.'),
  T('Spike mark', 'Floor mark', 'A small tape mark on the floor showing where a performer or piece goes.'),
  T('Spike marks', 'Floor marks', 'Small tape marks on the floor showing where performers or pieces go.'),
  T('Upstaging', 'Performer facing away from the audience', 'When a performer turns their back to the audience, often to face someone further back.'),
  T('Blocking', 'Movement plan', 'Where each performer stands and moves during a scene.'),
  T('Fly tower', 'Tall space above the stage', 'The high space above the stage where scenery and curtains are lifted out of sight.'),
  T('Orchestra pit', 'Band area in front of the stage', 'A sunken area in front of the stage for musicians.'),
  T('Rake (rise per row)', 'Seat slope (rise per row)', 'How much each row of seats rises above the one in front (the “rake”).'),
  T('Vomitories', 'Tunnel entrances', 'Tunnels through the audience seating that performers use to enter (“voms”).'),
  T('Wing width (each side)', 'Side area width (each side)', 'How wide the hidden side areas (“wings”) are on each side.'),
  T('Stage left wing wall', 'Side wall, performer’s left', 'The wall at the edge of the wing on the performer’s left (stage left).'),
  T('Stage right wing wall', 'Side wall, performer’s right', 'The wall at the edge of the wing on the performer’s right (stage right).'),
  T('Truss', 'Metal lighting frame', 'A lattice frame of metal tubes that lights and screens hang from.'),
  T('House lights', 'Audience lights', 'The lights over the audience that go down when the show starts.'),
  T('Middle of house', 'Middle of the audience', 'A view from the middle of the audience seating (“the house”).'),
  T('Back of house', 'Back of the audience', 'A view from the back of the audience seating.'),
  T('Front-of-house desk', 'Control desk in the audience', 'Where the sound and lighting operators sit, out in the audience.'),
  T('Gel', 'Colour filter', 'A coloured filter in front of a light (named after the gelatine it was once made of).'),
  T('Channel', 'Light number', 'The number the lighting desk uses to control this light.'),
  T('Masking sets…', 'Side and top curtains…', 'Pairs of side curtains (legs) plus a top curtain (border) that hide the wings and rigging.'),
  T('Tormentors & teaser', 'Inner frame', 'Front side pieces (tormentors) and a top piece (teaser) that make the stage opening smaller.'),
  T('Stage skirt', 'Stage front cover', 'Fabric that covers the front of a raised stage down to the floor.'),
  T('Main curtain', 'Front curtain', 'The main curtain that opens and closes across the front of the stage (also called the house tabs).'),
    T('Arch frame', 'Archway', 'A free-standing arch for doorways, gateways and entrances.'),
  T('Truss segment', 'Lighting frame section', 'A straight length of truss: a lattice frame of metal tubes that lights hang from.'),
  T('Truss frame', 'Lighting frame stand', 'A free-standing truss structure that lights and screens hang from.'),
    T('Apron', 'Front extension of the stage', 'The part of the stage in front of the arch or curtain line.'),
];

/** Patterns for names with numbers or sides in them. `$n` are capture groups. */
export const RULES: { re: RegExp; plain: (m: RegExpMatchArray) => string; explain: string }[] = [
  { re: /^(Profile|Fresnel|PAR|Follow spot|Moving head|Cyc light)( \d+)$/i, plain: (m) => `${lookupExact(m[1].toLowerCase() === 'profile' ? 'Profile / spot' : m[1].toLowerCase() === 'par' ? 'PAR / wash' : m[1].toLowerCase() === 'cyc light' ? 'Cyc light / LED bar' : m[1])!.plain}${m[2]}`, explain: 'This light’s type, in the words lighting crews use.' },
  { re: /^(\d+(?:st|nd|rd|th)) Electric$/i, plain: (m) => `Light bar ${parseInt(m[1], 10)}`, explain: 'A pipe over the stage that lights hang from (an “electric”), counted from the front.' },
  { re: /^(SL|SR) boom( \d+)?$/i, plain: (m) => `Side light pole, performer’s ${m[1].toUpperCase() === 'SL' ? 'left' : 'right'}${m[2] ?? ''}`, explain: 'An upright pole in the wings for side light (SL = stage left, SR = stage right).' },
  { re: /^(SL|SR)(\d+)$/, plain: (m) => `Side entrance ${m[2]}, performer’s ${m[1] === 'SL' ? 'left' : 'right'}`, explain: 'A gap between the side curtains where performers enter (SL = stage left, SR = stage right).' },
  { re: /^(SL|SR) entrance$/i, plain: (m) => `Entrance, performer’s ${m[1].toUpperCase() === 'SL' ? 'left' : 'right'}`, explain: 'SL = stage left (the performer’s left), SR = stage right.' },
  { re: /^Leg (SL|SR)( \d+)?$/i, plain: (m) => `Side curtain, performer’s ${m[1].toUpperCase() === 'SL' ? 'left' : 'right'}${m[2] ?? ''}`, explain: 'A tall narrow curtain at the side of the stage (a “leg”) that hides the wings.' },
  { re: /^Border( \d+)$/i, plain: (m) => `Top curtain${m[1]}`, explain: 'A short wide curtain above the stage (a “border”) that hides lights and pipes.' },
  { re: /^(Arch frame|Truss segment|Truss frame)( \d+)$/i, plain: (m) => `${lookupExact(m[1])!.plain}${m[2]}`, explain: 'A set piece; the technical name is shown in grey.' },
  { re: /^Apron (.+)$/i, plain: (m) => `Front extension ${m[1]}`, explain: 'The apron: the part of the stage in front of the arch or curtain line.' },
  { re: /^Upstage (.+)$/i, plain: (m) => `Back-of-stage ${m[1]}`, explain: '“Upstage” is the back of the stage, furthest from the audience.' },
  { re: /^Thrust (.+)$/i, plain: (m) => `Extension ${m[1]}`, explain: 'The thrust: the part of the stage that extends into the audience.' },
  { re: /^Arch (.+)$/i, plain: (m) => `Stage frame ${m[1]}`, explain: 'The proscenium arch: the big frame around the stage opening.' },
  { re: /^Truss (.+)$/i, plain: (m) => `Lighting frame ${m[1]}`, explain: 'A truss: a lattice frame of metal tubes that lights and screens hang from.' },
  { re: /^(DS|US)(L|R|C)$/, plain: (m) => `${m[1] === 'DS' ? 'Front' : 'Back'} ${m[2] === 'L' ? 'left' : m[2] === 'R' ? 'right' : 'centre'} of stage`, explain: 'DS = downstage (front), US = upstage (back); L/R are the performer’s left and right.' },
];

const byText = new Map(TERMS.map((t) => [t.tech.toLowerCase(), t]));
function lookupExact(text: string) {
  return byText.get(text.trim().toLowerCase());
}

/** The glossary entry for a piece of interface text, if it's technical. */
export function lookup(text: string): Term | null {
  const exact = lookupExact(text);
  if (exact) return exact;
  for (const r of RULES) {
    const m = text.trim().match(r.re);
    if (m) return { tech: text.trim(), plain: r.plain(m), explain: r.explain };
  }
  return null;
}

/** Plain text for places that can't show two lines (tooltips, option lists): "Soft light (Fresnel)". */
export function plainText(text: string) {
  const t = lookup(text);
  return t && t.plain.toLowerCase() !== t.tech.toLowerCase() ? `${t.plain} (${t.tech})` : text;
}
