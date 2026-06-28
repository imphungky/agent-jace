import type { CardView } from '../types';
import type { Preview } from './useCardPreview';
import { ManaCost } from './ManaCost';

/** The floating full-card image. A fixed overlay anchored just above (or below)
 *  the hovered tile; position comes from `useCardPreview`. */
export function CardPreview({ preview }: { preview: Preview | null }) {
  if (!preview) return null;
  return (
    <img
      className={`card-preview card-preview--${preview.placement}`}
      src={preview.src}
      alt=""
      aria-hidden
      style={{ left: preview.left, top: preview.top }}
    />
  );
}

interface CardTileProps {
  card: CardView;
  onShow: (e: React.MouseEvent<HTMLElement>, src?: string | null) => void;
  onHide: () => void;
}

/** A single clickable card: art crop, name, mana cost, and a Scryfall link.
 *  Image and link data come from the backend (ChatResponse.cards), so the model
 *  never controls layout or URLs. The commander (when looked up) leads with a
 *  badge. Hovering floats the full card via the shared preview. */
export function CardTile({ card: c, onShow, onHide }: CardTileProps) {
  return (
    <a
      className={c.is_commander ? 'mtg-card mtg-card--commander' : 'mtg-card'}
      href={c.scryfall_uri ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={c.type_line ?? c.name}
      onMouseEnter={(e) => onShow(e, c.image_normal)}
      onMouseLeave={onHide}
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
  );
}
