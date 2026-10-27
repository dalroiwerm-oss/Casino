import React, { useState, useEffect } from 'react';
import { sounds } from '../logic/audio';

interface BettingControlsProps {
  isHeroTurn: boolean;
  heroChips: number;
  currentBet: number;
  heroBetThisRound: number;
  potSize: number;
  bigBlind: number;
  minRaise: number;
  preAction: 'none' | 'check_fold' | 'auto_fold' | 'call_any';
  setPreAction: (action: 'none' | 'check_fold' | 'auto_fold' | 'call_any') => void;
  onFold: () => void;
  onCheck: () => void;
  onCall: (amount: number) => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
}

export const BettingControls: React.FC<BettingControlsProps> = ({
  isHeroTurn,
  heroChips,
  currentBet,
  heroBetThisRound,
  potSize,
  bigBlind,
  minRaise,
  preAction,
  setPreAction,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
}) => {
  const toCall = Math.max(0, currentBet - heroBetThisRound);
  const canCheck = toCall === 0;
  const isAllInCall = toCall >= heroChips;

  // Minimum total bet for raise
  const minRaiseTotal = Math.min(
    heroChips + heroBetThisRound,
    Math.max(currentBet + minRaise, currentBet + bigBlind)
  );
  const maxRaiseTotal = heroChips + heroBetThisRound;

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTotal);

  // Sync raise amount when currentBet changes
  useEffect(() => {
    const target = Math.min(maxRaiseTotal, Math.max(minRaiseTotal, currentBet + minRaise));
    setRaiseAmount((prev) => (prev !== target ? target : prev));
  }, [currentBet, minRaise, minRaiseTotal, maxRaiseTotal]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key === 'f' || e.key === 'F') {
        if (isHeroTurn) {
          sounds.playFold();
          onFold();
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (isHeroTurn) {
          if (canCheck) {
            sounds.playCheck();
            onCheck();
          } else {
            sounds.playChips();
            onCall(toCall);
          }
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (isHeroTurn && raiseAmount > currentBet) {
          sounds.playChips();
          onRaise(raiseAmount);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (isHeroTurn) {
          sounds.playAllIn();
          onAllIn();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHeroTurn, canCheck, toCall, raiseAmount, currentBet, onFold, onCheck, onCall, onRaise, onAllIn]);

  // Quick preset handlers
  const handlePreset = (type: 'min' | '2.5bb' | '3bb' | 'half_pot' | 'two_thirds_pot' | 'pot' | 'all_in') => {
    sounds.playClick();
    let calculated = minRaiseTotal;

    switch (type) {
      case 'min':
        calculated = minRaiseTotal;
        break;
      case '2.5bb':
        calculated = Math.round(bigBlind * 2.5);
        break;
      case '3bb':
        calculated = bigBlind * 3;
        break;
      case 'half_pot':
        calculated = currentBet + Math.round(potSize * 0.5);
        break;
      case 'two_thirds_pot':
        calculated = currentBet + Math.round(potSize * 0.67);
        break;
      case 'pot':
        calculated = currentBet + potSize;
        break;
      case 'all_in':
        calculated = maxRaiseTotal;
        break;
    }

    const clamped = Math.min(maxRaiseTotal, Math.max(minRaiseTotal, calculated));
    setRaiseAmount(clamped);
  };

  // If NOT Hero's turn, show PRE-ACTION controls
  if (!isHeroTurn) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400 font-medium">Chọn trước hành động:</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              className="rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-0"
              checked={preAction === 'check_fold'}
              onChange={(e) => setPreAction(e.target.checked ? 'check_fold' : 'none')}
            />
            <span>Check / Fold</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              className="rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-0"
              checked={preAction === 'auto_fold'}
              onChange={(e) => setPreAction(e.target.checked ? 'auto_fold' : 'none')}
            />
            <span>Tự Bỏ Bài (Auto Fold)</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              className="rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-0"
              checked={preAction === 'call_any'}
              onChange={(e) => setPreAction(e.target.checked ? 'call_any' : 'none')}
            />
            <span>Theo Mọi Cược (Call Any)</span>
          </label>
        </div>
      </div>
    );
  }

  // HERO TURN: Full Betting Console
  return (
    <div className="w-full max-w-2xl mx-auto p-3 sm:p-4 bg-slate-950/95 border-2 border-amber-500/70 rounded-2xl shadow-2xl backdrop-blur-md text-white animate-in slide-in-from-bottom-4">
      {/* Quick Bet Presets */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => handlePreset('min')}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors whitespace-nowrap"
        >
          Tối Thiểu (Min)
        </button>
        <button
          onClick={() => handlePreset('2.5bb')}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
        >
          2.5 BB
        </button>
        <button
          onClick={() => handlePreset('half_pot')}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
        >
          1/2 Pot
        </button>
        <button
          onClick={() => handlePreset('two_thirds_pot')}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
        >
          2/3 Pot
        </button>
        <button
          onClick={() => handlePreset('pot')}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
        >
          Toàn Bộ Pot
        </button>
        <button
          onClick={() => handlePreset('all_in')}
          className="px-2.5 py-1 text-xs font-bold rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/80 transition-colors whitespace-nowrap"
        >
          Tất Tay (All-In)
        </button>
      </div>

      {/* Slider & Input Row */}
      {heroChips > toCall && (
        <div className="flex items-center gap-3 mb-3 bg-slate-900/90 p-2 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 whitespace-nowrap">Mức Tố:</span>
          <input
            type="range"
            min={minRaiseTotal}
            max={maxRaiseTotal}
            step={Math.max(1, Math.round(bigBlind / 2))}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex items-center gap-1 font-mono font-bold text-amber-400 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30 tabular-nums text-sm">
            <span>$</span>
            <input
              type="number"
              min={minRaiseTotal}
              max={maxRaiseTotal}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Math.min(maxRaiseTotal, Math.max(minRaiseTotal, Number(e.target.value) || minRaiseTotal)))}
              className="w-16 bg-transparent text-amber-400 font-mono font-bold focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Main Action Buttons */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* FOLD */}
        <button
          onClick={() => {
            sounds.playFold();
            onFold();
          }}
          className="py-2.5 sm:py-3 px-1.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-rose-950/80 active:scale-95 text-rose-400 hover:text-rose-200 border border-slate-700 hover:border-rose-600 font-bold text-xs sm:text-base transition-all flex flex-col items-center justify-center shadow-lg"
        >
          <span>BỎ BÀI</span>
          <span className="text-[9px] sm:text-[10px] font-normal text-slate-400">[F]</span>
        </button>

        {/* CHECK or CALL */}
        {canCheck ? (
          <button
            onClick={() => {
              sounds.playCheck();
              onCheck();
            }}
            className="py-2.5 sm:py-3 px-1.5 sm:px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs sm:text-base border border-emerald-500 transition-all flex flex-col items-center justify-center shadow-lg shadow-emerald-950/50"
          >
            <span>XEM (CHECK)</span>
            <span className="text-[9px] sm:text-[10px] font-normal text-emerald-200">[Space]</span>
          </button>
        ) : (
          <button
            onClick={() => {
              sounds.playChips();
              onCall(toCall);
            }}
            className="py-2.5 sm:py-3 px-1.5 sm:px-3 rounded-xl bg-blue-700 hover:bg-blue-600 active:scale-95 text-white font-bold text-xs sm:text-base border border-blue-500 transition-all flex flex-col items-center justify-center shadow-lg shadow-blue-950/50"
          >
            <span className="truncate max-w-full">
              {isAllInCall ? 'ALL-IN' : 'THEO'} ${Math.min(toCall, heroChips).toLocaleString()}
            </span>
            <span className="text-[9px] sm:text-[10px] font-normal text-blue-200">[Enter]</span>
          </button>
        )}

        {/* RAISE or ALL-IN */}
        {heroChips > toCall ? (
          <button
            onClick={() => {
              if (raiseAmount >= maxRaiseTotal) {
                sounds.playAllIn();
                onAllIn();
              } else {
                sounds.playChips();
                onRaise(raiseAmount);
              }
            }}
            className="py-2.5 sm:py-3 px-1.5 sm:px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-base border border-amber-300 transition-all flex flex-col items-center justify-center shadow-lg shadow-amber-950/50"
          >
            <span className="truncate max-w-full">
              {raiseAmount >= maxRaiseTotal ? 'TẤT TAY' : `TỐ $${raiseAmount.toLocaleString()}`}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-950/80">[R]</span>
          </button>
        ) : (
          <button
            onClick={() => {
              sounds.playAllIn();
              onAllIn();
            }}
            className="py-2.5 sm:py-3 px-1.5 sm:px-3 rounded-xl bg-rose-700 hover:bg-rose-600 active:scale-95 text-white font-black text-xs sm:text-base border border-rose-500 transition-all flex flex-col items-center justify-center shadow-lg"
          >
            <span>TẤT TAY ${heroChips.toLocaleString()}</span>
            <span className="text-[9px] sm:text-[10px] font-normal text-rose-200">[A]</span>
          </button>
        )}
      </div>
    </div>
  );
};
