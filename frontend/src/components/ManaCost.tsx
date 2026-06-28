// Scryfall hosts an SVG for every mana symbol. A cost like "{2}{G}" is a run
// of {…} tokens; map each token to its symbol slug and render the pip image
// instead of showing the raw braces.
const SYMBOL_BASE = 'https://svgs.scryfall.io/card-symbols';

function symbolSlug(token: string): string {
  // "{G}" -> "G", "{2}" -> "2", "{G/U}" -> "GU", "{W/P}" -> "WP"
  return token.replace(/[{}]/g, '').replace(/\//g, '');
}

export function ManaCost({ cost }: { cost?: string | null }) {
  if (!cost) return null;
  const tokens = cost.match(/\{[^}]+\}/g) ?? [];
  if (!tokens.length) return null;

  return (
    <span className="mana-cost" aria-label={cost}>
      {tokens.map((tok, i) => (
        <img
          key={i}
          className="mana-cost__pip"
          src={`${SYMBOL_BASE}/${symbolSlug(tok)}.svg`}
          alt={tok}
          loading="lazy"
        />
      ))}
    </span>
  );
}
