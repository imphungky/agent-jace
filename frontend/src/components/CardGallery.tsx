import type { CardView } from '../types';
import { CardTile, CardPreview } from './CardTile';
import { useCardPreview } from './useCardPreview';

/** A grid of cards that weren't paired inline with a recommendation (most often
 *  the commander). One tile per card, no cap. Self-contained: owns its own
 *  hover-preview overlay so it can be dropped in anywhere. Inline tiles in
 *  Message use their own shared preview instead — only one card is ever hovered
 *  at once, so the separate overlays never collide. */
export function CardGallery({ cards }: { cards: CardView[] }) {
  const { preview, show, hide } = useCardPreview();
  if (!cards.length) return null;

  return (
    <div className="card-gallery">
      {cards.map((c) => (
        <CardTile key={c.name} card={c} onShow={show} onHide={hide} />
      ))}
      <CardPreview preview={preview} />
    </div>
  );
}
