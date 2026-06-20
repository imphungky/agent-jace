import { useRef, useState } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/** Auto-growing text input with Enter-to-send (Shift+Enter for newline). */
export function Composer({ onSend, disabled }: ComposerProps) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoGrow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div className="composer">
      <textarea
        ref={taRef}
        className="composer__input"
        placeholder="Ask Jace about your Commander deck…"
        value={value}
        rows={1}
        onChange={autoGrow}
        onKeyDown={handleKeyDown}
      />
      <button
        className="composer__send"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        ↑
      </button>
    </div>
  );
}
