import React from 'react';
import { Card } from '../logic/poker';
import { CardView } from './CardView';
import { ChipStack } from './ChipStack';
import { PotSegment } from '../logic/poker';
import { TableStage } from '../types/poker';

interface CommunityBoardProps {
  communityCards: Card[];
  totalPot: number;
  pots: PotSegment[];
  stage: TableStage;
  winningCardIds?: Set<string>;
  announcement?: string | null;
}

export const CommunityBoard: React.FC<CommunityBoardProps> = ({
  communityCards,
  totalPot,
  pots,
  stage,
  winningCardIds,
  announcement,
}) => {
  const getStageLabel = () => {
    switch (stage) {
      case 'PREFLOP':
        return 'VÒNG PREFLOP';
      case 'FLOP':
        return 'VÒNG FLOP (3 LÁ ĐẦU)';
      case 'TURN':
        return 'VÒNG TURN (LÁ THỨ 4)';
      case 'RIVER':
        return 'VÒNG RIVER (LÁ THỨ 5)';
      case 'SHOWDOWN':
        return 'NGỬA BÀI (SHOWDOWN)';
      case 'HAND_SUMMARY':
        return 'KẾT THÚC VÁN';
      default:
        return 'BÀN CHƠI POKER';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center pointer-events-none select-none z-10">
      {/* Table Logo / Brand Watermark in Felt */}
      <div className="absolute -top-14 opacity-15 flex flex-col items-center pointer-events-none">
        <span className="text-xl sm:text-2xl font-serif font-black tracking-widest text-white uppercase">
          TEXAS HOLD'EM
        </span>
        <div className="flex items-center gap-2 text-xs tracking-wider text-amber-200">
          <span>♠</span>
          <span>♥</span>
          <span>♦</span>
          <span>♣</span>
        </div>
      </div>

      {/* Main Pot & Side Pots Display */}
      <div className="mb-2 sm:mb-3 flex flex-col items-center">
        <div className="flex items-center gap-2 px-3 py-1 bg-black/70 border border-amber-500/40 rounded-full shadow-lg backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wide">
            Hũ Pot:
          </span>
          <span className="text-sm sm:text-base font-mono font-black tabular-nums text-emerald-400">
            ${totalPot.toLocaleString()}
          </span>
        </div>

        {/* Side pots indicators if any */}
        {pots.length > 1 && (
          <div className="flex items-center gap-1.5 mt-1">
            {pots.map((pot, idx) => (
              <span
                key={idx}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 tabular-nums"
              >
                {idx === 0 ? 'Pot Chính' : `Side Pot ${idx}`}: ${pot.amount.toLocaleString()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 5 Community Cards Area */}
      <div className="flex items-center gap-1 sm:gap-2 p-1 sm:p-2 bg-black/35 rounded-xl border border-white/10 shadow-inner">
        {[0, 1, 2, 3, 4].map((index) => {
          const card = communityCards[index];
          const isWinningCard = card && winningCardIds?.has(card.id);

          if (!card) {
            return (
              <div
                key={index}
                className="w-8 h-12 sm:w-16 sm:h-24 rounded sm:rounded-lg border-2 border-dashed border-white/15 bg-white/5 flex items-center justify-center"
              >
                <span className="text-white/10 text-[9px] sm:text-sm font-serif">
                  {index < 3 ? 'FLOP' : index === 3 ? 'TURN' : 'RIVER'}
                </span>
              </div>
            );
          }

          return (
            <div
              key={card.id}
              className={`transform transition-all duration-300 animate-in fade-in zoom-in-90 ${
                isWinningCard ? 'scale-105 z-20' : ''
              }`}
            >
              <CardView
                card={card}
                highlight={isWinningCard}
                size="sm"
                className="shadow-xl sm:hidden"
              />
              <CardView
                card={card}
                highlight={isWinningCard}
                size="lg"
                className="shadow-xl hidden sm:block"
              />
            </div>
          );
        })}
      </div>

      {/* Street Indicator & Winning Announcement */}
      <div className="mt-2 flex flex-col items-center">
        {announcement ? (
          <div className="px-4 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg border border-amber-300 animate-bounce whitespace-nowrap">
            {announcement}
          </div>
        ) : (
          <div className="text-[10px] font-mono tracking-widest text-amber-200/70 uppercase">
            {getStageLabel()}
          </div>
        )}
      </div>
    </div>
  );
};
