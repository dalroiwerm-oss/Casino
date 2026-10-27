import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../../logic/audio';
import { UserProfile } from '../../logic/auth';
import { DeviceModeSelector } from '../../components/DeviceModeSelector';
import { useDeviceMode } from '../../logic/device';

interface ScratchCardGameProps {
  currentUser: UserProfile | null;
  onUpdateChips: (newChips: number, wonAmount: number) => void;
  onExit: () => void;
  onRequireRegister: () => void;
}

interface TicketTier {
  id: string;
  name: string;
  price: number;
  topPrize: number;
  color: string;
  badge: string;
  spotsCount: number;
}

const TIERS: TicketTier[] = [
  { id: 'bronze', name: 'Vé Bạc Phú Quý', price: 100, topPrize: 10000, color: 'from-slate-700 via-slate-800 to-amber-950', badge: 'PHỔ THÔNG', spotsCount: 8 },
  { id: 'gold', name: 'Vé Vàng Tài Lộc', price: 500, topPrize: 50000, color: 'from-amber-600 via-yellow-700 to-amber-950', badge: 'CAO CẤP', spotsCount: 10 },
  { id: 'diamond', name: 'Triệu Phú Kim Cương', price: 2000, topPrize: 500000, color: 'from-cyan-600 via-blue-900 to-slate-950', badge: 'SIÊU VIP', spotsCount: 12 },
];

interface SpotData {
  id: number;
  number: number;
  prize: number;
  multiplier: number;
  isWinning: boolean;
  isScratched: boolean;
}

interface DustParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export const ScratchCardGame: React.FC<ScratchCardGameProps> = ({
  currentUser,
  onUpdateChips,
  onExit,
  onRequireRegister,
}) => {
  const [chips, setChips] = useState<number>(currentUser?.chips || 2500);
  const [selectedTierIdx, setSelectedTierIdx] = useState<number>(1);
  const [ticketKey, setTicketKey] = useState<number>(1);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([7, 28, 68]);
  const [spots, setSpots] = useState<SpotData[]>([]);
  const [isTicketBought, setIsTicketBought] = useState<boolean>(false);
  const [scratchedCount, setScratchedCount] = useState<number>(0);
  const [ticketWonAmount, setTicketWonAmount] = useState<number>(0);
  const [isClaimed, setIsClaimed] = useState<boolean>(false);

  // Scratch Dust & Coin Cursor
  const [coinPos, setCoinPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [dustParticles, setDustParticles] = useState<DustParticle[]>([]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const currentTier = TIERS[selectedTierIdx];

  // Sync user chips
  useEffect(() => {
    if (currentUser?.chips !== undefined) {
      setChips(currentUser.chips);
    }
  }, [currentUser?.chips]);

  // Particle update loop
  useEffect(() => {
    if (dustParticles.length === 0) return;
    const interval = setInterval(() => {
      setDustParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            alpha: p.alpha - 0.05,
          }))
          .filter((p) => p.alpha > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, [dustParticles.length]);

  // Generate fresh ticket numbers
  const generateTicket = () => {
    const winSet = new Set<number>();
    while (winSet.size < 3) {
      winSet.add(Math.floor(1 + Math.random() * 99));
    }
    const winArr = Array.from(winSet);
    setWinningNumbers(winArr);

    const newSpots: SpotData[] = [];
    const willWin = Math.random() < 0.48; // 48% hit rate
    const winningIndex = willWin ? Math.floor(Math.random() * currentTier.spotsCount) : -1;

    for (let i = 0; i < currentTier.spotsCount; i++) {
      let num = Math.floor(1 + Math.random() * 99);
      let isMatch = false;
      let prizeMultiplier = 1;

      if (i === winningIndex || (willWin && Math.random() < 0.3)) {
        num = winArr[Math.floor(Math.random() * winArr.length)];
        isMatch = true;
        const r = Math.random();
        if (r < 0.05) prizeMultiplier = 50;
        else if (r < 0.15) prizeMultiplier = 20;
        else if (r < 0.35) prizeMultiplier = 5;
        else if (r < 0.65) prizeMultiplier = 2;
        else prizeMultiplier = 1;
      } else {
        while (winSet.has(num)) {
          num = Math.floor(1 + Math.random() * 99);
        }
        prizeMultiplier = Math.random() < 0.3 ? 1 : Math.random() < 0.7 ? 2 : 5;
      }

      newSpots.push({
        id: i,
        number: num,
        prize: currentTier.price * prizeMultiplier,
        multiplier: Math.random() < 0.15 ? (Math.random() < 0.5 ? 2 : 5) : 1,
        isWinning: isMatch,
        isScratched: false,
      });
    }

    setSpots(newSpots);
    setScratchedCount(0);
    setTicketWonAmount(0);
    setIsClaimed(false);
  };

  // Buy a new ticket
  const handleBuyTicket = () => {
    if (!currentUser) {
      onRequireRegister();
      return;
    }

    if (chips < currentTier.price) {
      sounds.playFold();
      alert('Số dư chip không đủ để mua vé này!');
      return;
    }

    sounds.playChips();
    const updated = chips - currentTier.price;
    setChips(updated);
    onUpdateChips(updated, -currentTier.price);
    setIsTicketBought(true);
    setTicketKey((k) => k + 1);
    generateTicket();
  };

  const spawnDust = (x: number, y: number) => {
    const newDust: DustParticle[] = [];
    for (let i = 0; i < 4; i++) {
      newDust.push({
        id: Math.random(),
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        size: 2 + Math.random() * 4,
        alpha: 0.9,
      });
    }
    setDustParticles((prev) => [...prev.slice(-40), ...newDust]);
  };

  // Scratch a spot
  const handleScratchSpot = (spotId: number, clientX?: number, clientY?: number) => {
    if (!isTicketBought) return;

    if (clientX && clientY && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      spawnDust(clientX - rect.left, clientY - rect.top);
    }

    setSpots((prev) => {
      const target = prev.find((s) => s.id === spotId);
      if (!target || target.isScratched) return prev;

      sounds.playClick();
      const updated = prev.map((s) => (s.id === spotId ? { ...s, isScratched: true } : s));
      const newlyScratched = updated.filter((s) => s.isScratched).length;
      setScratchedCount(newlyScratched);

      if (newlyScratched === currentTier.spotsCount) {
        checkTicketWin(updated);
      }
      return updated;
    });
  };

  // Auto scratch all with sparkling sweep
  const handleScratchAll = () => {
    if (!isTicketBought) return;
    sounds.playCardDeal();

    spots.forEach((s, idx) => {
      setTimeout(() => {
        sounds.playClick();
        setSpots((prev) => {
          const updated = prev.map((item, i) => (i <= idx ? { ...item, isScratched: true } : item));
          setScratchedCount(idx + 1);
          if (idx === spots.length - 1) {
            checkTicketWin(updated);
          }
          return updated;
        });
      }, idx * 100);
    });
  };

  const checkTicketWin = (scratchedSpots: SpotData[]) => {
    let totalWin = 0;
    scratchedSpots.forEach((s) => {
      if (s.isWinning) {
        totalWin += s.prize * s.multiplier;
      }
    });

    setTicketWonAmount(totalWin);
    if (totalWin > 0) {
      sounds.playWin();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      const updated = chips + totalWin;
      setChips(updated);
      onUpdateChips(updated, totalWin);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoinPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!cardRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    setCoinPos({ x, y, visible: true });

    // Find if the finger is touching an unscratched spot
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const spotElement = element?.closest('[data-spot-id]');
    if (spotElement) {
      const spotId = Number(spotElement.getAttribute('data-spot-id'));
      if (!isNaN(spotId)) {
        handleScratchSpot(spotId, touch.clientX, touch.clientY);
      }
    }
  };

  return (
    <div
      className="min-h-[100dvh] w-full max-w-full bg-slate-950 text-white flex flex-col justify-between select-none overflow-x-hidden"
      onMouseUp={() => setIsMouseDown(false)}
      onTouchEnd={() => {
        setIsMouseDown(false);
        setCoinPos((prev) => ({ ...prev, visible: false }));
      }}
    >
      {/* Header */}
      <header className="px-4 sm:px-8 py-3 bg-slate-900/90 border-b border-amber-950/80 flex items-center justify-between backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            ← Sảnh Game
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎟️</span>
            <span className="font-serif font-black text-amber-400 tracking-wider text-sm sm:text-base">
              CÀO VÉ SỐ KIM CƯƠNG PHÚ QUÝ
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <DeviceModeSelector compact={true} />
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 font-mono text-xs shadow-inner">
            <span className="text-slate-400">Ví:</span>
            <span className="text-emerald-400 font-bold text-xs sm:text-sm tabular-nums">${chips.toLocaleString()}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto p-3 sm:p-6 flex flex-col items-center justify-center flex-1">
        {/* Tier Selector */}
        {!isTicketBought && (
          <div className="w-full max-w-xl mb-6 animate-in fade-in">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
              Chọn Hạng Thẻ Cào May Mắn:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIERS.map((tier, idx) => (
                <button
                  key={tier.id}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedTierIdx(idx);
                  }}
                  className={`p-4 rounded-3xl border text-left transition-all ${
                    selectedTierIdx === idx
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400 shadow-xl scale-102'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-black/60 text-amber-400 font-mono">
                      {tier.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ${tier.price}
                    </span>
                  </div>
                  <div className="font-bold text-white text-sm mt-1">{tier.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Giải nhất: <strong className="text-amber-300 font-mono">${tier.topPrize.toLocaleString()}</strong>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={handleBuyTicket}
                className="px-10 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 active:scale-95 transition-all"
              >
                MUA VÉ CÀO (${currentTier.price}) ▶
              </button>
            </div>
          </div>
        )}

        {/* Scratch Card Ticket View */}
        {isTicketBought && (
          <div className="w-full max-w-xl flex flex-col items-center">
            {/* The Ticket Container */}
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseDown={() => setIsMouseDown(true)}
              onMouseEnter={() => setCoinPos((prev) => ({ ...prev, visible: true }))}
              onMouseLeave={() => setCoinPos((prev) => ({ ...prev, visible: false }))}
              onTouchStart={(e) => {
                setIsMouseDown(true);
                handleTouchMove(e);
              }}
              onTouchMove={handleTouchMove}
              className={`relative w-full rounded-[24px] sm:rounded-[32px] p-3.5 sm:p-7 border-4 border-amber-400/90 shadow-[0_25px_60px_rgba(0,0,0,0.9)] bg-gradient-to-br ${currentTier.color} overflow-hidden cursor-crosshair`}
            >
              {/* Foil Shimmer Texture */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_70%)] pointer-events-none" />

              {/* Real-time Scratch Dust Particles Overlay */}
              {dustParticles.map((pt) => (
                <div
                  key={pt.id}
                  className="absolute rounded-full pointer-events-none z-30 bg-gradient-to-tr from-slate-200 to-amber-200 shadow-sm"
                  style={{
                    left: `${pt.x}px`,
                    top: `${pt.y}px`,
                    width: `${pt.size}px`,
                    height: `${pt.size}px`,
                    opacity: pt.alpha,
                  }}
                />
              ))}

              {/* Realistic 3D Shiny Gold Coin Tool Cursor */}
              {coinPos.visible && (
                <div
                  className="absolute pointer-events-none z-40 w-9 h-9 sm:w-10 sm:h-10 -ml-4.5 -mt-4.5 sm:-ml-5 sm:-mt-5 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-500 border-2 border-yellow-100 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center justify-center font-serif font-black text-amber-950 text-xs transition-transform duration-75"
                  style={{
                    left: `${coinPos.x}px`,
                    top: `${coinPos.y}px`,
                    transform: isMouseDown ? 'scale(0.85) rotate(-15deg)' : 'scale(1) rotate(0deg)',
                  }}
                >
                  ★
                </div>
              )}

              {/* Ticket Header */}
              <div className="flex items-center justify-between pb-2 sm:pb-3 mb-3 sm:mb-4 border-b border-white/20">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-amber-300 font-mono uppercase tracking-wider">
                    {currentTier.badge}
                  </span>
                  <h3 className="text-base sm:text-2xl font-black text-white font-serif uppercase tracking-wide mt-0.5 sm:mt-1">
                    {currentTier.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] sm:text-[10px] text-slate-300 block uppercase">Giải Đặc Biệt</span>
                  <span className="font-mono font-black text-lg sm:text-2xl text-yellow-300 drop-shadow">
                    ${currentTier.topPrize.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Winning Numbers Box */}
              <div className="bg-black/60 p-2.5 sm:p-3.5 rounded-2xl border border-amber-400/40 mb-3 sm:mb-4 text-center">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-300 tracking-wider">
                  ⭐ CON SỐ MAY MẮN CẦN TRÚNG ⭐
                </span>
                <div className="flex items-center justify-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                  {winningNumbers.map((num) => (
                    <div
                      key={num}
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-white text-slate-950 font-mono font-black text-base sm:text-lg flex items-center justify-center shadow-lg"
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>

              {/* Scratch Spots Grid with Silver/Gold Foil Coating */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-2.5">
                {spots.map((spot) => (
                  <div
                    key={spot.id}
                    data-spot-id={spot.id}
                    onMouseEnter={(e) => {
                      if (isMouseDown && !spot.isScratched) {
                        handleScratchSpot(spot.id, e.clientX, e.clientY);
                      }
                    }}
                    onClick={(e) => handleScratchSpot(spot.id, e.clientX, e.clientY)}
                    className="relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden shadow-md cursor-pointer transition-transform hover:scale-103"
                  >
                    {/* Underlying Revealed Value */}
                    <div
                      className={`w-full h-full flex flex-col items-center justify-center p-1 border ${
                        spot.isWinning
                          ? 'bg-amber-400/30 border-yellow-300 ring-2 ring-yellow-400 animate-pulse'
                          : 'bg-slate-950/90 border-slate-800'
                      }`}
                    >
                      <span
                        className={`text-base sm:text-xl font-mono font-black ${
                          spot.isWinning ? 'text-yellow-300 scale-110 drop-shadow' : 'text-slate-200'
                        }`}
                      >
                        {spot.number}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        ${spot.prize.toLocaleString()}
                      </span>
                      {spot.multiplier > 1 && (
                        <span className="text-[9px] font-bold px-1 rounded bg-rose-600 text-white font-mono">
                          x{spot.multiplier}
                        </span>
                      )}
                    </div>

                    {/* Realistic Scratch-Off Latex Foil Cover */}
                    {!spot.isScratched && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-400 via-slate-300 to-slate-200 border-2 border-slate-300 flex flex-col items-center justify-center text-slate-600 shadow-inner group">
                        <span className="text-xl group-hover:scale-110 transition-transform">🪙</span>
                        <span className="text-[9px] font-black uppercase text-slate-700 tracking-tighter">
                          CÀO
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Ticket Footer / Win Status */}
              <div className="mt-4 p-3 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400">Đã cào: </span>
                  <span className="font-bold text-amber-300">
                    {scratchedCount}/{currentTier.spotsCount} ô
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Trúng thưởng: </span>
                  <span className="font-bold text-emerald-400 text-sm sm:text-base">
                    ${ticketWonAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="w-full mt-4 flex items-center justify-between gap-3">
              <button
                onClick={handleScratchAll}
                disabled={scratchedCount === currentTier.spotsCount}
                className="px-5 py-3 rounded-2xl bg-purple-950 hover:bg-purple-900 disabled:opacity-40 border border-purple-500/50 text-purple-200 font-bold text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <span>✨</span>
                <span>CÀO NHANH TẤT CẢ</span>
              </button>

              <button
                onClick={() => {
                  setIsTicketBought(false);
                  sounds.playClick();
                }}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wide transition-all shadow-lg active:scale-95"
              >
                MUA VÉ KHÁC
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-3 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500">
        Di chuột hoặc chạm để cào bay lớp bạc · Tỷ lệ nổ thưởng cao · Trúng thưởng nhận ngay vào ví
      </footer>
    </div>
  );
};
