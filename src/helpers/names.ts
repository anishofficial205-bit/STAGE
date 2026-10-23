const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * "Performer 3": one more than the highest number already used with that base,
 * so deleting or renaming items never produces a duplicate.
 */
export function nextName(base: string, names: string[], { bareFirst = false } = {}) {
  const re = new RegExp(`^${escape(base)}(?: (\\d+))?$`);
  const used = names.map((n) => n.match(re)).filter((m): m is RegExpMatchArray => !!m).map((m) => (m[1] ? Number(m[1]) : 1));
  if (!used.length) return bareFirst ? base : `${base} 1`;
  return `${base} ${Math.max(...used) + 1}`;
}
