import type { Recommendation } from '../types';
import { CardTile } from './CardTile';
import { Markdown } from './Markdown';

interface Props {
  items: Recommendation[];
  onShow: (e: React.MouseEvent<HTMLElement>, src?: string | null) => void;
  onHide: () => void;
}

/** The agent's card picks, one row each: the card tile beside its reason. Card
 *  data (image, mana cost, Scryfall link) is resolved server-side, so the model
 *  only ever supplies a name + reason. Reasons render as Markdown; hovering a
 *  tile floats the full card via the shared preview. */
export function RecommendationList({ items, onShow, onHide }: Props) {
  if (!items.length) return null;
  return (
    <div className="rec-list">
      {items.map((rec, i) => (
        <div className="rec-item" key={`${rec.card.name}-${i}`}>
          <CardTile card={rec.card} onShow={onShow} onHide={onHide} />
          <div className="rec-item__text">
            <Markdown>{rec.reason}</Markdown>
          </div>
        </div>
      ))}
    </div>
  );
}
