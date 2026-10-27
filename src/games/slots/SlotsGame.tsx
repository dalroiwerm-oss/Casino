import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../../logic/audio';
import { UserProfile } from '../../logic/auth';
import { DeviceModeSelector } from '../../components/DeviceModeSelector';
import { useDeviceMode } from '../../logic/device';

interface SlotsGameProps {
  currentUser: UserProfile | null;
  onUpdateChips: (newChips: number, wonAmount: number) => void;
  onExit: () => void;
  onRequireRegister: () => void;
}

interface SlotSymbol {
  id: string;
  name: string;
  emoji: string;
  color: string;
  multiplier3: number;
  multiplier4: number;
  multiplier5: number;
  isJackpot?: boolean;
  isWild?: boolean;
  isScatter?: boolean;
}

const SYMBOLS: SlotSymbol[] = [
  { id: 'jackpot', name: 'Thần Tài 777', emoji: '7️⃣', color: 'text-amber-400', multiplier3: 50, multiplier4: 200, multiplier5: 1000, isJackpot: true },
  { id: 'wild', name: 'Ngọc Hoàng (WILD)', emoji: '👑', color: 'text-purple-400', multiplier3: 20, multiplier4: 80, multiplier5: 400, isWild: true },
  { id: 'scatter', name: 'Kim Bảo (SCATTER)', emoji: '💰', color: 'text-yellow-300', multiplier3: 15, multiplier4: 50, multiplier5: 250, isScatter: true },
  { id: 'gold', name: 'Thỏi Vàng', emoji: '🪙', color: 'text-amber-300', multiplier3: 10, multiplier4: 30, multiplier5: 100 },
  { id: 'bell', name: 'Chuông Vàng', emoji: '🔔', color: 'text-yellow-400', multiplier3: 6, multiplier4: 18, multiplier5: 60 },
  { id: 'melon', name: 'Dưa Hấu', emoji: '🍉', color: 'text-emerald-400', multiplier3: 4, multiplier4: 12, multiplier5: 40 },
  { id: 'grape', name: 'Chùm Nho', emoji: '🍇', color: 'text-violet-400', multiplier3: 3, multiplier4: 8, multiplier5: 25 },
  { id: 'orange', name: 'Quả Cam', emoji: '🍊', color: 'text-orange-400', multiplier3: 2, multiplier4: 5, multiplier5: 15 },
  { id: 'cherry', name: 'Quả Cherry', emoji: '🍒', color: 'text-rose-500', multiplier3: 1.5, multiplier4: 3, multiplier5: 10 },
];

const PAYLINES = [
  [1, 1, 1, 1, 1], // Center line
  [0, 0, 0, 0, 0], // Top line
  [2, 2, 2, 2, 2], // Bottom line
  [0, 1, 2, 1, 0], // V-shape
  [2, 1, 0, 1, 2], // Inverted V
];

const BET_OPTIONS = [10, 25, 50, 100, 250, 500, 1000];

export const SlotsGame: React.FC<SlotsGameProps> = ({
  currentUser,
  onUpdateChips,
  onExit,
  onRequireRegister,
}) => {
  const { isMobile, isTablet, isDesktop } = useDeviceMode();
  const [chips, setChips] = useState<number>(currentUser?.chips || 2500);
  const [betIndex, setBetIndex] = useState<number>(2); // 50
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [leverPulled, setLeverPulled] = useState<boolean>(false);

  // Staggered spinning status per reel (0..4)
  const [reelSpinning, setReelSpinning] = useState<boolean[]>([false, false, false, false, false]);
  const [reelAnticipation, setReelAnticipation] = useState<boolean[]>([false, false, false, false, false]);

  const [reels, setReels] = useState<SlotSymbol[][]>([
    [SYMBOLS[3], SYMBOLS[4], SYMBOLS[7]],
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[5]],
    [SYMBOLS[2], SYMBOLS[6], SYMBOLS[8]],
    [SYMBOLS[4], SYMBOLS[3], SYMBOLS[1]],
    [SYMBOLS[5], SYMBOLS[7], SYMBOLS[0]],
  ]);

  const [winningLines, setWinningLines] = useState<{ lineIdx: number; symbol: SlotSymbol; win: number }[]>([]);
  const [lastWin, setLastWin] = useState<number>(0);
  const [animatedWin, setAnimatedWin] = useState<number>(0);
  const [jackpotPool, setJackpotPool] = useState<number>(888888);
  const [isJackpotHit, setIsJackpotHit] = useState<boolean>(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(0);
  const [autoSpin, setAutoSpin] = useState<boolean>(false);
  const [fastSpin, setFastSpin] = useState<boolean>(false);
  const [bigWinMessage, setBigWinMessage] = useState<string | null>(null);

  const currentBet = BET_OPTIONS[betIndex];

  // Sync chips with currentUser
  useEffect(() => {
    if (currentUser?.chips !== undefined) {
      setChips(currentUser.chips);
    }
  }, [currentUser?.chips]);

  // Rolling counter animation for win amount
  useEffect(() => {
    if (lastWin === 0) {
      setAnimatedWin(0);
      return;
    }
    const duration = 1200;
    const start = 0;
    const end = lastWin;
    const startTime = performance.now();

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedWin(Math.floor(start + (end - start) * ease));
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }, [lastWin]);

  const getRandomWeightedSymbol = (): SlotSymbol => {
    const rand = Math.random();
    if (rand < 0.04) return SYMBOLS[0]; // Jackpot 777
    if (rand < 0.10) return SYMBOLS[1]; // Wild
    if (rand < 0.16) return SYMBOLS[2]; // Scatter
    if (rand < 0.28) return SYMBOLS[3]; // Gold
    if (rand < 0.42) return SYMBOLS[4]; // Bell
    if (rand < 0.58) return SYMBOLS[5]; // Melon
    if (rand < 0.72) return SYMBOLS[6]; // Grape
    if (rand < 0.86) return SYMBOLS[7]; // Orange
    return SYMBOLS[8]; // Cherry
  };

  const pullLever = () => {
    if (isSpinning) return;
    setLeverPulled(true);
    sounds.playChips();
    setTimeout(() => {
      setLeverPulled(false);
      spin();
    }, 280);
  };

  const spin = async () => {
    if (isSpinning) return;

    if (!currentUser) {
      onRequireRegister();
      return;
    }

    if (freeSpinsLeft === 0 && chips < currentBet) {
      sounds.playFold();
      alert('Bạn không đủ chip! Hãy nạp thêm hoặc đổi mức cược.');
      setAutoSpin(false);
      return;
    }

    // Deduct bet if not free spin
    const newBalance = freeSpinsLeft > 0 ? chips : chips - currentBet;
    setChips(newBalance);
    setIsSpinning(true);
    setWinningLines([]);
    setLastWin(0);
    setIsJackpotHit(false);
    setBigWinMessage(null);
    sounds.playChips();

    // Increment Jackpot pool
    setJackpotPool((prev) => prev + Math.round(currentBet * 0.1));

    // Stagger all 5 reels spinning
    setReelSpinning([true, true, true, true, true]);
    setReelAnticipation([false, false, false, false, false]);

    // Pre-calculate target results
    const finalReels: SlotSymbol[][] = Array(5).fill(null).map(() => [
      getRandomWeightedSymbol(),
      getRandomWeightedSymbol(),
      getRandomWeightedSymbol(),
    ]);

    // Check if early reels have 2+ Scatters or Jackpot to trigger tension anticipation on reels 3 and 4
    const earlyScatters = finalReels.slice(0, 2).flat().filter((s) => s.isScatter || s.isJackpot).length;
    const hasTension = earlyScatters >= 2;

    // Rapid symbol rolling ticker during spin
    const intervals: NodeJS.Timeout[] = [];
    [0, 1, 2, 3, 4].forEach((colIdx) => {
      const interval = setInterval(() => {
        setReels((prev) => {
          const next = [...prev];
          next[colIdx] = [
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          ];
          return next;
        });
      }, 70);
      intervals.push(interval);
    });

    // Staggered stop delays per reel
    const reelStopDelays = [
      fastSpin ? 500 : 900,
      fastSpin ? 700 : 1200,
      fastSpin ? 900 : 1550,
      fastSpin ? 1100 : hasTension ? 2100 : 1900,
      fastSpin ? 1300 : hasTension ? 2700 : 2250,
    ];

    if (hasTension && !fastSpin) {
      setTimeout(() => {
        setReelAnticipation([false, false, false, true, true]);
        sounds.playAllIn();
      }, 1550);
    }

    reelStopDelays.forEach((delay, idx) => {
      setTimeout(() => {
        clearInterval(intervals[idx]);
        setReelSpinning((prev) => {
          const next = [...prev];
          next[idx] = false;
          return next;
        });
        setReels((prev) => {
          const next = [...prev];
          next[idx] = finalReels[idx];
          return next;
        });
        sounds.playClick();
      }, delay);
    });

    const totalSpinTime = reelStopDelays[4] + 150;

    setTimeout(() => {
      setIsSpinning(false);
      setReelAnticipation([false, false, false, false, false]);

      // Evaluate Paylines
      let totalWin = 0;
      const hitLines: { lineIdx: number; symbol: SlotSymbol; win: number }[] = [];

      PAYLINES.forEach((line, lineIdx) => {
        const lineSymbols = line.map((row, col) => finalReels[col][row]);
        const firstSymbol = lineSymbols[0];

        let matchCount = 1;
        let matchSymbol = firstSymbol;

        for (let i = 1; i < lineSymbols.length; i++) {
          const s = lineSymbols[i];
          if (s.id === matchSymbol.id || s.isWild) {
            matchCount++;
          } else if (matchSymbol.isWild && !s.isScatter) {
            matchSymbol = s;
            matchCount++;
          } else {
            break;
          }
        }

        if (matchCount >= 3) {
          let multiplier = 0;
          if (matchCount === 3) multiplier = matchSymbol.multiplier3;
          else if (matchCount === 4) multiplier = matchSymbol.multiplier4;
          else if (matchCount === 5) multiplier = matchSymbol.multiplier5;

          const lineWin = Math.round((currentBet / 5) * multiplier);
          totalWin += lineWin;
          hitLines.push({ lineIdx, symbol: matchSymbol, win: lineWin });

          if (matchSymbol.isJackpot && matchCount === 5) {
            setIsJackpotHit(true);
          }
        }
      });

      // Scatter Check for Free Spins
      const scatterCount = finalReels.flat().filter((s) => s.isScatter).length;
      if (scatterCount >= 3) {
        const awardedFreeSpins = scatterCount === 3 ? 5 : scatterCount === 4 ? 10 : 15;
        setFreeSpinsLeft((prev) => prev + awardedFreeSpins);
        sounds.playWin();
        setBigWinMessage(`🎉 BẠN ĐƯỢC THƯỞNG ${awardedFreeSpins} VÒNG QUAY MIỄN PHÍ!`);
      }

      // Check Jackpot explosion
      let finalWinAmount = totalWin;
      if (hitLines.some((l) => l.symbol.isJackpot && l.win >= currentBet * 100)) {
        finalWinAmount += jackpotPool;
        setJackpotPool(500000);
        setIsJackpotHit(true);
        confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 } });
        sounds.playAllIn();
        setBigWinMessage(`🔥 NỔ HŨ TOÀN NĂNG! TRÚNG $${finalWinAmount.toLocaleString()}! 🔥`);
      } else if (finalWinAmount >= currentBet * 10) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.7 } });
        sounds.playWin();
        setBigWinMessage(`✨ SIÊU THẮNG LỢI: +$${finalWinAmount.toLocaleString()}! ✨`);
      } else if (finalWinAmount > 0) {
        sounds.playWin();
      }

      const updatedChips = newBalance + finalWinAmount;
      setChips(updatedChips);
      setLastWin(finalWinAmount);
      setWinningLines(hitLines);

      onUpdateChips(updatedChips, finalWinAmount);

      if (freeSpinsLeft > 0) {
        setFreeSpinsLeft((prev) => Math.max(0, prev - 1));
      }
    }, totalSpinTime);
  };

  // Auto-spin ticker
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (autoSpin && !isSpinning) {
      if (chips >= currentBet || freeSpinsLeft > 0) {
        timeout = setTimeout(() => {
          spin();
        }, 800);
      } else {
        setAutoSpin(false);
      }
    }
    return () => clearTimeout(timeout);
  }, [autoSpin, isSpinning, chips, currentBet, freeSpinsLeft]);

  return (
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-950 text-white flex flex-col justify-between select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="px-4 sm:px-8 py-3 bg-slate-900/90 border-b border-amber-950/80 flex items-center justify-between backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            ← Sảnh Game
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎰</span>
            <span className="font-serif font-black text-amber-400 tracking-wider text-sm sm:text-base">
              QUAY HŨ THẦN TÀI 777 CASINO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <DeviceModeSelector compact={true} />
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 font-mono text-xs shadow-inner">
            <span className="text-slate-400">Số Dư:</span>
            <span className="text-emerald-400 font-bold text-xs sm:text-sm tabular-nums">${chips.toLocaleString()}</span>
          </div>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="max-w-5xl w-full mx-auto p-2 sm:p-6 flex flex-col items-center justify-center flex-1 relative">
        {/* Big Win Celebration Modal */}
        {bigWinMessage && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center animate-in zoom-in-75 duration-300">
            <div className="px-8 py-4 rounded-3xl bg-gradient-to-r from-amber-600 via-rose-600 to-yellow-500 border-4 border-yellow-200 text-white font-black text-xl sm:text-3xl uppercase tracking-wider text-center shadow-[0_0_80px_rgba(245,158,11,0.9)] animate-pulse">
              {bigWinMessage}
            </div>
          </div>
        )}

        {/* Mega Jackpot Marquee Banner */}
        <div className="relative w-full max-w-xl mb-3 p-3.5 rounded-3xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 border-2 border-yellow-300 shadow-[0_10px_35px_rgba(245,158,11,0.35)] text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.45)_0%,transparent_70%)] animate-pulse pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs">👑</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-950">
                HŨ TÀI LỘC HOÀNG GIA (MEGA JACKPOT)
              </span>
              <span className="text-xs">👑</span>
            </div>
            <span className="text-3xl sm:text-4xl font-mono font-black text-slate-950 tracking-wider tabular-nums mt-0.5 drop-shadow">
              ${jackpotPool.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Free Spins Alert if active */}
        {freeSpinsLeft > 0 && (
          <div className="mb-3 px-5 py-2 rounded-full bg-purple-900/90 border-2 border-purple-400 text-purple-200 text-xs sm:text-sm font-black animate-bounce flex items-center gap-2 shadow-lg shadow-purple-900/50">
            <span>🎉 VÒNG QUAY MIỄN PHÍ CÒN:</span>
            <span className="text-amber-300 font-mono text-base">{freeSpinsLeft} LƯỢT</span>
          </div>
        )}

        {/* Cabinet with Interactive Lever on Right */}
        <div className="relative flex items-center justify-center w-full max-w-3xl">
          {/* Main Slot Machine Cabinet Frame */}
          <div className="relative flex-1 bg-gradient-to-b from-[#1c1208] via-slate-950 to-[#1c1208] p-2 sm:p-6 rounded-[24px] sm:rounded-[32px] border-2 sm:border-4 border-amber-500/90 shadow-[0_30px_70px_rgba(0,0,0,0.95)] ring-2 sm:ring-4 ring-yellow-500/30 overflow-hidden">
            {/* Top Cabinet Crown */}
            <div className="flex items-center justify-between px-3 py-1 mb-2 bg-slate-900/90 rounded-xl border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>5 CUỘN · 5 ĐƯỜNG TRẢ THƯỞNG</span>
              </div>
              <span className="text-yellow-400">PG SOFT / CASINO ENGINE</span>
            </div>

            {/* 5-Reel Window Grid */}
            <div className="relative grid grid-cols-5 gap-1.5 sm:gap-2.5 bg-black/95 p-2 sm:p-3.5 rounded-2xl border-2 border-slate-800 shadow-inner overflow-hidden">
              {/* Laser Paylines Overlay SVG */}
              {winningLines.length > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                  {winningLines.map((wl, idx) => {
                    const rowIndices = PAYLINES[wl.lineIdx];
                    const points = rowIndices.map((r, c) => {
                      const x = (c + 0.5) * (100 / 5);
                      const y = (r + 0.5) * (100 / 3);
                      return `${x}%,${y}%`;
                    }).join(' ');
                    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#a855f7'];
                    return (
                      <polyline
                        key={idx}
                        points={points}
                        fill="none"
                        stroke={colors[idx % colors.length]}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-pulse"
                        style={{ filter: `drop-shadow(0 0 8px ${colors[idx % colors.length]})` }}
                      />
                    );
                  })}
                </svg>
              )}

              {reels.map((col, colIdx) => {
                const isReelSpinning = reelSpinning[colIdx];
                const isAnticipating = reelAnticipation[colIdx];

                return (
                  <div
                    key={colIdx}
                    className={`relative flex flex-col gap-1.5 p-1 rounded-xl transition-all duration-200 border ${
                      isAnticipating
                        ? 'border-yellow-300 ring-4 ring-amber-400/80 bg-amber-950/40 animate-pulse'
                        : 'border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-900/90'
                    }`}
                  >
                    {col.map((sym, rowIdx) => {
                      const isWinningSymbol = winningLines.some((wl) => {
                        const linePattern = PAYLINES[wl.lineIdx];
                        return linePattern[colIdx] === rowIdx;
                      });

                      return (
                        <div
                          key={rowIdx}
                          className={`relative ${
                            isMobile ? 'h-15' : 'h-18 sm:h-24'
                          } rounded-lg flex flex-col items-center justify-center transition-all duration-200 border overflow-hidden ${
                            isWinningSymbol
                              ? 'bg-amber-500/30 border-yellow-300 ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.6)] scale-105 z-10 animate-bounce'
                              : isReelSpinning
                              ? 'bg-slate-950/90 border-slate-800 blur-[1px]'
                              : 'bg-slate-950/70 border-slate-800/60'
                          }`}
                        >
                          {/* Motion Blur Trail when reel is active */}
                          {isReelSpinning && (
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-400/10 to-transparent animate-pulse pointer-events-none" />
                          )}

                          <span className={`${isMobile ? 'text-2xl' : 'text-3xl sm:text-5xl'} select-none transition-transform ${isReelSpinning ? 'scale-90 opacity-70' : 'scale-100'}`}>
                            {sym.emoji}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] font-bold mt-1 truncate max-w-full px-1 ${sym.color}`}>
                            {sym.name.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Winning Display Bar with Count-Up Animation */}
            <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs sm:text-sm font-mono shadow-inner">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Dòng thắng:</span>
                <span className="font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  {winningLines.length > 0 ? `${winningLines.length} Dòng Trúng` : 'Chưa có'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Thưởng:</span>
                <span className="font-bold text-emerald-400 text-base sm:text-xl tabular-nums drop-shadow">
                  +${animatedWin.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Mechanical Pull Lever on Right */}
          <div className="hidden sm:flex flex-col items-center justify-center pl-3 -mr-6 z-20">
            <div className="relative w-8 h-48 flex flex-col items-center cursor-pointer group" onClick={pullLever} title="Gạt cần để quay!">
              {/* Lever Base Socket */}
              <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-6 h-14 bg-gradient-to-r from-slate-700 to-slate-900 rounded-l-lg border border-slate-600 shadow-md" />

              {/* Lever Shaft */}
              <div
                className={`w-3.5 bg-gradient-to-r from-slate-300 via-white to-slate-400 rounded-full transition-transform duration-300 origin-bottom shadow-lg ${
                  leverPulled ? 'h-24 translate-y-20 rotate-45' : 'h-36 group-hover:scale-y-105'
                }`}
              />

              {/* Red Ruby Ball Handle */}
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-tr from-rose-700 via-red-500 to-rose-300 border-2 border-yellow-200 shadow-[0_0_20px_rgba(244,63,94,0.8)] transition-all duration-300 flex items-center justify-center text-xs font-bold text-white ${
                  leverPulled ? 'translate-y-20 scale-90' : 'group-hover:scale-110 -translate-y-3'
                }`}
              >
                PULL
              </div>
            </div>
          </div>
        </div>

        {/* Slot Controls Console */}
        <div className="w-full max-w-2xl mt-4 p-3.5 sm:p-4 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-xl">
          {/* Bet Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase">Mức Cược:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                disabled={betIndex === 0 || isSpinning}
                onClick={() => {
                  sounds.playClick();
                  setBetIndex((prev) => Math.max(0, prev - 1));
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-bold flex items-center justify-center transition-colors"
              >
                -
              </button>
              <span className="w-16 text-center font-mono font-bold text-amber-300 text-sm">
                ${currentBet}
              </span>
              <button
                disabled={betIndex === BET_OPTIONS.length - 1 || isSpinning}
                onClick={() => {
                  sounds.playClick();
                  setBetIndex((prev) => Math.min(BET_OPTIONS.length - 1, prev + 1));
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-bold flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Quick Options */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                setFastSpin(!fastSpin);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                fastSpin
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              ⚡ Quay Nhanh
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                setAutoSpin(!autoSpin);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                autoSpin
                  ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {autoSpin ? 'Dừng Tự Động' : '🔄 Tự Động'}
            </button>
          </div>

          {/* Big Spin CTA Button */}
          <button
            onClick={spin}
            disabled={isSpinning}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
              isSpinning
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 border border-amber-300 shadow-amber-500/30'
            }`}
          >
            <span>{isSpinning ? 'ĐANG QUAY...' : freeSpinsLeft > 0 ? 'QUAY MIỄN PHÍ' : 'QUAY NGAY'}</span>
            <span>🎰</span>
          </button>
        </div>
      </main>

      {/* Paytable Footer */}
      <footer className="p-3 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500">
        Trả thưởng 5 dòng cược · 777 nổ Jackpot · 👑 WILD thay thế biểu tượng · 💰 3 SCATTER kích hoạt vòng quay miễn phí
      </footer>
    </div>
  );
};
