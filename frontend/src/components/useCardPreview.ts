import { useState } from 'react';

// Approximate rendered size of the hover preview, used to decide whether it
// fits above the tile and to keep it on-screen. Magic cards are ~1.4:1 tall.
const PREVIEW_W = 240;
const PREVIEW_H = 335;
const GAP = 10;

export interface Preview {
  src: string;
  left: number;
  top: number;
  placement: 'above' | 'below';
}

/** Hover-to-enlarge state, shared so a single floating overlay can serve every
 *  tile in a message — whether it sits inline next to a recommendation or in
 *  the fallback gallery. Only one tile can be hovered at a time, so one piece
 *  of state suffices. */
export function useCardPreview() {
  const [preview, setPreview] = useState<Preview | null>(null);

  const show = (e: React.MouseEvent<HTMLElement>, src?: string | null) => {
    if (!src) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(center, PREVIEW_W / 2 + 8),
      window.innerWidth - PREVIEW_W / 2 - 8,
    );
    // Prefer above the tile; flip below if there isn't headroom.
    const placement = rect.top >= PREVIEW_H + GAP ? 'above' : 'below';
    const top = placement === 'above' ? rect.top - GAP : rect.bottom + GAP;
    setPreview({ src, left, top, placement });
  };

  const hide = () => setPreview(null);

  return { preview, show, hide };
}
