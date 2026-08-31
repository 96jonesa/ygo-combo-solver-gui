import React, { useEffect, useRef, useState } from 'react';
import type { CardHit, CardRef } from '../../../shared/types';

/**
 * Autocomplete over the main-process card index (PRD §5.2.3). Every
 * selection is an exact passcode, so the solver's ambiguous-name
 * errors are unreachable from forms. Parents own the selected list;
 * this component only searches and emits picks.
 */
export function CardPicker({
  onPick,
  placeholder = 'search cards by name…',
  disabled = false,
}: {
  onPick: (card: CardRef) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CardHit[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim() === '') {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void window.api.searchCards(query).then((results) => {
        setHits(results);
        setOpen(true);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // Close the dropdown on outside clicks.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (hit: CardHit) => {
    onPick({ passcode: hit.passcode, name: hit.name });
    setQuery('');
    setHits([]);
    setOpen(false);
  };

  return (
    <div className="card-picker" ref={rootRef}>
      <input
        value={query}
        disabled={disabled}
        placeholder={disabled ? 'set the EDOPro directory to enable card search' : placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
      />
      {open && hits.length > 0 && (
        <ul className="card-hits">
          {hits.map((hit) => (
            <li key={hit.passcode}>
              <button onClick={() => pick(hit)}>
                <span className="hit-name">{hit.name}</span>
                <span className="hit-meta">
                  {hit.typeline} · {hit.passcode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && hits.length === 0 && query.trim() !== '' && (
        <div className="card-hits card-hits-empty">no matches</div>
      )}
    </div>
  );
}

/** Chip list of picked cards with removal; duplicates allowed (copies count). */
export function CardChips({
  cards,
  onRemove,
}: {
  cards: CardRef[];
  onRemove: (index: number) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="card-chips">
      {cards.map((card, index) => (
        <span key={`${card.passcode}-${index}`} className="chip">
          {card.name}
          <button className="chip-x" title="remove" onClick={() => onRemove(index)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
