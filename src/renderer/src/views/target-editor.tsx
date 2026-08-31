import React from 'react';
import type { TargetSpec, TargetZone } from '../../../shared/types';
import { CardPicker } from './card-picker';

const ZONES: { value: TargetZone; label: string }[] = [
  { value: 'mzone', label: 'monster zone' },
  { value: 'szone', label: 'spell/trap zone' },
  { value: 'grave', label: 'graveyard' },
  { value: 'banished', label: 'banished' },
  { value: 'hand', label: 'hand' },
];

/**
 * Composes the target board for the described-board workflow: each row
 * is card + zone + optional face-down, serialized as code@zone[:fd].
 * Add the same card twice for two copies (repeats count).
 */
export function TargetEditor({
  targets,
  onChange,
  disabled,
}: {
  targets: TargetSpec[];
  onChange: (targets: TargetSpec[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, changes: Partial<TargetSpec>) => {
    onChange(targets.map((t, i) => (i === index ? { ...t, ...changes } : t)));
  };

  return (
    <div className="target-editor">
      {targets.map((target, index) => (
        <div key={index} className="target-row">
          <span className="target-name">{target.card.name}</span>
          <select
            value={target.zone}
            onChange={(e) => {
              const zone = e.target.value as TargetZone;
              update(index, { zone, facedown: zoneAllowsFacedown(zone) && target.facedown });
            }}
          >
            {ZONES.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
          <label className={`fd ${zoneAllowsFacedown(target.zone) ? '' : 'fd-na'}`}>
            <input
              type="checkbox"
              disabled={!zoneAllowsFacedown(target.zone)}
              checked={target.facedown}
              onChange={(e) => update(index, { facedown: e.target.checked })}
            />
            face-down
          </label>
          <button title="remove" onClick={() => onChange(targets.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
      ))}
      <CardPicker
        disabled={disabled}
        placeholder="add a card to the target board…"
        onPick={(card) => onChange([...targets, { card, zone: 'mzone', facedown: false }])}
      />
    </div>
  );
}

function zoneAllowsFacedown(zone: TargetZone): boolean {
  return zone === 'mzone' || zone === 'szone';
}
