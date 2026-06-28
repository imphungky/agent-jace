// Shared domain types for the chat UI. These mirror the shape of the Python
// agent (jaceagent.py): a conversation is a list of messages, and an assistant
// turn may involve one or more tool calls (e.g. Scryfall searches) before the
// final text answer.

export type Role = 'user' | 'assistant';

export interface ToolCall {
  /** Tool name, e.g. "search_scryfall" or "get_commander_details". */
  name: string;
  /** Arguments the model passed to the tool. */
  args: Record<string, unknown>;
  /** Lifecycle of the call, used to animate the UI. */
  status: 'running' | 'done' | 'error';
}

// A real, format-legal card the agent recommended, surfaced as a gallery tile.
// Field names mirror the backend JSON (snake_case) so the wire payload maps
// straight onto this shape — see service/models.py:CardView.
export interface CardView {
  name: string;
  mana_cost?: string | null;
  type_line?: string | null;
  image_small?: string | null;
  /** Full card image, used for hover-to-enlarge. */
  image_normal?: string | null;
  art_crop?: string | null;
  scryfall_uri?: string | null;
  /** True when this card is the deck's commander (looked up by the agent). */
  is_commander?: boolean;
}

// A single card suggestion: the resolved card plus Jace's reason for it.
// Mirrors service/models.py:Recommendation. `reason` is Markdown.
export interface Recommendation {
  card: CardView;
  reason: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  /** Markdown framing / message text. */
  content: string;
  /** Optional Markdown closing line or follow-up question. */
  followup?: string;
  /** Structured card picks, each drawn as a card beside its reason. */
  recommendations?: Recommendation[];
  /** Tool calls made while producing an assistant message (display only). */
  toolCalls?: ToolCall[];
  /** Supporting cards (commander, or fallback gallery) under the prose. */
  cards?: CardView[];
  /** True while the assistant response is still streaming/loading. */
  pending?: boolean;
}

/** Request body sent to the backend. */
export interface ChatRequest {
  message: string;
  /** Prior turns, so a stateless backend can reconstruct context. */
  history: Array<Pick<ChatMessage, 'role' | 'content'>>;
}

/** Response returned by the backend for a single user turn. Field names are
 *  snake_case to mirror the Pydantic wire shape (see service/models.py). */
export interface ChatResponse {
  reply: string;
  followup?: string;
  recommendations?: Recommendation[];
  tool_calls?: ToolCall[];
  cards?: CardView[];
}
