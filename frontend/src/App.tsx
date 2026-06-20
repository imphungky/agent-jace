import { useEffect, useRef } from 'react';
import './App.css';
import { Composer } from './components/Composer';
import { Message } from './components/Message';
import { useChat } from './useChat';

const SUGGESTIONS = [
  'Build around Atraxa, Praetors’ Voice',
  'Cheap red removal for Commander',
  'What ramp should a Simic deck run?',
];

export default function App() {
  const { messages, busy, send } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const empty = messages.length === 0;

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__logo">Jace</span>
        <span className="app__subtitle">MTG Commander Assistant</span>
      </header>

      <main className="app__main" ref={scrollRef}>
        {empty ? (
          <div className="welcome">
            <h1>What are we brewing today?</h1>
            <p>Ask about commanders, card suggestions, removal, ramp, or curve.</p>
            <div className="welcome__suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="thread">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
        )}
      </main>

      <footer className="app__footer">
        <Composer onSend={send} disabled={busy} />
        <p className="app__disclaimer">
          Jace can make mistakes. Verify card legality before deckbuilding.
        </p>
      </footer>
    </div>
  );
}
