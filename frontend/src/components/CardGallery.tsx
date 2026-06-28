import { useState } from 'react';
import type { CardView } from '../types';
import { ManaCost } from './ManaCost';

// Approximate rendered size of the hover preview, used to decide whether it
// fits above the tile and to keep it on-screen. Magic cards are ~1.4:1 tall.
const PREVIEW_W = 240;
const PREVIEW_H = 335;
const GAP = 10;

interface Preview {
  src: string;
  left: number;
  top: number;
  placement: 'above' | 'below';
}

/** A clickable grid of the cards the agent actually suggested — one tile per
 *  cited card, no cap. Image + link data comes from the backend
 *  (ChatResponse.cards), so the model never controls layout or URLs. The
 *  commander (when looked up) leads with a badge. Hovering a tile floats the
 *  full card just above it (a fixed overlay, anchored to the tile so it never
 *  gets clipped by the tile's rounded container). */
export function CardGallery({ cards }: { cards: CardView[] }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  if (!cards.length) return null;

  const showPreview = (e: React.MouseEvent<HTMLElement>, src?: string | null) => {
    if (!src) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(center, PREVIEW_W / 2 + 8),
      window.innerWidth - PREVIEW_W / 2 - 8,
    );
    // Prefer above the tile; flip below if there isn't headroom.
    const placement = rect.top >= PREVIEW_H + GAP ? 'above' : 'below';
    const top = placement === 'above' ? rect.top - GAP : rect.bottom + GAP;
    setPreview({ src, left, top, placement });
  };

  return (
    <div className="card-gallery">
      {cards.map((c) => (
        <a
          key={c.name}
          className={c.is_commander ? 'mtg-card mtg-card--commander' : 'mtg-card'}
          href={c.scryfall_uri ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          title={c.type_line ?? c.name}
          onMouseEnter={(e) => showPreview(e, c.image_normal)}
          onMouseLeave={() => setPreview(null)}
        >
          {c.is_commander && <span className="mtg-card__tag">Commander</span>}
          {c.art_crop && (
            <img className="mtg-card__art" src={c.art_crop} alt={c.name} loading="lazy" />
          )}
          <div className="mtg-card__meta">
            <span className="mtg-card__name">{c.name}</span>
            <span className="mtg-card__sub">
              <ManaCost cost={c.mana_cost} />
              <span className="mtg-card__link">Scryfall ↗</span>
            </span>
          </div>
        </a>
      ))}

      {/* Hover-to-enlarge: full card image floated above (or below) the tile. */}
      {preview && (
        <img
          className={`card-preview card-preview--${preview.placement}`}
          src={preview.src}
          alt=""
          aria-hidden
          style={{ left: preview.left, top: preview.top }}
        />
      )}
    </div>
  );
}
