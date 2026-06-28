import type { ChatMessage } from '../types';
import { ToolCallBadge } from './ToolCallBadge';
import { CardGallery } from './CardGallery';

// Very small Markdown-ish renderer: bold (**x**), inline `code`, and bullet
// lists. Kept dependency-free on purpose; swap in react-markdown later if the
// agent's output gets richer.
//
// Blank lines separate paragraphs; single newlines inside a paragraph become
// soft line breaks. Consecutive `- ` lines are grouped into a single list.
function renderInline(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function renderContent(content: string) {
  // Split into blocks on one or more blank lines.
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim() !== '');

  return blocks.map((block, bi) => {
    const lines = block.split('\n');
    const isList = lines.every((l) => l.startsWith('- '));

    if (isList) {
      return (
        <ul key={bi}>
          {lines.map((line, li) => (
            <li
              key={li}
              dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }}
            />
          ))}
        </ul>
      );
    }

    // Non-list block: join lines with <br> so single newlines stay within the
    // same paragraph instead of opening a full gap between each line.
    const html = lines.map(renderInline).join('<br />');
    return <p key={bi} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export function Message({ message }: { message: ChatMessage }) {
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
        <div className="message__content">
          {message.pending && !message.content ? (
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          ) : (
            renderContent(message.content)
          )}
        </div>
        {message.cards?.length ? <CardGallery cards={message.cards} /> : null}
      </div>
    </div>
  );
}
