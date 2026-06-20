import type { ChatMessage } from '../types';
import { ToolCallBadge } from './ToolCallBadge';

// Very small Markdown-ish renderer: bold (**x**), inline `code`, and bullet
// lists. Kept dependency-free on purpose; swap in react-markdown later if the
// agent's output gets richer.
function renderContent(content: string) {
  return content.split('\n').map((line, i) => {
    const bullet = line.startsWith('- ');
    const text = bullet ? line.slice(2) : line;
    const html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
    return bullet ? (
      <li key={i} dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
    );
  });
}

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`message message--${message.role}`}>
      <div className="message__avatar">{isUser ? 'You' : 'J'}</div>
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
      </div>
    </div>
  );
}
