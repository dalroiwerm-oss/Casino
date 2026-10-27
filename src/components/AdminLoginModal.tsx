import React, { useState } from 'react';
import { UserProfile, verifyAdminCredentials, saveUser } from '../logic/auth';
import { sounds } from '../logic/audio';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminLoggedIn: (user: UserProfile) => void;
  onSwitchToPlayer: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onAdminLoggedIn,
  onSwitchToPlayer,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminCredentials(username, password)) {
      sounds.playWin();
      const adminProfile: UserProfile = {
        id: 'admin_root',
        name: 'Quản Trị Viên (Admin)',
        chips: 999999,
        avatarColor: '#e11d48',
        isAdmin: true,
        role: 'admin',
        createdAt: new Date().toISOString(),
      };
      saveUser(adminProfile);
      onAdminLoggedIn(adminProfile);
      onClose();
    } else {
      sounds.playFold();
      setError('Tài khoản hoặc mật khẩu quản trị không chính xác');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-6 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 mx-auto mb-3 flex items-center justify-center text-2xl shadow-lg">
            🛡️
          </div>
          <h2 className="text-xl font-bold text-white font-serif">
            Đăng Nhập Quản Trị Viên
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hệ thống quản lý trò chơi, điều chỉnh số dư và cài đặt hệ thống
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Tên Đăng Nhập:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Nhập tên đăng nhập quản trị..."
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-400 focus:outline-none text-white text-sm font-semibold transition-colors placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Mật Khẩu Quản Trị:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Nhập mật khẩu..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-400 focus:outline-none text-white text-sm font-semibold transition-colors placeholder:text-slate-500"
            />
            {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-600/25 active:scale-95 transition-all"
          >
            ĐĂNG NHẬP ADMIN
          </button>
        </form>

        {/* Switch to normal player registration */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onSwitchToPlayer();
            }}
            className="text-xs text-slate-400 hover:text-white font-medium hover:underline flex items-center justify-center gap-1.5 mx-auto min-h-[36px]"
          >
            <span>←</span>
            <span>Bạn là người chơi thông thường? Đăng ký tên tại đây</span>
          </button>
        </div>
      </div>
    </div>
  );
};
