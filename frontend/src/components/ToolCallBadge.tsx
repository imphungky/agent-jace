import type { ToolCall } from '../types';

const LABELS: Record<string, string> = {
  search_scryfall: 'Searched Scryfall',
  get_commander_details: 'Looked up commander',
  check_legality: 'Checked legality',
  analyse_curve: 'Analysed mana curve',
};

const ICON: Record<ToolCall['status'], string> = {
  running: '◍',
  done: '✓',
  error: '✕',
};

/** A small chip describing a tool the agent invoked, shown above its reply. */
export function ToolCallBadge({ call }: { call: ToolCall }) {
  const label = LABELS[call.name] ?? call.name;
  const detail =
    typeof call.args.query === 'string'
      ? call.args.query
      : typeof call.args.card_name === 'string'
        ? call.args.card_name
        : undefined;

  // A Scryfall search uses the same query syntax as the website, so we can link
  // the shown query straight to the equivalent search results page.
  const scryfallSearchUrl =
    call.name === 'search_scryfall' && typeof call.args.query === 'string'
      ? `https://scryfall.com/search?q=${encodeURIComponent(call.args.query)}`
      : undefined;

  return (
    <span className={`tool-badge tool-badge--${call.status}`}>
      <span className="tool-badge__icon">{ICON[call.status]}</span>
      {label}
      {detail &&
        (scryfallSearchUrl ? (
          <a
            className="tool-badge__detail tool-badge__detail--link"
            href={scryfallSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open this search on Scryfall"
          >
            {detail}
          </a>
        ) : (
          <code className="tool-badge__detail">{detail}</code>
        ))}
    </span>
  );
}
