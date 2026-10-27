import React, { useEffect } from 'react';
import { GameMode, TableTheme } from '../types/poker';
import { sounds } from '../logic/audio';
import { DeviceModeSelector } from './DeviceModeSelector';

interface TitleScreenProps {
  onStartGame: (config: {
    mode: GameMode;
    theme: TableTheme;
    smallBlind: number;
    bigBlind: number;
    initialChips: number;
  }) => void;
  selectedMode: GameMode;
  setSelectedMode: (mode: GameMode) => void;
  selectedTheme: TableTheme;
  setSelectedTheme: (theme: TableTheme) => void;
  stakeTier: number;
  setStakeTier: (tier: number) => void;
  onOpenHandRankings: () => void;
  onOpenRoomMode: () => void;
  onBackToGameList: () => void;
}

const STAKE_TIERS = [
  { name: 'Tập Sự (Casual)', sb: 10, bb: 20, buyIn: 1000 },
  { name: 'Cao Thủ (Standard)', sb: 25, bb: 50, buyIn: 2500 },
  { name: 'Đại Gia (High Roller)', sb: 100, bb: 200, buyIn: 10000 },
];

const THEMES: { id: TableTheme; name: string; color: string }[] = [
  { id: 'EMERALD', name: 'Ngọc Lục Bảo', color: '#064e3b' },
  { id: 'MIDNIGHT', name: 'Đêm Hoàng Gia', color: '#1e3a8a' },
  { id: 'BURGUNDY', name: 'Rượu Vang Đỏ', color: '#7f1d1d' },
  { id: 'CARBON', name: 'Carbon Tối Giản', color: '#18181b' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  selectedMode,
  setSelectedMode,
  selectedTheme,
  setSelectedTheme,
  stakeTier,
  setStakeTier,
  onOpenHandRankings,
  onOpenRoomMode,
  onBackToGameList,
}) => {
  const currentStake = STAKE_TIERS[stakeTier];

  const handleStart = React.useCallback(() => {
    sounds.playChips();
    onStartGame({
      mode: selectedMode,
      theme: selectedTheme,
      smallBlind: currentStake.sb,
      bigBlind: currentStake.bb,
      initialChips: currentStake.buyIn,
    });
  }, [onStartGame, selectedMode, selectedTheme, currentStake.sb, currentStake.bb, currentStake.buyIn]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleStart();
      } else if (e.key === 'h' || e.key === 'H') {
        onOpenHandRankings();
      } else if (e.key === 'Escape') {
        onBackToGameList();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStart, onOpenHandRankings, onBackToGameList]);

  return (
    <div className="relative w-full max-w-full min-h-[100dvh] bg-slate-950 flex flex-col justify-between p-3 sm:p-8 select-none overflow-x-hidden overflow-y-auto">
      {/* Background Lighting */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[900px] h-[350px] sm:h-[500px] rounded-full bg-emerald-600/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#020617_90%)]" />
      </div>

      {/* Top Bar with Touch Targets >= 44px */}
      <div className="relative z-10 flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sounds.playClick();
              onBackToGameList();
            }}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap active:scale-95 shadow-sm"
          >
            <span>←</span>
            <span>Danh Sách Trò Chơi</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <DeviceModeSelector compact={true} />
          <button
            onClick={() => {
              sounds.playClick();
              onOpenRoomMode();
            }}
            className="px-3 py-2 min-h-[44px] text-xs font-bold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <span>🏠</span>
            <span>Chế Độ Phòng (Tạo / Vào)</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onOpenHandRankings();
            }}
            className="px-3 py-2 min-h-[44px] text-xs font-medium text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors whitespace-nowrap flex items-center active:scale-95"
          >
            Hạng Bài [H]
          </button>
        </div>
      </div>

      {/* Center Setup Form */}
      <div className="relative z-10 max-w-2xl w-full mx-auto my-auto text-center flex flex-col items-center py-4 sm:py-8">
        {/* SVG Title Lockup */}
        <div className="mb-2 sm:mb-4">
          <svg className="w-56 sm:w-80 h-16 sm:h-20 mx-auto" viewBox="0 0 320 80">
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
            <text
              x="160"
              y="40"
              textAnchor="middle"
              fontFamily="ui-serif, Georgia, serif"
              fontSize="34"
              fontWeight="900"
              letterSpacing="3"
              fill="url(#goldGradient)"
            >
              TEXAS HOLD'EM
            </text>
            <text
              x="160"
              y="64"
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize="12"
              fontWeight="700"
              letterSpacing="8"
              fill="#94a3b8"
            >
              CHAMPIONSHIP SERIES
            </text>
          </svg>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-5 sm:mb-7 leading-relaxed px-2">
          Đấu trí cùng 5 đối thủ AI đỉnh cao với phong cách chơi thực tế và phân tích tỉ lệ thắng theo thời gian thực.
        </p>

        {/* Configuration Matrix */}
        <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md mb-5 sm:mb-7 text-left space-y-4 sm:space-y-5">
          {/* Game Mode */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Chế Độ Chơi:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedMode('CASH');
                }}
                className={`p-3 min-h-[56px] rounded-xl border text-left transition-all active:scale-[0.98] ${
                  selectedMode === 'CASH'
                    ? 'bg-amber-500/10 border-amber-400 text-white ring-1 ring-amber-400'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs sm:text-sm text-amber-300">Bàn Tiền Mặt (Cash Game)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Mức cược cố định, có thể nạp thêm chip bất cứ lúc nào.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedMode('TOURNAMENT');
                }}
                className={`p-3 min-h-[56px] rounded-xl border text-left transition-all active:scale-[0.98] ${
                  selectedMode === 'TOURNAMENT'
                    ? 'bg-amber-500/10 border-amber-400 text-white ring-1 ring-amber-400'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs sm:text-sm text-amber-300">Giải Đấu Sit & Go</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Blind tăng dần theo ván, đấu loại trực tiếp tới cúp vô địch!
                </div>
              </button>
            </div>

            {/* Room Mode Promotion Card */}
            <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-slate-800 to-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏠</span>
                  <span className="font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wide">
                    Chế Độ Phòng (Room Mode)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    BẠN BÈ
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Tự tạo bàn với mức cược tùy chỉnh hoặc tham gia bằng Mã Phòng (6 chữ số).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onOpenRoomMode();
                }}
                className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wide shadow-md shadow-amber-500/20 active:scale-95 transition-all whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <span>Tạo / Tham Gia Phòng</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Stake Tiers */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Mức Cược (Blind & Vốn):
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {STAKE_TIERS.map((tier, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setStakeTier(idx);
                  }}
                  className={`p-2 sm:p-2.5 min-h-[56px] rounded-xl border text-center transition-all active:scale-[0.97] ${
                    stakeTier === idx
                      ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] sm:text-xs font-bold text-white truncate">{tier.name.split(' ')[0]}</div>
                  <div className="text-[10px] sm:text-[11px] font-mono text-emerald-400 mt-0.5">
                    ${tier.sb}/${tier.bb}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400">
                    ${tier.buyIn.toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Table Felt Theme */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Màu Bàn Nỉ:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setSelectedTheme(theme.id);
                  }}
                  className={`flex items-center gap-2 p-2 min-h-[44px] rounded-xl border transition-all active:scale-[0.97] ${
                    selectedTheme === theme.id
                      ? 'bg-slate-800 border-amber-400 ring-1 ring-amber-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="text-[11px] sm:text-xs font-medium truncate">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start CTA with Mobile Thumb Fit */}
        <button
          onClick={handleStart}
          className="w-full sm:w-auto px-8 py-3.5 min-h-[50px] rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase shadow-xl shadow-amber-500/25 active:scale-95 transition-all border border-amber-300 flex items-center justify-center gap-2"
        >
          <span>BẮT ĐẦU VÀO BÀN</span>
          <span className="text-sm">→</span>
        </button>
      </div>

      {/* Control hints */}
      <div className="relative z-10 text-center py-2 text-[11px] text-slate-500 font-mono hidden sm:block">
        <span>Space Bắt đầu</span>
        <span className="mx-2">·</span>
        <span>H Bảng Hạng Bài</span>
        <span className="mx-2">·</span>
        <span>Esc Quay lại</span>
      </div>
    </div>
  );
};
