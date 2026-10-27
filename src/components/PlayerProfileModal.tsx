import React, { useState } from 'react';
import { UserProfile, claimDailyReward, saveUser } from '../logic/auth';
import { sounds } from '../logic/audio';
import confetti from 'canvas-confetti';

interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onOpenEditName: () => void;
  onLogout: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onOpenEditName,
  onLogout,
}) => {
  const [rewardMsg, setRewardMsg] = useState<{ text: string; isSuccess: boolean } | null>(null);

  if (!isOpen) return null;

  // Determine VIP Tier based on chips
  const getVIPTier = (chips: number) => {
    if (chips >= 500000) return { name: 'Kim Cương (Diamond)', color: 'text-cyan-400', bg: 'bg-cyan-950/80 border-cyan-700', icon: '💎' };
    if (chips >= 100000) return { name: 'Bạch Kim (Platinum)', color: 'text-purple-300', bg: 'bg-purple-950/80 border-purple-700', icon: '👑' };
    if (chips >= 20000) return { name: 'Vàng (Gold VIP)', color: 'text-amber-400', bg: 'bg-amber-950/80 border-amber-700', icon: '🥇' };
    if (chips >= 5000) return { name: 'Bạc (Silver)', color: 'text-slate-300', bg: 'bg-slate-800 border-slate-600', icon: '🥈' };
    return { name: 'Đồng (Bronze)', color: 'text-amber-600', bg: 'bg-amber-950/30 border-amber-800/40', icon: '🥉' };
  };

  const tier = getVIPTier(currentUser.chips);
  const totalHands = currentUser.handsPlayed || 0;
  const wonHands = currentUser.handsWon || 0;
  const winRate = totalHands > 0 ? Math.round((wonHands / totalHands) * 100) : 0;
  const today = new Date().toDateString();
  const hasClaimedDaily = currentUser.lastDailyReward === today;

  const handleClaimReward = () => {
    sounds.playChips();
    const res = claimDailyReward(currentUser);
    setRewardMsg({ text: res.message, isSuccess: res.success });

    if (res.success) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      sounds.playWin();
      onUserUpdated(res.updatedUser);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-xl max-h-[90dvh] bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black font-serif tracking-wider text-amber-400">
              HỒ SƠ NGƯỜI CHƠI
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Hero Profile Banner */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800">
            {/* Avatar circle */}
            <div className="relative">
              <div
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-xl border-4 border-slate-800"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 text-lg">
                {tier.icon}
              </div>
            </div>

            {/* Profile Info & Edit Button */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black text-white truncate">
                    {currentUser.name}
                  </h2>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tier.bg} ${tier.color}`}>
                      {tier.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Gia nhập: {new Date(currentUser.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sounds.playClick();
                    onOpenEditName();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors self-center sm:self-start whitespace-nowrap"
                >
                  ✏️ Đổi Tên
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Balance Card & Daily Reward */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-amber-500/40 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Số Dư Chip Hiện Có (Wallet):
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tabular-nums mt-1 flex items-baseline gap-1">
                  <span>${currentUser.chips.toLocaleString()}</span>
                  <span className="text-xs font-normal text-slate-400">CHIP</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Sử dụng tự do cho mọi bàn cược Texas Hold'em và các trò chơi khác
                </div>
              </div>

              {/* Daily Reward Button */}
              <button
                onClick={handleClaimReward}
                disabled={hasClaimedDaily}
                className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 ${
                  hasClaimedDaily
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 border border-amber-300 shadow-amber-500/20'
                }`}
              >
                <span>{hasClaimedDaily ? '✓ Đã Nhận Hôm Nay' : '🎁 Điểm Danh +$1,000'}</span>
              </button>
            </div>

            {/* Daily Reward Feedback Alert */}
            {rewardMsg && (
              <div
                className={`mt-3 p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                  rewardMsg.isSuccess
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span>{rewardMsg.isSuccess ? '🎉' : 'ℹ️'}</span>
                <span>{rewardMsg.text}</span>
              </div>
            )}
          </div>

          {/* Career Stats Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Thống Kê Chiến Tích Poker:
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Số Ván Đã Chơi</span>
                <div className="text-xl font-mono font-bold text-white tabular-nums mt-0.5">
                  {totalHands}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Số Ván Thắng</span>
                <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                  {wonHands}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Tỉ Lệ Thắng</span>
                <div className="text-xl font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                  {winRate}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Pot Lớn Nhất</span>
                <div className="text-xl font-mono font-bold text-cyan-400 tabular-nums mt-0.5">
                  ${(currentUser.biggestPotWon || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Trophies & Highlights */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="text-xs font-bold text-white">Cúp Vô Địch Sit & Go</div>
                <div className="text-[11px] text-slate-400">Số lần đứng đầu bảng giải đấu poker</div>
              </div>
            </div>
            <span className="text-sm font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
              {currentUser.tournamentTrophies || 0} Cúp
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              sounds.playFold();
              onLogout();
              onClose();
            }}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold hover:underline flex items-center gap-1 min-h-[36px]"
          >
            <span>Đăng Xuất / Đổi Người Khác</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors min-h-[36px]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
