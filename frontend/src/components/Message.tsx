import type { ChatMessage } from '../types';
import { ToolCallBadge } from './ToolCallBadge';
import { CardGallery } from './CardGallery';
import { CardPreview } from './CardTile';
import { useCardPreview } from './useCardPreview';
import { Markdown } from './Markdown';
import { RecommendationList } from './RecommendationList';

/** One chat turn. Assistant turns follow the structured contract from the
 *  backend: the deck's `commanders` (rendered first, so they frame the turn),
 *  Markdown `content`, a list of card `recommendations` (card + reason rows), an
 *  optional Markdown `followup`, and other supporting `cards` (when the model
 *  didn't return JSON, a name-matched gallery). User turns are just Markdown.
 *  The shared card preview floats above whichever tile is hovered. */
export function Message({ message }: { message: ChatMessage }) {
  const { preview, show, hide } = useCardPreview();
  const commanders = message.commanders ?? [];
  const recommendations = message.recommendations ?? [];
  const cards = message.cards ?? [];

  return (
    <div className={`message message--${message.role}`}>
      <div className="message__body">
        {message.toolCalls?.length ? (
          <div className="message__tools">
            {message.toolCalls.map((call, i) => (
              <ToolCallBadge key={i} call={call} />
            ))}
          </div>
        ) : null}

        {commanders.length ? (
          <div className="message__commander">
            <CardGallery cards={commanders} />
          </div>
        ) : null}

        <div className="message__content">
          {message.pending && !message.content ? (
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          ) : (
            message.content && <Markdown>{message.content}</Markdown>
          )}
        </div>

        {recommendations.length ? (
          <RecommendationList items={recommendations} onShow={show} onHide={hide} />
        ) : null}

        {message.followup ? (
          <div className="message__followup">
            <Markdown>{message.followup}</Markdown>
          </div>
        ) : null}

        {cards.length ? <CardGallery cards={cards} /> : null}

        <CardPreview preview={preview} />
      </div>
    </div>
  );
}
