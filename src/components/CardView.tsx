import React from 'react';
import { Card, RANK_LABELS, SUIT_SYMBOLS, Suit } from '../logic/poker';

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  highlight?: boolean;
  dimmed?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  peekable?: boolean;
  twoColor?: boolean; // If true: Hearts & Diamonds = Vivid Red, Spades & Clubs = Crisp Black
  showHeoBadge?: boolean; // Special badge for 2 (Heo) in Tien Len
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  faceDown = false,
  highlight = false,
  dimmed = false,
  size = 'md',
  className = '',
  peekable = false,
  twoColor = false,
  showHeoBadge = true,
}) => {
  const isRed = card && (card.suit === 'hearts' || card.suit === 'diamonds');
  const isHeo = card && card.rank === 2;
  const isAce = card && card.rank === 14;

  const getSuitColor = (suit: Suit) => {
    if (twoColor) {
      return suit === 'hearts' || suit === 'diamonds'
        ? 'text-[#dc2626]' // Pure vibrant casino red
        : 'text-[#09090b]'; // Pitch rich carbon black
    }

    switch (suit) {
      case 'hearts':
        return 'text-[#dc2626]';
      case 'spades':
        return 'text-[#09090b]';
      case 'diamonds':
        return 'text-[#0284c7]';
      case 'clubs':
        return 'text-[#059669]';
    }
  };

  // Dimensions fine-tuned for high-density mobile 13-card hands up to 4K desktop
  const sizeConfig = {
    xs: {
      box: 'w-7.5 h-11 text-[9px] rounded xs:w-8.5 xs:h-12.5 sm:w-10 sm:h-14 sm:rounded-md',
      rank: 'text-[10px] xs:text-[11px] sm:text-[13px]',
      suit: 'text-[9px] xs:text-[10px] sm:text-[11px]',
      center: 'text-base xs:text-lg sm:text-xl',
      badge: 'text-[7px] px-0.5',
    },
    sm: {
      box: 'w-9.5 h-13.5 text-[10px] rounded-md sm:w-12 sm:h-17 sm:rounded-lg',
      rank: 'text-[11px] sm:text-[14px]',
      suit: 'text-[10px] sm:text-[12px]',
      center: 'text-lg sm:text-2xl',
      badge: 'text-[7.5px] px-0.5',
    },
    md: {
      box: 'w-11.5 h-16.5 text-xs rounded-lg sm:w-16 sm:h-23 sm:rounded-xl',
      rank: 'text-[12px] sm:text-[16px]',
      suit: 'text-[11px] sm:text-[13px]',
      center: 'text-xl sm:text-3xl',
      badge: 'text-[8px] sm:text-[9px] px-1',
    },
    lg: {
      box: 'w-13.5 h-19.5 text-xs rounded-xl sm:w-19 sm:h-27 sm:rounded-2xl',
      rank: 'text-[14px] sm:text-[18px]',
      suit: 'text-[12px] sm:text-[15px]',
      center: 'text-2xl sm:text-4xl',
      badge: 'text-[8.5px] sm:text-[9px] px-1',
    },
    xl: {
      box: 'w-16 h-23 text-sm rounded-xl sm:w-22 sm:h-31 sm:rounded-2xl',
      rank: 'text-[15px] sm:text-[20px]',
      suit: 'text-[13px] sm:text-[16px]',
      center: 'text-3xl sm:text-5xl',
      badge: 'text-[9px] sm:text-[10px] px-1',
    },
  }[size];

  if (faceDown || !card) {
    return (
      <div
        className={`relative select-none aspect-[5/7] border border-amber-400/60 shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-200 ${sizeConfig.box} ${
          dimmed ? 'opacity-40 grayscale' : 'opacity-100'
        } ${className}`}
        style={{
          background: 'radial-gradient(circle at 50% 40%, #1e1b4b 0%, #090d16 80%, #030712 100%)',
        }}
      >
        {/* Luxury Card Back Pattern */}
        <div className="absolute inset-0.5 sm:inset-1 border border-amber-400/40 rounded-[inherit] flex items-center justify-center overflow-hidden">
          <svg className="w-full h-full opacity-50" viewBox="0 0 40 56">
            <defs>
              <pattern id="cardPatternBackCyber" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="none" stroke="#f59e0b" strokeWidth="0.8" />
                <circle cx="4" cy="4" r="1.3" fill="#fbbf24" />
              </pattern>
            </defs>
            <rect width="40" height="56" fill="url(#cardPatternBackCyber)" />
          </svg>
          <div className="absolute w-5 h-5 sm:w-7 sm:h-7 rounded-full border border-amber-300 bg-amber-950/90 flex items-center justify-center text-[9px] sm:text-xs font-serif font-black text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]">
            ♠
          </div>
        </div>
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = getSuitColor(card.suit);
  const rankLabel = RANK_LABELS[card.rank];

  return (
    <div
      className={`relative select-none bg-gradient-to-b from-[#ffffff] via-[#ffffff] to-[#f1f5f9] font-sans aspect-[5/7] transition-all duration-200 border ${
        highlight
          ? 'border-amber-400 ring-2 sm:ring-4 ring-amber-400/90 shadow-[0_0_24px_rgba(251,191,36,0.9)] z-30'
          : 'border-slate-300 hover:border-amber-300 shadow-[0_3px_12px_rgba(0,0,0,0.35)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.5)]'
      } ${dimmed ? 'opacity-40 grayscale' : 'opacity-100'} ${
        peekable ? 'cursor-pointer hover:-translate-y-2' : ''
      } ${sizeConfig.box} ${className}`}
      style={{
        boxShadow: highlight
          ? '0 0 0 2px #fbbf24, 0 8px 20px -4px rgba(251,191,36,0.7), 0 4px 6px -4px rgba(0,0,0,0.5)'
          : '0 3px 10px rgba(0,0,0,0.25)',
      }}
    >
      {/* Top Left Corner */}
      <div className={`absolute top-0.5 left-1 leading-none font-black ${suitColor} flex flex-col items-center pointer-events-none`}>
        <span className={`${sizeConfig.rank} font-black tracking-tight leading-none drop-shadow-xs`}>
          {rankLabel}
        </span>
        <span className={`${sizeConfig.suit} -mt-0.5 leading-none`}>
          {suitSymbol}
        </span>
      </div>

      {/* Cybergame Heo / Ace Special Badge */}
      {showHeoBadge && isHeo && (
        <div className={`absolute top-0.5 right-0.5 rounded bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black uppercase tracking-tighter shadow-xs animate-pulse border border-amber-300 pointer-events-none ${sizeConfig.badge}`}>
          HEO
        </div>
      )}
      {showHeoBadge && isAce && !isHeo && (
        <div className={`absolute top-0.5 right-0.5 rounded bg-slate-900 text-amber-300 font-black uppercase tracking-tighter shadow-xs border border-slate-700 pointer-events-none ${sizeConfig.badge}`}>
          ÁT
        </div>
      )}

      {/* Center Large Suit Symbol with Depth */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`font-serif ${suitColor} ${sizeConfig.center} select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-transform duration-200 ${
            highlight ? 'scale-110' : ''
          }`}
          style={{ opacity: 0.95 }}
        >
          {suitSymbol}
        </span>
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div
        className={`absolute bottom-0.5 right-1 leading-none font-black ${suitColor} flex flex-col items-center rotate-180 pointer-events-none`}
      >
        <span className={`${sizeConfig.rank} font-black tracking-tight leading-none drop-shadow-xs`}>
          {rankLabel}
        </span>
        <span className={`${sizeConfig.suit} -mt-0.5 leading-none`}>
          {suitSymbol}
        </span>
      </div>

      {/* Bright Glass Reflection Overlays */}
      <div className="absolute inset-0.5 border border-white/80 rounded-[inherit] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-2/5 bg-gradient-to-b from-white/90 via-white/30 to-transparent rounded-t-[inherit] pointer-events-none" />

      {/* Highlight Top Glow Line */}
      {highlight && (
        <div className="absolute top-0 inset-x-0 h-0.5 sm:h-1 bg-amber-300 rounded-t-[inherit] animate-pulse" />
      )}
    </div>
  );
};
