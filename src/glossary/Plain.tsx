import { lookup } from './terms';

/**
 * Shows interface text in plain words first, with the technical term in small
 * grey text (hover it for a one-line explanation). Text that isn't in the
 * glossary shows as it is.
 */
export function Plain({ text, stacked = false }: { text: string; stacked?: boolean }) {
  const t = lookup(text);
  if (!t || t.plain.toLowerCase() === t.tech.toLowerCase()) return <>{text}</>;
  // The plain label already says the technical word (e.g. "Visible beams (haze)"): no need to repeat it.
  if (t.plain.toLowerCase().includes(t.tech.toLowerCase().split(' (')[0]))
    return (
      <span className="term" title={t.explain}>
        {t.plain}
      </span>
    );
  return (
    <span className={`term ${stacked ? 'term--stacked' : ''}`}>
      <span className="term__plain">{t.plain}</span>
      <small className="term__tech" title={t.explain}>
        {t.tech}
      </small>
    </span>
  );
}
