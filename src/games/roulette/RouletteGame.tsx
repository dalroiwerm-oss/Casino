import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../../logic/audio';
import { UserProfile } from '../../logic/auth';
import { DeviceModeSelector } from '../../components/DeviceModeSelector';
import { useDeviceMode } from '../../logic/device';

interface RouletteGameProps {
  currentUser: UserProfile | null;
  onUpdateChips: (newChips: number, wonAmount: number) => void;
  onExit: () => void;
  onRequireRegister: () => void;
}

// 37 European Roulette Numbers in authoritative wheel order
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function getNumberColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
}

const CHIP_DENOMS = [10, 25, 50, 100, 500];

export interface BetPlacement {
  id: string;
  type: 'straight' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3';
  label: string;
  number?: number;
  amount: number;
}

export const RouletteGame: React.FC<RouletteGameProps> = ({
  currentUser,
  onUpdateChips,
  onExit,
  onRequireRegister,
}) => {
  const [chips, setChips] = useState<number>(currentUser?.chips || 2500);
  const [selectedChip, setSelectedChip] = useState<number>(25);
  const [bets, setBets] = useState<BetPlacement[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([14, 7, 32, 0, 26]);

  // Physics-based wheel and ball rotations
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [ballRotation, setBallRotation] = useState<number>(0);
  const [ballRadius, setBallRadius] = useState<number>(90); // starts on outer track, drops to pocket

  // Sync user chips
  useEffect(() => {
    if (currentUser?.chips !== undefined) {
      setChips(currentUser.chips);
    }
  }, [currentUser?.chips]);

  const totalBetAmount = bets.reduce((sum, b) => sum + b.amount, 0);

  // Place a bet on a field
  const handlePlaceBet = (
    type: BetPlacement['type'],
    label: string,
    number?: number
  ) => {
    if (isSpinning) return;
    if (!currentUser) {
      onRequireRegister();
      return;
    }

    if (chips < totalBetAmount + selectedChip) {
      sounds.playFold();
      alert('Không đủ chip để đặt thêm cược!');
      return;
    }

    sounds.playChips();
    const betId = type === 'straight' ? `num_${number}` : type;

    setBets((prev) => {
      const existing = prev.find((b) => b.id === betId);
      if (existing) {
        return prev.map((b) => (b.id === betId ? { ...b, amount: b.amount + selectedChip } : b));
      }
      return [...prev, { id: betId, type, label, number, amount: selectedChip }];
    });
  };

  // Clear all bets
  const handleClearBets = () => {
    if (isSpinning) return;
    sounds.playClick();
    setBets([]);
  };

  // Spin the wheel with realistic ball deceleration physics
  const handleSpin = () => {
    if (isSpinning || bets.length === 0) return;
    if (!currentUser) {
      onRequireRegister();
      return;
    }

    if (chips < totalBetAmount) {
      sounds.playFold();
      alert('Không đủ chip để đặt cược!');
      return;
    }

    sounds.playChips();
    setIsSpinning(true);
    setWinningNumber(null);
    setLastWin(0);

    const updatedChips = chips - totalBetAmount;
    setChips(updatedChips);
    onUpdateChips(updatedChips, -totalBetAmount);

    // Pick winning number randomly
    const winningIdx = Math.floor(Math.random() * WHEEL_NUMBERS.length);
    const chosenNumber = WHEEL_NUMBERS[winningIdx];

    // Angular calculation: 360 / 37 ≈ 9.7297 degrees per pocket
    const pocketAngle = 360 / 37;
    const targetWheelAngle = 360 * 5 + (37 - winningIdx) * pocketAngle;
    const targetBallAngle = -(360 * 8 + winningIdx * pocketAngle);

    setWheelRotation((prev) => prev + targetWheelAngle);
    setBallRotation((prev) => prev + targetBallAngle);
    setBallRadius(92);

    // Sound effects for ball rolling
    const clackTicker = setInterval(() => {
      sounds.playClick();
    }, 180);

    setTimeout(() => {
      // Ball drops from outer track into inner pocket track
      setBallRadius(62);
      sounds.playChips();
    }, 2800);

    setTimeout(() => {
      clearInterval(clackTicker);
      setIsSpinning(false);
      setWinningNumber(chosenNumber);
      setHistory((prev) => [chosenNumber, ...prev.slice(0, 7)]);

      // Evaluate Winnings
      let totalWon = 0;
      const chosenColor = getNumberColor(chosenNumber);
      const isEven = chosenNumber !== 0 && chosenNumber % 2 === 0;
      const isOdd = chosenNumber !== 0 && chosenNumber % 2 !== 0;
      const isLow = chosenNumber >= 1 && chosenNumber <= 18;
      const isHigh = chosenNumber >= 19 && chosenNumber <= 36;
      const isDozen1 = chosenNumber >= 1 && chosenNumber <= 12;
      const isDozen2 = chosenNumber >= 13 && chosenNumber <= 24;
      const isDozen3 = chosenNumber >= 25 && chosenNumber <= 36;

      bets.forEach((bet) => {
        if (bet.type === 'straight' && bet.number === chosenNumber) {
          totalWon += bet.amount * 36;
        } else if (bet.type === 'red' && chosenColor === 'red') {
          totalWon += bet.amount * 2;
        } else if (bet.type === 'black' && chosenColor === 'black') {
          totalWon += bet.amount * 2;
        } else if (bet.type === 'even' && isEven) {
          totalWon += bet.amount * 2;
        } else if (bet.type === 'odd' && isOdd) {
          totalWon += bet.amount * 2;
        } else if (bet.type === 'low' && isLow) {
          totalWon += bet.amount * 2;
        } else if (bet.type === 'high' && isHigh) {
          totalWon += bet.amount * 2;
        } else if (bet.type === 'dozen1' && isDozen1) {
          totalWon += bet.amount * 3;
        } else if (bet.type === 'dozen2' && isDozen2) {
          totalWon += bet.amount * 3;
        } else if (bet.type === 'dozen3' && isDozen3) {
          totalWon += bet.amount * 3;
        }
      });

      setLastWin(totalWon);
      if (totalWon > 0) {
        sounds.playWin();
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 } });
        const newBal = updatedChips + totalWon;
        setChips(newBal);
        onUpdateChips(newBal, totalWon);
      } else {
        sounds.playFold();
      }
    }, 3600);
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-950 text-white flex flex-col justify-between select-none overflow-x-hidden">
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
            <span className="text-xl">🎡</span>
            <span className="font-serif font-black text-amber-400 tracking-wider text-sm sm:text-base">
              ROULETTE CHÂU ÂU HOÀNG GIA (37 SỐ)
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

      {/* Main Wheel & Table */}
      <main className="max-w-5xl w-full mx-auto p-2 sm:p-5 flex flex-col items-center justify-center flex-1">
        {/* Top 3D Wheel Stage & Real-time Ball Physics */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10 mb-5">
          {/* Authentic 3D Roulette Wheel */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border-[10px] sm:border-[14px] border-[#2c1a0e] bg-slate-950 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden ring-4 ring-amber-600/50">
            {/* Outer Brass Ball Track */}
            <div className="absolute inset-1 rounded-full border-2 border-amber-400/30" />

            {/* Rotating Pockets Wheel */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center transition-transform duration-[3600ms] cubic-bezier(0.12, 0.9, 0.24, 1)"
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              {/* 37 Colored Numbered Pockets Ring */}
              {WHEEL_NUMBERS.map((num, idx) => {
                const angle = (idx * 360) / 37;
                const color = getNumberColor(num);
                return (
                  <div
                    key={num}
                    className="absolute top-0 left-1/2 -ml-3 w-6 h-full flex flex-col items-center justify-start pointer-events-none"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className={`w-5 h-7 rounded-t-sm flex items-center justify-center text-[8px] font-mono font-black text-white shadow-sm ${
                        color === 'red'
                          ? 'bg-rose-600'
                          : color === 'black'
                          ? 'bg-slate-900 border-x border-slate-700'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {num}
                    </div>
                  </div>
                );
              })}

              {/* Center Bronze Turret with Quad Spoke Handles */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-700 via-yellow-500 to-amber-800 border-4 border-yellow-200 shadow-xl flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-amber-300 flex items-center justify-center text-xs font-black text-amber-300">
                  ★
                </div>
              </div>
            </div>

            {/* Counter-Rotating Ivory Ball */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none transition-transform duration-[3600ms] cubic-bezier(0.12, 0.9, 0.24, 1)"
              style={{ transform: `rotate(${ballRotation}deg)` }}
            >
              <div
                className="absolute left-1/2 -ml-2 -mt-2 w-4 h-4 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-400 border border-slate-300 shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-700"
                style={{ top: `${128 - ballRadius}px` }}
              />
            </div>

            {/* Center Result Spotlight Overlay */}
            {winningNumber !== null && (
              <div className="absolute z-20 w-24 h-24 rounded-full bg-black/85 border-2 border-yellow-300 flex flex-col items-center justify-center shadow-2xl animate-in zoom-in-50">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono leading-none ${
                    getNumberColor(winningNumber) === 'red'
                      ? 'text-rose-500'
                      : getNumberColor(winningNumber) === 'black'
                      ? 'text-slate-100'
                      : 'text-emerald-400'
                  }`}
                >
                  {winningNumber}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 mt-0.5">
                  {getNumberColor(winningNumber) === 'red' ? 'ĐỎ' : getNumberColor(winningNumber) === 'black' ? 'ĐEN' : 'SỐ 0'}
                </span>
              </div>
            )}
          </div>

          {/* History Billboard & Hot/Cold Numbers */}
          <div className="flex flex-col items-center md:items-start bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>📊 KẾT QUẢ GẦN NHẤT:</span>
            </span>
            <div className="flex items-center gap-1.5 mb-3">
              {history.map((num, idx) => {
                const color = getNumberColor(num);
                return (
                  <div
                    key={idx}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shadow-md border ${
                      color === 'red'
                        ? 'bg-rose-600 text-white border-rose-400'
                        : color === 'black'
                        ? 'bg-slate-900 text-white border-slate-700'
                        : 'bg-emerald-600 text-white border-emerald-400'
                    }`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Tổng tiền đặt cược: <strong className="text-amber-300">${totalBetAmount}</strong>
            </div>
          </div>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="w-full max-w-3xl flex items-center justify-between px-2 text-[10px] text-amber-300 sm:hidden mb-1">
          <span>👉 Vuốt ngang để xem và đặt cược số 0 - 36</span>
          <span className="font-mono font-bold text-emerald-400">Đã cược: ${totalBetAmount}</span>
        </div>

        {/* Felt Betting Table (European Layout with Chip Stacks) */}
        <div className="w-full max-w-3xl overflow-x-auto touch-pan-x pb-2 scrollbar-none">
          <div className="min-w-[620px] sm:min-w-0 bg-gradient-to-b from-[#0a3520] via-[#052214] to-[#0a3520] p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] border-4 border-amber-600 shadow-2xl relative">
          {/* Numbers Grid: 0 on left, 1-36 on right */}
          <div className="flex gap-2 mb-2.5">
            {/* Zero (0) Button */}
            <button
              onClick={() => handlePlaceBet('straight', 'Số 0', 0)}
              className={`w-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-black text-base flex flex-col items-center justify-center transition-all active:scale-95 shadow-md border border-emerald-400 relative ${
                winningNumber === 0 ? 'ring-4 ring-yellow-300 animate-pulse' : ''
              }`}
            >
              <span>0</span>
              {bets.find((b) => b.id === 'num_0') && (
                <span className="mt-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-bold text-[9px] shadow">
                  ${bets.find((b) => b.id === 'num_0')?.amount}
                </span>
              )}
            </button>

            {/* 36 Numbers Grid */}
            <div className="flex-1 grid grid-cols-12 gap-1 font-mono text-xs font-bold">
              {Array.from({ length: 36 }).map((_, i) => {
                const num = i + 1;
                const color = getNumberColor(num);
                const bet = bets.find((b) => b.id === `num_${num}`);
                const isWinningSpot = winningNumber === num;

                return (
                  <button
                    key={num}
                    onClick={() => handlePlaceBet('straight', `Số ${num}`, num)}
                    className={`h-10 rounded-xl flex flex-col items-center justify-center relative transition-transform active:scale-90 shadow border ${
                      isWinningSpot ? 'ring-4 ring-yellow-300 scale-105 z-10' : ''
                    } ${
                      color === 'red'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                    }`}
                  >
                    <span>{num}</span>
                    {bet && (
                      <span className="text-[8px] px-1 rounded-full bg-amber-400 text-slate-950 font-black shadow -mt-0.5">
                        ${bet.amount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dozens Row */}
          <div className="grid grid-cols-3 gap-2 mb-2 font-mono text-xs font-bold">
            <button
              onClick={() => handlePlaceBet('dozen1', '1st 12 (1-12)')}
              className="py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-amber-300 relative transition-all active:scale-95"
            >
              1st 12 (1 - 12)
              {bets.find((b) => b.id === 'dozen1') && (
                <span className="ml-1 text-[10px] text-emerald-400">
                  (${bets.find((b) => b.id === 'dozen1')?.amount})
                </span>
              )}
            </button>
            <button
              onClick={() => handlePlaceBet('dozen2', '2nd 12 (13-24)')}
              className="py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-amber-300 relative transition-all active:scale-95"
            >
              2nd 12 (13 - 24)
              {bets.find((b) => b.id === 'dozen2') && (
                <span className="ml-1 text-[10px] text-emerald-400">
                  (${bets.find((b) => b.id === 'dozen2')?.amount})
                </span>
              )}
            </button>
            <button
              onClick={() => handlePlaceBet('dozen3', '3rd 12 (25-36)')}
              className="py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-amber-300 relative transition-all active:scale-95"
            >
              3rd 12 (25 - 36)
              {bets.find((b) => b.id === 'dozen3') && (
                <span className="ml-1 text-[10px] text-emerald-400">
                  (${bets.find((b) => b.id === 'dozen3')?.amount})
                </span>
              )}
            </button>
          </div>

          {/* Outside Bets Row (1:1 Payouts: Red/Black, Even/Odd, 1-18/19-36) */}
          <div className="grid grid-cols-6 gap-2 font-mono text-xs font-bold">
            <button
              onClick={() => handlePlaceBet('low', '1-18')}
              className="py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
            >
              1 - 18
              {bets.find((b) => b.id === 'low') && (
                <span className="block text-[9px] text-emerald-400">
                  ${bets.find((b) => b.id === 'low')?.amount}
                </span>
              )}
            </button>

            <button
              onClick={() => handlePlaceBet('even', 'Chẵn')}
              className="py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
            >
              CHẴN
              {bets.find((b) => b.id === 'even') && (
                <span className="block text-[9px] text-emerald-400">
                  ${bets.find((b) => b.id === 'even')?.amount}
                </span>
              )}
            </button>

            <button
              onClick={() => handlePlaceBet('red', 'Đỏ')}
              className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black border border-rose-400 active:scale-95"
            >
              ĐỎ
              {bets.find((b) => b.id === 'red') && (
                <span className="block text-[9px] text-yellow-300">
                  ${bets.find((b) => b.id === 'red')?.amount}
                </span>
              )}
            </button>

            <button
              onClick={() => handlePlaceBet('black', 'Đen')}
              className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black border border-slate-700 active:scale-95"
            >
              ĐEN
              {bets.find((b) => b.id === 'black') && (
                <span className="block text-[9px] text-yellow-300">
                  ${bets.find((b) => b.id === 'black')?.amount}
                </span>
              )}
            </button>

            <button
              onClick={() => handlePlaceBet('odd', 'Lẻ')}
              className="py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
            >
              LẺ
              {bets.find((b) => b.id === 'odd') && (
                <span className="block text-[9px] text-emerald-400">
                  ${bets.find((b) => b.id === 'odd')?.amount}
                </span>
              )}
            </button>

            <button
              onClick={() => handlePlaceBet('high', '19-36')}
              className="py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
            >
              19 - 36
              {bets.find((b) => b.id === 'high') && (
                <span className="block text-[9px] text-emerald-400">
                  ${bets.find((b) => b.id === 'high')?.amount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

        {/* Chip Tray & Action Controls */}
        <div className="w-full max-w-3xl mt-4 p-3.5 sm:p-4 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
          {/* Denominations */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase">Chọn Chip:</span>
            <div className="flex items-center gap-1.5">
              {CHIP_DENOMS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedChip(amt);
                  }}
                  className={`w-9 h-9 rounded-full font-mono font-black text-xs border flex items-center justify-center transition-all active:scale-95 ${
                    selectedChip === amt
                      ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 border-white shadow-lg shadow-amber-500/40 scale-110'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleClearBets}
              disabled={isSpinning || bets.length === 0}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold transition-all"
            >
              XÓA CƯỢC
            </button>

            <button
              onClick={handleSpin}
              disabled={isSpinning || bets.length === 0}
              className={`flex-1 sm:flex-initial px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
                isSpinning || bets.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 border border-amber-300 shadow-amber-500/30'
              }`}
            >
              <span>{isSpinning ? 'ĐANG QUAY...' : `QUAY (${totalBetAmount > 0 ? `$${totalBetAmount}` : 'ĐẶT CƯỢC'})`}</span>
              <span>🎡</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-3 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500">
        Bàn Roulette Châu Âu 37 số chuẩn quốc tế · Tỷ lệ trả thưởng số thẳng 1:36 · Cược màu 1:2
      </footer>
    </div>
  );
};
