import React, { useState, useEffect, useCallback } from 'react';
import { GameDefinition, loadCurrentGames, saveCurrentGames, resetDefaultGames } from '../games/registry';
import {
  UserProfile,
  SystemSettings,
  getStoredSystemSettings,
  saveSystemSettings,
  fetchServerPlayers,
  adminGivePlayerChips,
  adminDeletePlayer,
  adminAddTestPlayer,
} from '../logic/auth';
import { sounds } from '../logic/audio';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onLogoutAdmin: () => void;
  onGamesUpdated: (games: GameDefinition[]) => void;
  onUserUpdated: (user: UserProfile) => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogoutAdmin,
  onGamesUpdated,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'games' | 'chips' | 'settings'>('chips');
  const [games, setGames] = useState<GameDefinition[]>(() => loadCurrentGames());
  const [settings, setSettings] = useState<SystemSettings>(() => getStoredSystemSettings());

  // Server players state (multi-device)
  const [serverPlayers, setServerPlayers] = useState<UserProfile[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [customChipModal, setCustomChipModal] = useState<{
    player: UserProfile;
    amount: string;
    mode: 'add' | 'set';
  } | null>(null);

  // Form for adding a new game
  const [newGameTitle, setNewGameTitle] = useState<string>('');
  const [newGameSubtitle, setNewGameSubtitle] = useState<string>('');
  const [newGameCategory, setNewGameCategory] = useState<'cards' | 'casino' | 'lottery'>('cards');
  const [newGameIcon, setNewGameIcon] = useState<string>('🎲');
  const [newGameDesc, setNewGameDesc] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('');

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  // Fetch all player accounts across all devices
  const loadAllPlayers = useCallback(async () => {
    setIsLoadingPlayers(true);
    const res = await fetchServerPlayers();
    if (res.players) {
      setServerPlayers(res.players);
    }
    setIsLoadingPlayers(false);
  }, []);

  // Poll players every 4 seconds when in chips tab
  useEffect(() => {
    if (isOpen && activeTab === 'chips') {
      loadAllPlayers();
      const interval = setInterval(() => {
        loadAllPlayers();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab, loadAllPlayers]);

  if (!isOpen) return null;

  // Toggle game availability status
  const handleToggleStatus = (gameId: string) => {
    sounds.playClick();
    const updated = games.map((g) => {
      if (g.id !== gameId) return g;
      const nextStatus = g.status === 'available' ? 'coming_soon' : 'available';
      const nextBadge = nextStatus === 'available' ? 'ĐANG MỞ' : 'CẬP NHẬT SAU';
      return {
        ...g,
        status: nextStatus as 'available' | 'coming_soon',
        badge: nextBadge,
      };
    });
    setGames(updated);
    saveCurrentGames(updated);
    onGamesUpdated(updated);
    showToast('Đã cập nhật trạng thái trò chơi!');
  };

  // Reset games to default
  const handleResetGames = () => {
    sounds.playClick();
    const defaults = resetDefaultGames();
    setGames(defaults);
    onGamesUpdated(defaults);
    showToast('Đã khôi phục danh sách trò chơi mặc định!');
  };

  // Add new game to registry
  const handleAddNewGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameTitle.trim()) return;

    const newId = `custom_${Date.now()}`;
    const newGame: GameDefinition = {
      id: newId,
      title: newGameTitle.trim(),
      subtitle: newGameSubtitle.trim() || 'Trò Chơi Mới',
      category: newGameCategory,
      categoryLabelVi: newGameCategory === 'cards' ? 'Game Bài' : newGameCategory === 'casino' ? 'Casino' : 'Vé & Cào',
      descriptionVi: newGameDesc.trim() || 'Trò chơi mới được thêm từ bảng điều khiển quản trị.',
      playersCount: 'Nhiều người chơi',
      difficulty: 'Dễ',
      status: 'coming_soon',
      badge: 'CẬP NHẬT SAU',
      icon: newGameIcon || '🎲',
      gradient: 'from-slate-900 via-slate-950 to-slate-950',
      borderHover: 'hover:border-cyan-400',
      accentColor: '#06b6d4',
      tags: ['Mới Thêm', 'Quản Trị'],
    };

    const updated = [...games, newGame];
    setGames(updated);
    saveCurrentGames(updated);
    onGamesUpdated(updated);

    // Reset form
    setNewGameTitle('');
    setNewGameSubtitle('');
    setNewGameDesc('');
    setShowAddForm(false);
    sounds.playWin();
    showToast(`Đã thêm trò chơi "${newGame.title}" vào danh sách!`);
  };

  // Give chips to current admin user
  const handleGiveAdminChips = (amount: number) => {
    sounds.playChips();
    const updated: UserProfile = {
      ...currentUser,
      chips: currentUser.chips + amount,
    };
    onUserUpdated(updated);
    showToast(`Đã cộng +$${amount.toLocaleString()} chip cho Admin!`);
  };

  // Give chips to a specific player on any device
  const handleGivePlayerChips = async (player: UserProfile, amount: number, mode: 'add' | 'set' = 'add') => {
    sounds.playChips();
    const res = await adminGivePlayerChips(player.id, amount, mode);
    if (res.success && res.player) {
      showToast(res.message || `Đã cấp $${amount.toLocaleString()} chip cho [${player.name}]!`);
      // Update local serverPlayers state immediately
      setServerPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, chips: res.player!.chips } : p))
      );
      // If admin modified their own account
      if (player.id === currentUser.id) {
        onUserUpdated(res.player);
      }
    } else {
      sounds.playFold();
      showToast(res.message || 'Lỗi cấp chip cho người chơi');
    }
  };

  // Custom chip submit
  const handleCustomChipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customChipModal) return;
    const num = Number(customChipModal.amount);
    if (isNaN(num) || num < 0) {
      showToast('Vui lòng nhập số chip hợp lệ');
      return;
    }
    await handleGivePlayerChips(customChipModal.player, num, customChipModal.mode);
    setCustomChipModal(null);
  };

  // Delete a player account
  const handleDeletePlayer = async (player: UserProfile) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản [${player.name}] khỏi hệ thống không?`)) {
      return;
    }
    sounds.playFold();
    const success = await adminDeletePlayer(player.id);
    if (success) {
      setServerPlayers((prev) => prev.filter((p) => p.id !== player.id));
      showToast(`Đã xóa tài khoản [${player.name}] thành công!`);
    } else {
      showToast('Không thể xóa tài khoản này');
    }
  };

  // Add a test demo device/player
  const handleAddTestDevice = async () => {
    sounds.playChips();
    const newTest = await adminAddTestPlayer();
    if (newTest) {
      setServerPlayers((prev) => [newTest, ...prev]);
      showToast(`Đã thêm thiết bị test [${newTest.name}] vào danh sách!`);
    }
  };

  // Save system settings
  const handleUpdateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    saveSystemSettings(newSettings);
    showToast('Đã lưu cấu hình hệ thống!');
  };

  // Filtered players list
  const filteredPlayers = serverPlayers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (onlineFilter === 'online') return p.isOnline;
    if (onlineFilter === 'offline') return !p.isOnline;
    return true;
  });

  const onlineCount = serverPlayers.filter((p) => p.isOnline).length;
  const totalChipsAcrossDevices = serverPlayers.reduce((sum, p) => sum + (p.chips || 0), 0);

  const getDeviceIcon = (dev?: string) => {
    switch (dev) {
      case 'mobile':
        return { icon: '📱', label: 'Điện thoại' };
      case 'tablet':
        return { icon: '💻', label: 'Máy tính bảng' };
      default:
        return { icon: '🖥️', label: 'Máy tính PC' };
    }
  };

  const formatLastActive = (ts?: number) => {
    if (!ts) return 'Không rõ';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Vừa mới đây';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return new Date(ts).toLocaleDateString('vi-VN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[92dvh] bg-slate-900 border-2 border-rose-500/70 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-500/60 text-rose-400 flex items-center justify-center text-base font-bold shadow-sm">
              🛡️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-serif">
                  Bảng Điều Khiển Quản Trị (Admin)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-mono font-bold">
                  SUPERUSER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Quản lý toàn bộ tài khoản trên các thiết bị, cấp phát chip và cấu hình hệ thống
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('chips')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap min-h-[38px] flex items-center gap-1.5 ${
              activeTab === 'chips'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>💰</span>
            <span>Cấp Chip & Quản Lý Tài Khoản</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {serverPlayers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap min-h-[38px] flex items-center gap-1.5 ${
              activeTab === 'games'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🎮</span>
            <span>Quản Lý Trò Chơi ({games.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap min-h-[38px] flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>⚙️</span>
            <span>Cấu Hình Hệ Thống</span>
          </button>
        </div>

        {/* Toast Notification */}
        {notification && (
          <div className="px-5 py-2.5 bg-emerald-950 border-b border-emerald-700 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top">
            <span>✓</span>
            <span>{notification}</span>
          </div>
        )}

        {/* TAB 1: CẤP CHIP & QUẢN LÝ TÀI KHOẢN TRÊN CÁC THIẾT BỊ (THE CORE FIX) */}
        {activeTab === 'chips' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* System Overview Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Tổng Thiết Bị / Tài Khoản</span>
                  <span className="text-base">👥</span>
                </div>
                <div className="text-2xl font-black font-mono text-white tabular-nums">
                  {serverPlayers.length} <span className="text-xs font-normal text-slate-400">tài khoản</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Đồng bộ tập trung từ server
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 shadow-md">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Đang Trực Tuyến</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                  {onlineCount} <span className="text-xs font-normal text-slate-400">thiết bị online</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Vừa hoạt động trong 3 phút qua
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/30 shadow-md">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Tổng Chip Toàn Hệ Thống</span>
                  <span className="text-base">💎</span>
                </div>
                <div className="text-2xl font-black font-mono text-amber-300 tabular-nums truncate">
                  ${totalChipsAcrossDevices.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Lưu hành trên tất cả máy
                </div>
              </div>
            </div>

            {/* Current Admin Quick Self-Top-Up Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 uppercase tracking-wider font-bold">
                    TÀI KHOẢN ADMIN HIỆN TẠI:
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-600/60 font-bold">
                    BẠN
                  </span>
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  {currentUser.name}
                </div>
                <div className="text-xs text-emerald-400 font-mono font-bold mt-0.5">
                  Số dư ví: ${currentUser.chips.toLocaleString()} CHIP
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 mr-1">Nạp cho Admin:</span>
                <button
                  onClick={() => handleGiveAdminChips(10000)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950 border border-slate-700 hover:border-emerald-600 text-slate-200 hover:text-emerald-300 text-xs font-bold transition-all"
                >
                  + $10k
                </button>
                <button
                  onClick={() => handleGiveAdminChips(50000)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950 border border-slate-700 hover:border-emerald-600 text-slate-200 hover:text-emerald-300 text-xs font-bold transition-all"
                >
                  + $50k
                </button>
                <button
                  onClick={() => handleGiveAdminChips(500000)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md active:scale-95"
                >
                  + $500k VIP
                </button>
              </div>
            </div>

            {/* Cross-Device Accounts Header & Filter Tools */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>DANH SÁCH TÀI KHOẢN TRÊN CÁC THIẾT BỊ KHÁC</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300">
                      {filteredPlayers.length} máy
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tất cả người chơi đăng ký từ điện thoại, tablet hay máy tính khác đều xuất hiện tại đây
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      loadAllPlayers();
                      showToast('Đã làm mới danh sách tài khoản!');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                    title="Làm mới danh sách từ máy chủ"
                  >
                    <span>🔄</span>
                    <span>Làm Mới</span>
                    {isLoadingPlayers && <span className="animate-spin text-[10px]">⏳</span>}
                  </button>

                  <button
                    onClick={handleAddTestDevice}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                    title="Tạo giả lập 1 tài khoản từ điện thoại khác để thử nghiệm cấp chip"
                  >
                    <span>+</span>
                    <span>Thêm Máy Test</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-2 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="relative w-full sm:w-72">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc ID..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 self-stretch sm:self-auto overflow-x-auto">
                  {[
                    { id: 'all', label: 'Tất Cả' },
                    { id: 'online', label: '🟢 Đang Online' },
                    { id: 'offline', label: '⚪ Ngoại Tuyến' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setOnlineFilter(filter.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        onlineFilter === filter.id
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players Cards Grid / List */}
              {filteredPlayers.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-slate-400">
                  <div className="text-3xl mb-2">📱</div>
                  <div className="text-sm font-bold text-white mb-1">Chưa có tài khoản nào khác</div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Khi bạn bè hoặc bạn mở link web trên điện thoại / máy tính khác và nhập tên, tài khoản của họ sẽ tự động hiển thị trực tiếp tại đây!
                  </p>
                  <button
                    onClick={handleAddTestDevice}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md"
                  >
                    + Tạo Thử 1 Tài Khoản Điện Thoại Test Ngay
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPlayers.map((player) => {
                    const dev = getDeviceIcon(player.deviceType);
                    const isSelf = player.id === currentUser.id;

                    return (
                      <div
                        key={player.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md ${
                          player.isOnline
                            ? 'bg-slate-950/90 border-slate-700/80 hover:border-emerald-500/50'
                            : 'bg-slate-950/60 border-slate-800/80 opacity-90'
                        }`}
                      >
                        {/* Player Info Left Section */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar Circle with Online Dot */}
                          <div className="relative shrink-0">
                            <div
                              className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-md border border-white/20"
                              style={{ backgroundColor: player.avatarColor || '#f59e0b' }}
                            >
                              {player.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                                player.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                              }`}
                              title={player.isOnline ? 'Đang online' : 'Ngoại tuyến'}
                            />
                          </div>

                          {/* Identity Details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white truncate max-w-[160px] sm:max-w-[220px]">
                                {player.name}
                              </span>

                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700 font-bold">
                                  ADMIN BẠN
                                </span>
                              )}

                              {player.isOnline ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>ONLINE</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                  {formatLastActive(player.lastActive)}
                                </span>
                              )}

                              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1 font-mono">
                                <span>{dev.icon}</span>
                                <span>{dev.label}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap font-mono">
                              <span className="text-slate-500 truncate max-w-[140px]">
                                ID: {player.id}
                              </span>
                              <span>·</span>
                              <span>Đã chơi: {player.handsPlayed || 0} ván</span>
                              <span>·</span>
                              <span className="text-emerald-400">Thắng: {player.handsWon || 0}</span>
                            </div>
                          </div>
                        </div>

                        {/* Chips Balance & Action Buttons Right Section */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                          {/* Current Balance Display */}
                          <div className="text-left lg:text-right mr-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Số dư hiện tại:
                            </div>
                            <div className="text-base sm:text-lg font-mono font-black text-amber-300 tabular-nums drop-shadow">
                              ${(player.chips || 0).toLocaleString()} <span className="text-[10px] text-slate-400">CHIP</span>
                            </div>
                          </div>

                          {/* Give Chips Button Clusters */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleGivePlayerChips(player, 10000)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950 border border-slate-700 hover:border-emerald-600 text-emerald-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
                              title={`Cấp thêm +10,000 chip cho ${player.name}`}
                            >
                              +10k
                            </button>
                            <button
                              onClick={() => handleGivePlayerChips(player, 50000)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950 border border-slate-700 hover:border-emerald-600 text-emerald-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
                              title={`Cấp thêm +50,000 chip cho ${player.name}`}
                            >
                              +50k
                            </button>
                            <button
                              onClick={() => handleGivePlayerChips(player, 500000)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all active:scale-95 shadow-sm"
                              title={`Cấp thêm +500,000 chip cho ${player.name}`}
                            >
                              +500k
                            </button>

                            {/* Custom Chip Button */}
                            <button
                              onClick={() =>
                                setCustomChipModal({
                                  player,
                                  amount: '100000',
                                  mode: 'add',
                                })
                              }
                              className="p-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all"
                              title="Tùy chỉnh số chip cấp phát"
                            >
                              ✏️ Số khác
                            </button>

                            {/* Delete Account Button */}
                            {!isSelf && (
                              <button
                                onClick={() => handleDeletePlayer(player)}
                                className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-700 text-slate-500 hover:text-rose-400 text-xs transition-colors"
                                title="Xóa tài khoản này"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Default Starting Balance Config */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Cấu Hình Số Dư Người Chơi Mới Đăng Ký (Vốn Khởi Nghiệp):
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[1000, 2500, 10000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleUpdateSettings({ ...settings, defaultStartingChips: amount })}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      settings.defaultStartingChips === amount
                        ? 'bg-amber-500/10 border-amber-400 text-amber-300 ring-2 ring-amber-400 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs text-slate-400">Vốn khởi nghiệp mặc định:</div>
                    <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                      ${amount.toLocaleString()} CHIP
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUẢN LÝ TRÒ CHƠI */}
        {activeTab === 'games' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 font-medium">
                Bật/tắt trạng thái hiển thị của các trò chơi trong sảnh chính:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors whitespace-nowrap"
                >
                  {showAddForm ? 'Hủy Thêm' : '+ Thêm Trò Chơi Mới'}
                </button>
                <button
                  onClick={handleResetGames}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Mặc Định
                </button>
              </div>
            </div>

            {/* Add New Game Form Drawer */}
            {showAddForm && (
              <form onSubmit={handleAddNewGame} className="p-4 rounded-xl bg-slate-950 border border-amber-500/50 space-y-3">
                <div className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                  Thêm Tựa Game Mới Vào Sảnh:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Tên Trò Chơi:</label>
                    <input
                      type="text"
                      placeholder="VD: Xóc Đĩa, Bầu Cua, Liêng..."
                      value={newGameTitle}
                      onChange={(e) => setNewGameTitle(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Mô Tả Phụ (Subtitle):</label>
                    <input
                      type="text"
                      placeholder="VD: Dân Gian Truyền Thống"
                      value={newGameSubtitle}
                      onChange={(e) => setNewGameSubtitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Danh Mục:</label>
                    <select
                      value={newGameCategory}
                      onChange={(e) => setNewGameCategory(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="cards">Game Bài</option>
                      <option value="casino">Casino & Quay Hũ</option>
                      <option value="lottery">Vé & Cào</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Biểu Tượng (Icon Emoji):</label>
                    <input
                      type="text"
                      value={newGameIcon}
                      onChange={(e) => setNewGameIcon(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Mô Tả Chi Tiết:</label>
                  <textarea
                    rows={2}
                    placeholder="Mô tả luật chơi..."
                    value={newGameDesc}
                    onChange={(e) => setNewGameDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Xác Nhận Thêm Game
                </button>
              </form>
            )}

            {/* Games List Table */}
            <div className="space-y-2">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                      {game.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{game.title}</span>
                        <span className="text-xs text-slate-400 font-mono">({game.subtitle})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{game.categoryLabelVi}</span>
                        <span>·</span>
                        <span>{game.playersCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                        game.status === 'available'
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                          : 'bg-amber-950/80 text-amber-300 border-amber-700'
                      }`}
                    >
                      {game.badge || (game.status === 'available' ? 'ĐANG MỞ' : 'CẬP NHẬT SAU')}
                    </span>

                    <button
                      onClick={() => handleToggleStatus(game.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                        game.status === 'available'
                          ? 'bg-slate-800 hover:bg-amber-950 hover:text-amber-300 text-slate-300 border border-slate-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                      }`}
                    >
                      {game.status === 'available' ? 'Tắt Mở' : 'Kích Hoạt'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CẤU HÌNH HỆ THỐNG */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Cho phép nạp lại chip khi hết (Rebuy)</div>
                  <div className="text-xs text-slate-400">Người chơi hết chip trong bàn Cash có thể nạp lại tức thì</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowGuestRebuy}
                  onChange={(e) => handleUpdateSettings({ ...settings, allowGuestRebuy: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div>
                  <div className="text-sm font-bold text-white">Chế độ bảo trì hệ thống</div>
                  <div className="text-xs text-slate-400">Tạm thời thông báo bảo trì cho người chơi thông thường</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => handleUpdateSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-rose-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              sounds.playFold();
              onLogoutAdmin();
              onClose();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>Đăng Xuất Admin</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            Đóng Bảng Quản Trị
          </button>
        </div>
      </div>

      {/* Custom Chip Modal Dialog */}
      {customChipModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm p-6 bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-amber-400">
                Cấp Chip Cho [{customChipModal.player.name}]
              </h3>
              <button
                onClick={() => setCustomChipModal(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCustomChipSubmit} className="space-y-4">
              <div className="text-xs text-slate-400">
                Số dư hiện tại:{' '}
                <strong className="text-emerald-400 font-mono">
                  ${(customChipModal.player.chips || 0).toLocaleString()}
                </strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hình thức điều chỉnh:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomChipModal((prev) => (prev ? { ...prev, mode: 'add' } : null))
                    }
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      customChipModal.mode === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    + Cộng Thêm
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomChipModal((prev) => (prev ? { ...prev, mode: 'set' } : null))
                    }
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      customChipModal.mode === 'set'
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    = Đặt Số Dư
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số lượng chip:
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={customChipModal.amount}
                  onChange={(e) =>
                    setCustomChipModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : null
                    )
                  }
                  autoFocus
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-base font-bold text-amber-300 focus:outline-none focus:border-amber-400 text-center"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[50000, 100000, 1000000].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() =>
                      setCustomChipModal((prev) =>
                        prev ? { ...prev, amount: String(quick) } : null
                      )
                    }
                    className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono"
                  >
                    ${(quick / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomChipModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  Xác Nhận Cấp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
