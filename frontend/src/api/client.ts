import type { ChatRequest, ChatResponse } from '../types';
import { mockBackend } from './mockBackend';

// Any chat data source implements this. Swapping mock <-> real HTTP is a single
// decision in `getBackend()` below; components never import a concrete backend.
export interface ChatBackend {
  sendMessage(req: ChatRequest): Promise<ChatResponse>;
}

// Talks to the real Python API. Expects a POST /api/chat that accepts a
// ChatRequest and returns a ChatResponse. Adjust the path/shape to match
// whatever the backend ends up exposing.
class HttpBackend implements ChatBackend {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      throw new Error(`Backend error ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as ChatResponse;
  }
}

// Use the mock until a backend exists. Set VITE_USE_MOCK=false (and optionally
// VITE_API_URL) in a .env file to hit the real API instead.
function getBackend(): ChatBackend {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  if (useMock) return mockBackend;
  return new HttpBackend(import.meta.env.VITE_API_URL ?? '');
}

export const backend = getBackend();
