import React from 'react';

interface ChipStackProps {
  amount: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

interface ChipDenom {
  value: number;
  bg: string;
  border: string;
  stripe: string;
  text: string;
}

const DENOMS: ChipDenom[] = [
  { value: 1000, bg: 'bg-amber-500', border: 'border-amber-600', stripe: 'bg-amber-200', text: 'text-amber-950' },
  { value: 500, bg: 'bg-purple-600', border: 'border-purple-700', stripe: 'bg-purple-200', text: 'text-purple-50' },
  { value: 100, bg: 'bg-slate-900', border: 'border-slate-950', stripe: 'bg-slate-300', text: 'text-white' },
  { value: 25, bg: 'bg-emerald-600', border: 'border-emerald-700', stripe: 'bg-emerald-200', text: 'text-white' },
  { value: 5, bg: 'bg-rose-600', border: 'border-rose-700', stripe: 'bg-rose-200', text: 'text-white' },
  { value: 1, bg: 'bg-slate-100', border: 'border-slate-300', stripe: 'bg-blue-400', text: 'text-slate-800' },
];

export const ChipStack: React.FC<ChipStackProps> = ({
  amount,
  showLabel = true,
  size = 'md',
}) => {
  if (amount <= 0) return null;

  // Breakdown chips to max 6 physical chips visual
  const visualChips: ChipDenom[] = [];
  let remaining = amount;

  for (const denom of DENOMS) {
    while (remaining >= denom.value && visualChips.length < 5) {
      visualChips.push(denom);
      remaining -= denom.value;
    }
  }

  if (visualChips.length === 0 && amount > 0) {
    visualChips.push(DENOMS[DENOMS.length - 1]);
  }

  // Reverse so highest is on bottom or top nicely
  const chipHeight = size === 'sm' ? 'h-3.5 w-6' : 'h-4 w-7.5';

  return (
    <div className="inline-flex flex-col items-center select-none pointer-events-none">
      {/* 3D stacked chips */}
      <div className="relative flex flex-col items-center">
        {visualChips.slice(0, 5).map((chip, idx) => (
          <div
            key={idx}
            className={`relative rounded-full border shadow-sm ${chipHeight} ${chip.bg} ${chip.border} flex items-center justify-center`}
            style={{
              marginTop: idx === 0 ? 0 : -10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.4)',
            }}
          >
            {/* Chip Rim Notches */}
            <div className="absolute inset-0 flex items-center justify-between px-0.5 pointer-events-none">
              <span className={`w-0.5 h-1.5 rounded-xs ${chip.stripe}`} />
              <span className={`w-0.5 h-1.5 rounded-xs ${chip.stripe}`} />
            </div>
            {/* Center ring */}
            <div className="w-2.5 h-2.5 rounded-full border border-dashed border-white/40" />
          </div>
        ))}
      </div>

      {/* Amount Label */}
      {showLabel && (
        <span className="mt-1 px-1.5 py-0.5 text-[11px] font-mono font-bold tabular-nums text-amber-300 bg-slate-950/80 border border-amber-500/30 rounded shadow-md whitespace-nowrap">
          ${amount.toLocaleString()}
        </span>
      )}
    </div>
  );
};
