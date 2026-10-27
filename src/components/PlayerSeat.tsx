import React from 'react';
import { PlayerState } from '../types/poker';
import { CardView } from './CardView';
import { ChipStack } from './ChipStack';
import { Card } from '../logic/poker';

interface PlayerSeatProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  showCardsFaceUp: boolean;
  winningCardIds?: Set<string>;
  onCardClick?: () => void;
  seatPosition: 'hero' | 'left-bottom' | 'left-top' | 'top' | 'right-top' | 'right-bottom';
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentTurn,
  isDealer,
  isSmallBlind,
  isBigBlind,
  showCardsFaceUp,
  winningCardIds,
  onCardClick,
  seatPosition,
}) => {
  const isHero = player.isHuman;

  // Last action color badge
  const getActionBadge = () => {
    if (!player.lastAction) return null;
    const { type, labelVi, amount } = player.lastAction;

    let bg = 'bg-slate-800 text-slate-200 border-slate-700';
    if (type === 'FOLD') bg = 'bg-rose-950 text-rose-300 border-rose-800/80';
    else if (type === 'CHECK') bg = 'bg-slate-800 text-emerald-300 border-emerald-700/60';
    else if (type === 'CALL') bg = 'bg-blue-950 text-blue-300 border-blue-700/80';
    else if (type === 'RAISE') bg = 'bg-amber-950 text-amber-300 border-amber-600';
    else if (type === 'ALL_IN') bg = 'bg-red-600 text-white border-red-400 animate-pulse';
    else if (type === 'WIN') bg = 'bg-emerald-600 text-white border-emerald-400 font-bold';

    return (
      <div
        className={`absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border shadow-md whitespace-nowrap uppercase ${bg}`}
      >
        {labelVi} {amount && amount > 0 ? `$${amount.toLocaleString()}` : ''}
      </div>
    );
  };

  return (
    <div
      className={`relative flex flex-col items-center transition-all duration-300 select-none ${
        player.isFolded ? 'opacity-45' : 'opacity-100'
      }`}
    >
      {/* Action callout banner */}
      {getActionBadge()}

      {/* Hole Cards */}
      <div
        className={`relative flex items-center justify-center -space-x-4 mb-1.5 transition-transform ${
          isHero ? 'scale-105' : 'scale-90 sm:scale-95'
        }`}
        onClick={isHero ? onCardClick : undefined}
      >
        {player.holeCards.map((card: Card, idx: number) => {
          const isWinningCard = winningCardIds?.has(card.id);
          const isFaceUp = isHero || showCardsFaceUp;

          return (
            <div
              key={card.id || idx}
              className={`transform transition-transform duration-200 ${
                idx === 0 ? '-rotate-3 hover:-rotate-6' : 'rotate-3 hover:rotate-6'
              } ${isWinningCard ? 'scale-110 z-10' : ''}`}
            >
              <CardView
                card={card}
                faceDown={!isFaceUp}
                highlight={isWinningCard}
                dimmed={player.isFolded}
                size={isHero ? 'md' : 'xs'}
                peekable={isHero}
                className="sm:hidden"
              />
              <CardView
                card={card}
                faceDown={!isFaceUp}
                highlight={isWinningCard}
                dimmed={player.isFolded}
                size={isHero ? 'lg' : 'md'}
                peekable={isHero}
                className="hidden sm:block"
              />
            </div>
          );
        })}
      </div>

      {/* Player Pod / Avatar Capsule */}
      <div
        className={`relative flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border backdrop-blur-md transition-all duration-300 min-w-[80px] sm:min-w-[135px] shadow-lg ${
          isCurrentTurn
            ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/80 shadow-amber-500/20 shadow-xl'
            : isHero
            ? 'bg-slate-900/90 border-amber-500/50 ring-1 ring-amber-500/30'
            : 'bg-slate-950/85 border-slate-700/80'
        }`}
      >
        {/* Avatar circle */}
        <div className="relative shrink-0">
          <div
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs text-white shadow-inner border border-white/20"
            style={{ backgroundColor: player.color }}
          >
            {player.name.substring(0, 2).toUpperCase()}
          </div>
          {player.isThinking && (
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-amber-500"></span>
            </span>
          )}
        </div>

        {/* Name and Stack */}
        <div className="flex flex-col text-left overflow-hidden min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={`text-[10px] sm:text-xs font-semibold truncate max-w-[55px] sm:max-w-[100px] ${
                isHero ? 'text-amber-300 font-bold' : 'text-slate-100'
              }`}
            >
              {player.name}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[9px] sm:text-[11px] font-mono font-bold tabular-nums text-emerald-400">
            <span>${player.chips.toLocaleString()}</span>
          </div>

          {player.isThinking && (
            <span className="text-[8px] sm:text-[9px] text-amber-300 italic">Đang nghĩ...</span>
          )}
        </div>

        {/* Dealer / Blind Badges */}
        <div className="absolute -right-2 -bottom-2 flex items-center gap-1 z-10">
          {isDealer && (
            <div className="w-5 h-5 rounded-full bg-white text-slate-950 border border-slate-400 font-black text-[10px] flex items-center justify-center shadow-md">
              D
            </div>
          )}
          {isSmallBlind && (
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center shadow-md">
              SB
            </div>
          )}
          {isBigBlind && (
            <div className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[9px] flex items-center justify-center shadow-md">
              BB
            </div>
          )}
        </div>
      </div>

      {/* Hand Result Display at Showdown */}
      {player.bestHand && showCardsFaceUp && !player.isFolded && (
        <div className="mt-1 px-2 py-0.5 rounded bg-black/80 border border-amber-400/40 text-[10px] text-amber-300 font-medium whitespace-nowrap shadow">
          {player.bestHand.nameVi}
        </div>
      )}

      {/* Active Bet on table in front of player */}
      {player.currentBet > 0 && (
        <div className="absolute -top-7 sm:-top-8 flex items-center justify-center z-10">
          <ChipStack amount={player.currentBet} size="sm" />
        </div>
      )}
    </div>
  );
};
