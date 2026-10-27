import React from 'react';

interface EquityBarProps {
  winRate: number;
  tieRate: number;
  handNameVi: string;
  stageNameVi: string;
}

export const EquityBar: React.FC<EquityBarProps> = ({
  winRate,
  tieRate,
  handNameVi,
  stageNameVi,
}) => {
  // Determine color for win rate
  let meterColor = 'bg-rose-500';
  if (winRate >= 70) meterColor = 'bg-emerald-500';
  else if (winRate >= 45) meterColor = 'bg-amber-400';
  else if (winRate >= 25) meterColor = 'bg-blue-400';

  return (
    <div className="w-full max-w-md mx-auto px-3 py-1.5 bg-black/75 border border-amber-500/30 rounded-xl backdrop-blur-md shadow-lg select-none">
      <div className="flex items-center justify-between gap-2 text-xs mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-300/80 font-mono uppercase tracking-wider">
            Tỉ lệ thắng:
          </span>
          <span className="font-mono font-bold text-amber-300 tabular-nums">
            {winRate}%
          </span>
          {tieRate > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">
              (Hòa {tieRate}%)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] truncate">
          <span className="text-slate-400">Bài hiện có:</span>
          <span className="font-semibold text-white truncate max-w-[150px]">
            {handNameVi}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
        <div
          className={`h-full transition-all duration-300 ${meterColor}`}
          style={{ width: `${winRate}%` }}
        />
        {tieRate > 0 && (
          <div
            className="h-full bg-slate-500 opacity-60 transition-all duration-300"
            style={{ width: `${tieRate}%` }}
          />
        )}
      </div>
    </div>
  );
};
