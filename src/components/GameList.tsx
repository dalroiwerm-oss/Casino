import React, { useState, useEffect } from 'react';
import { GameDefinition, loadCurrentGames } from '../games/registry';
import { UserProfile, getStoredUser } from '../logic/auth';
import { sounds } from '../logic/audio';
import { DeviceModeSelector } from './DeviceModeSelector';
import { useDeviceMode } from '../logic/device';

interface GameListProps {
  onSelectGame: (gameId: string) => void;
  onOpenHandRankings: () => void;
  currentUser: UserProfile | null;
  onOpenPlayerRegister: () => void;
  onOpenPlayerProfile: () => void;
  onOpenAdminLogin: () => void;
  onOpenAdminDashboard: () => void;
  onOpenPokerRoom: () => void;
  onOpenTienLenRoom: () => void;
  games?: GameDefinition[];
}

export const GameList: React.FC<GameListProps> = ({
  onSelectGame,
  onOpenHandRankings,
  currentUser,
  onOpenPlayerRegister,
  onOpenPlayerProfile,
  onOpenAdminLogin,
  onOpenAdminDashboard,
  onOpenPokerRoom,
  onOpenTienLenRoom,
  games: propGames,
}) => {
  const { isMobile, isTablet, isDesktop } = useDeviceMode();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [comingSoonGame, setComingSoonGame] = useState<GameDefinition | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const games = propGames || loadCurrentGames();

  const filteredGames = games.filter((game) => {
    if (selectedCategory === 'all') return true;
    return game.category === selectedCategory;
  });

  const handleCardClick = (game: GameDefinition) => {
    sounds.playClick();
    if (game.status === 'available') {
      onSelectGame(game.id);
    } else {
      setComingSoonGame(game);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Background Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none opacity-30 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-amber-500/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[450px] sm:w-[600px] h-[450px] sm:h-[600px] bg-blue-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Top Bar with User / Admin Status */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-1.5 sm:gap-3 px-2 sm:px-10 h-14 sm:h-16 bg-slate-950/90 border-b border-slate-800 backdrop-blur-md w-full max-w-full overflow-hidden">
        {/* Brand Zone */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif font-black text-sm sm:text-lg shadow-sm shrink-0">
            ♠
          </div>
          <span className="text-xs sm:text-lg font-black font-serif tracking-wider text-white whitespace-nowrap truncate">
            <span className="hidden sm:inline">GAME HUB ARENA</span>
            <span className="sm:hidden hidden xs:inline">GAME HUB</span>
            <span className="xs:hidden">HUB</span>
          </span>
        </div>

        {/* Navigation & Device Mode Switcher */}
        <div className="flex items-center gap-1 sm:gap-4 shrink-0">
          <DeviceModeSelector compact={true} />
          
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-400">
            <span className="text-amber-400 font-semibold cursor-default">Danh Sách Trò Chơi</span>
            <button
              onClick={() => {
                sounds.playClick();
                onOpenHandRankings();
              }}
              className="hover:text-white transition-colors whitespace-nowrap min-h-[44px] flex items-center"
            >
              Hạng Bài Poker
            </button>
            {currentUser && !currentUser.isAdmin && (
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenPlayerProfile();
                }}
                className="text-amber-300 hover:text-white transition-colors whitespace-nowrap min-h-[44px] flex items-center"
              >
                Hồ Sơ Của Tôi
              </button>
            )}
            <button
              onClick={() => {
                sounds.playClick();
                setIsAboutOpen(true);
              }}
              className="hover:text-white transition-colors whitespace-nowrap min-h-[44px] flex items-center"
            >
              Giới Thiệu
            </button>
          </nav>
        </div>

        {/* User Profile / Admin Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {currentUser?.isAdmin ? (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenAdminDashboard();
              }}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[38px] rounded-lg bg-rose-950 border border-rose-500/60 hover:bg-rose-900 text-rose-300 text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <span>🛡️</span>
              <span className="hidden xs:inline">Bảng Quản Trị</span>
              <span className="xs:hidden">Admin</span>
            </button>
          ) : currentUser ? (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenPlayerProfile();
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[38px] rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-200 text-xs font-semibold transition-all active:scale-95 whitespace-nowrap shrink min-w-0"
              title="Xem thông tin chi tiết người chơi"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.name.substring(0, 1).toUpperCase()}
              </div>
              <span className="truncate max-w-[45px] xs:max-w-[70px] sm:max-w-[120px] text-[11px] sm:text-xs">{currentUser.name}</span>
              <span className="text-emerald-400 font-mono font-bold text-[10px] sm:text-[11px] hidden md:inline">
                ${currentUser.chips.toLocaleString()}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenPlayerRegister();
              }}
              className="px-2 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[38px] rounded-lg bg-slate-900 border border-amber-500/40 hover:bg-slate-800 text-amber-300 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap"
            >
              + <span className="hidden xs:inline">Đăng Ký</span>
            </button>
          )}

          {!currentUser?.isAdmin && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenAdminLogin();
              }}
              className="p-1 sm:px-2.5 sm:py-1.5 min-h-[32px] sm:min-h-[38px] min-w-[32px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center shrink-0"
              title="Đăng nhập Quản Trị Viên (Admin)"
            >
              <span className="sm:hidden text-xs">🔐</span>
              <span className="hidden sm:inline">🔐 Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-10 py-4 sm:py-10 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-12 flex flex-col">
        {/* Title Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-serif">
                  Danh Sách Trò Chơi
                </h1>
                {currentUser?.isAdmin && (
                  <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 text-[10px] font-bold font-mono">
                    CHẾ ĐỘ ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                Cổng game bài và sòng bạc trực tuyến. Người chơi chỉ cần đăng ký tên là có thể bắt đầu ngay lập tức.
              </p>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto touch-pan-x scrollbar-none self-stretch sm:self-auto">
              {[
                { id: 'all', label: 'Tất Cả' },
                { id: 'cards', label: 'Game Bài' },
                { id: 'casino', label: 'Quay Hũ & Casino' },
                { id: 'lottery', label: 'Lô Tô & Vé Số' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedCategory(tab.id);
                  }}
                  className={`px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${
                    selectedCategory === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Responsive Games Grid (Desktop 4-col, Tablet 2/3-col, Mobile 1/2-col) */}
        <div
          className={`grid ${
            isMobile
              ? 'grid-cols-1 xs:grid-cols-2 gap-3'
              : isTablet
              ? 'grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6'
          }`}
        >
          {filteredGames.map((game) => {
            const isAvailable = game.status === 'available';

            return (
              <div
                key={game.id}
                onClick={() => handleCardClick(game)}
                className={`group relative flex flex-col justify-between border-2 transition-all duration-300 cursor-pointer overflow-hidden shadow-xl ${
                  isMobile
                    ? 'rounded-2xl p-4 min-h-[340px]'
                    : 'rounded-2xl sm:rounded-3xl p-5 sm:p-6 aspect-[4/5] sm:aspect-[9/16] min-h-[400px] sm:min-h-0 sm:max-h-[500px]'
                } ${
                  isAvailable
                    ? 'border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/15 active:scale-[0.98]'
                    : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 opacity-80 hover:opacity-100 active:scale-[0.99]'
                }`}
              >
                {/* Subtle Card Glow */}
                <div
                  className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
                  style={{ backgroundColor: game.accentColor }}
                />

                {/* Top of Card */}
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border uppercase ${
                        isAvailable
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/80'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {game.badge}
                    </span>

                    <span className="text-[11px] sm:text-xs text-slate-400 font-mono">
                      {game.playersCount}
                    </span>
                  </div>

                  {/* Primary Large Title (e.g. "Poker") matching sketch */}
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white group-hover:text-amber-300 transition-colors">
                    {game.title}
                  </h2>
                  <p className="text-[11px] sm:text-xs font-semibold text-amber-400/90 tracking-wide uppercase mt-0.5 font-mono">
                    {game.subtitle}
                  </p>
                </div>

                {/* Middle Centerpiece */}
                <div className="relative z-10 my-auto py-2 sm:py-4 flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center text-3xl sm:text-4xl mb-3 sm:mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg ${
                      isAvailable
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-400 shadow-amber-950/40'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400'
                    }`}
                  >
                    {game.icon}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 px-1">
                    {game.descriptionVi}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5 sm:mt-3">
                    {game.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="relative z-10 pt-2.5 sm:pt-3 border-t border-slate-800/80">
                  {isAvailable && game.id === 'poker' ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playChips();
                          onOpenPokerRoom();
                        }}
                        className="w-full py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wide shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>🏠</span>
                        <span>CHẾ ĐỘ PHÒNG (TẠO / VÀO)</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playChips();
                          onSelectGame('poker');
                        }}
                        className="w-full py-2 min-h-[38px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <span>🤖</span>
                        <span>Chơi Nhanh Với AI →</span>
                      </button>
                    </div>
                  ) : isAvailable && game.id === 'tienlen' ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playChips();
                          onOpenTienLenRoom();
                        }}
                        className="w-full py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs uppercase tracking-wide shadow-md shadow-rose-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>🏠</span>
                        <span>CHẾ ĐỘ PHÒNG (TẠO / VÀO)</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playChips();
                          onSelectGame('tienlen');
                        }}
                        className="w-full py-2 min-h-[38px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <span>🤖</span>
                        <span>Chơi Nhanh Với AI →</span>
                      </button>
                    </div>
                  ) : isAvailable && game.id === 'loto' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        onSelectGame('loto');
                      }}
                      className="w-full py-3 min-h-[46px] rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-500 hover:from-fuchsia-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-wide shadow-lg shadow-fuchsia-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>🏠</span>
                      <span>VÀO PHÒNG LÔ TÔ (CỘNG DỒN)</span>
                    </button>
                  ) : isAvailable ? (
                    <button
                      type="button"
                      className="w-full py-3 min-h-[46px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 group-hover:from-amber-400 group-hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <span>VÀO CHƠI NGAY</span>
                      <span>→</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-full py-2.5 min-h-[44px] rounded-xl bg-slate-800 text-slate-400 group-hover:text-slate-200 text-xs font-semibold tracking-wide border border-slate-700/60 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Cập Nhật Sau</span>
                      <span>🔒</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md grid grid-cols-5 items-center px-1 h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            selectedCategory === 'all' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base leading-none">🏛️</span>
          <span className="text-[9px] font-medium tracking-tight mt-1">Sảnh</span>
        </button>

        <button
          onClick={() => {
            sounds.playChips();
            const pokerGame = games.find((g) => g.id === 'poker');
            if (pokerGame && pokerGame.status !== 'available') {
              setComingSoonGame(pokerGame);
            } else {
              onSelectGame('poker');
            }
          }}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-slate-400 hover:text-amber-400 transition-colors"
        >
          <span className="text-base leading-none">♠</span>
          <span className="text-[9px] font-medium tracking-tight mt-1">Poker</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            const pokerGame = games.find((g) => g.id === 'poker');
            if (pokerGame && pokerGame.status !== 'available') {
              setComingSoonGame(pokerGame);
            } else {
              onOpenPokerRoom();
            }
          }}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-amber-400 hover:text-amber-300 transition-colors font-bold"
        >
          <span className="text-base leading-none">🏠</span>
          <span className="text-[9px] font-bold tracking-tight mt-1">Phòng</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            onOpenHandRankings();
          }}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="text-base leading-none">📖</span>
          <span className="text-[9px] font-medium tracking-tight mt-1">Hạng Bài</span>
        </button>

        {currentUser?.isAdmin ? (
          <button
            onClick={() => {
              sounds.playClick();
              onOpenAdminDashboard();
            }}
            className="flex flex-col items-center justify-center h-full min-h-[44px] text-rose-400 font-bold transition-colors"
          >
            <span className="text-base leading-none">🛡️</span>
            <span className="text-[9px] font-bold tracking-tight mt-1">Admin</span>
          </button>
        ) : (
          <button
            onClick={() => {
              sounds.playClick();
              if (currentUser) {
                onOpenPlayerProfile();
              } else {
                onOpenPlayerRegister();
              }
            }}
            className="flex flex-col items-center justify-center h-full min-h-[44px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="text-base leading-none">👤</span>
            <span className="text-[9px] font-medium tracking-tight mt-1">
              {currentUser ? 'Hồ Sơ' : 'Đăng Ký'}
            </span>
          </button>
        )}
      </nav>

      {/* Desktop Footer */}
      <footer className="hidden sm:flex relative z-10 py-6 px-6 sm:px-10 border-t border-slate-900 bg-slate-950 text-xs text-slate-500 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Texas Hold'em Pro & Multi-Game Hub</span>
          <span>·</span>
          <span>Hệ thống phân quyền Người Chơi & Quản Trị Viên</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>{currentUser ? `Đang đăng nhập: ${currentUser.name}` : 'Chưa đăng ký tên'}</span>
          <span>·</span>
          <span>Web Audio API</span>
        </div>
      </footer>

      {/* Coming Soon Modal */}
      {comingSoonGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm p-6 bg-slate-900 border border-slate-700 rounded-2xl text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-2xl flex items-center justify-center mx-auto mb-3">
              {comingSoonGame.icon}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
              {comingSoonGame.title} - {comingSoonGame.subtitle}
            </h3>
            <p className="text-xs text-amber-400 font-mono uppercase tracking-wider mb-3">
              Trò Chơi Tạm Khóa / Sắp Cập Nhật
            </p>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Tựa game này hiện đang tạm đóng hoặc đang trong quá trình nâng cấp hệ thống. Vui lòng quay lại sau!
            </p>
            <div className="flex items-center justify-center">
              <button
                onClick={() => setComingSoonGame(null)}
                className="w-full px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
              >
                Đã Hiểu (Đóng)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-700 rounded-2xl text-left shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Về Nền Tảng Game Hub</h3>
              <button
                onClick={() => setIsAboutOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Hệ thống được thiết kế hướng tới trải nghiệm người dùng di động và máy tính với hiệu năng cao, âm thanh trực tiếp và cơ chế game mô phỏng chân thực.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 mb-5">
              <li>Người chơi: Chỉ cần nhập tên là có thể chơi ngay và lưu số dư chip</li>
              <li>Quản trị viên (Admin): Đăng nhập để quản lý game, bật/tắt trò chơi và cấp chip</li>
              <li>Bộ luật Texas Hold'em 7 lá đạt tiêu chuẩn quốc tế</li>
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setIsAboutOpen(false)}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
