import React, { useState } from 'react';
import { UserProfile, saveUser } from '../logic/auth';
import { sounds } from '../logic/audio';

interface PlayerRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserSaved: (user: UserProfile) => void;
  onSwitchToAdmin: () => void;
}

const AVATAR_COLORS = [
  '#f59e0b', // Gold / Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

export const PlayerRegisterModal: React.FC<PlayerRegisterModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserSaved,
  onSwitchToAdmin,
}) => {
  const [name, setName] = useState<string>(currentUser?.name || '');
  const [selectedColor, setSelectedColor] = useState<string>(currentUser?.avatarColor || AVATAR_COLORS[0]);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    if (trimmed.length > 20) {
      setError('Tên không được vượt quá 20 ký tự');
      return;
    }

    sounds.playChips();

    const updatedProfile: UserProfile = {
      id: currentUser?.id || 'usr_' + Date.now().toString(36),
      name: trimmed,
      chips: currentUser?.chips || 2500,
      avatarColor: selectedColor,
      isAdmin: currentUser?.isAdmin || false,
      role: currentUser?.role || 'player',
      createdAt: currentUser?.createdAt || new Date().toISOString(),
    };

    saveUser(updatedProfile);
    onUserSaved(updatedProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/60 rounded-2xl p-6 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold shadow-lg border-2 border-white/20 transition-all"
            style={{ backgroundColor: selectedColor }}
          >
            {name.trim() ? name.trim().substring(0, 2).toUpperCase() : '👤'}
          </div>
          <h2 className="text-xl font-bold text-white font-serif">
            {currentUser ? 'Cập Nhật Tên Người Chơi' : 'Đăng Ký Tên Tham Gia'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Chỉ cần nhập tên biệt danh của bạn để bắt đầu chơi và lưu lại số dư chip
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Tên Biệt Danh (Nickname):
            </label>
            <input
              type="text"
              placeholder="VD: Tuấn Poker, Shark_99, VuaBài..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-sm font-semibold transition-colors placeholder:text-slate-500"
            />
            {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
          </div>

          {/* Avatar Color Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Màu Đại Diện:
            </label>
            <div className="flex items-center justify-between gap-1.5">
              {AVATAR_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setSelectedColor(col)}
                  className={`w-8 h-8 rounded-full transition-transform active:scale-90 border-2 ${
                    selectedColor === col ? 'scale-110 border-white ring-2 ring-amber-400' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          {/* Starting Chips Info */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Số chip ban đầu:</span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${(currentUser?.chips || 2500).toLocaleString()} (Miễn phí)
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            {currentUser ? 'LƯU THAY ĐỔI' : 'BẮT ĐẦU CHƠI NGAY'}
          </button>
        </form>

        {/* Switch to Admin Login */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onSwitchToAdmin();
            }}
            className="text-xs text-amber-400/90 hover:text-amber-300 font-semibold hover:underline flex items-center justify-center gap-1.5 mx-auto min-h-[36px]"
          >
            <span>🔐</span>
            <span>Bạn là Quản Trị Viên? Đăng nhập Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
