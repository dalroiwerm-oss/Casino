/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameMode, TableTheme } from './types/poker';
import { GameList } from './components/GameList';
import { TitleScreen } from './components/TitleScreen';
import { PokerGame } from './components/PokerGame';
import { HandRankingModal } from './components/HandRankingModal';
import { PlayerRegisterModal } from './components/PlayerRegisterModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { PokerRoomModal } from './components/PokerRoomModal';
import { UserProfile, getStoredUser, clearUser, saveUser, syncUserWithServer, pingPlayerHeartbeat } from './logic/auth';
import { sounds } from './logic/audio';
import { PokerRoom } from './logic/room';
import { GameDefinition, loadCurrentGames } from './games/registry';
import { SlotsGame } from './games/slots/SlotsGame';
import { ScratchCardGame } from './games/scratch/ScratchCardGame';
import { BlackjackGame } from './games/blackjack/BlackjackGame';
import { TienLenGame } from './games/tienlen/TienLenGame';
import { RouletteGame } from './games/roulette/RouletteGame';
import { LotoGame } from './games/loto/LotoGame';
import { TienLenRoomModal, TienLenRoom } from './components/TienLenRoomModal';
import { DeviceProvider, useDeviceMode } from './logic/device';
import { DeviceModeSelector } from './components/DeviceModeSelector';

type AppScreen =
  | 'GAME_LIST'
  | 'POKER_TITLE'
  | 'POKER_PLAYING'
  | 'SLOTS_PLAYING'
  | 'SCRATCH_PLAYING'
  | 'BLACKJACK_PLAYING'
  | 'TIENLEN_PLAYING'
  | 'ROULETTE_PLAYING'
  | 'LOTO_PLAYING';

function MainApp() {
  const { deviceMode, setDeviceMode, actualScreen, isMobile, isTablet, isDesktop } = useDeviceMode();

  // Screen Router
  const [screen, setScreen] = useState<AppScreen>('GAME_LIST');
  const [mode, setMode] = useState<GameMode>('CASH');
  const [theme, setTheme] = useState<TableTheme>('EMERALD');
  const [stakeTier, setStakeTier] = useState<number>(1); // Standard tier

  // User & Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());

  // Modals
  const [isHandRankingsOpen, setIsHandRankingsOpen] = useState<boolean>(false);
  const [isPlayerRegisterOpen, setIsPlayerRegisterOpen] = useState<boolean>(false);
  const [isPlayerProfileOpen, setIsPlayerProfileOpen] = useState<boolean>(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState<boolean>(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState<boolean>(false);
  const [isPokerRoomOpen, setIsPokerRoomOpen] = useState<boolean>(false);
  const [isTienLenRoomOpen, setIsTienLenRoomOpen] = useState<boolean>(false);

  // Active Poker Room Configuration
  const [activeRoomConfig, setActiveRoomConfig] = useState<{
    roomId: string;
    roomCode: string;
    roomName: string;
    isHost: boolean;
    turnTimeSeconds?: number;
    players: import('./logic/room').RoomPlayer[];
  } | null>(null);

  // Active Tien Len Room Configuration
  const [activeTienLenRoomConfig, setActiveTienLenRoomConfig] = useState<TienLenRoom | null>(null);

  // Active Poker settings
  const [games, setGames] = useState<GameDefinition[]>(() => loadCurrentGames());
  const [gameConfig, setGameConfig] = useState({
    mode: 'CASH' as GameMode,
    theme: 'EMERALD' as TableTheme,
    smallBlind: 25,
    bigBlind: 50,
    initialChips: 2500,
  });

  const [adminGiftToast, setAdminGiftToast] = useState<{ message: string; amount: number } | null>(null);

  // Keep user state in sync with localStorage and Central Server
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
      syncUserWithServer(stored).then((synced) => {
        if (synced) setCurrentUser(synced);
      });
    }
  }, []);

  // Real-time Heartbeat: Keep device online and listen for chip gifts from Admin!
  useEffect(() => {
    if (!currentUser || currentUser.isAdmin) return;
    const interval = setInterval(async () => {
      const res = await pingPlayerHeartbeat(currentUser.id, currentUser.chips);
      if (res && res.updated && res.serverChips !== currentUser.chips) {
        const diff = res.serverChips - currentUser.chips;
        const updated: UserProfile = { ...currentUser, chips: res.serverChips };
        setCurrentUser(updated);
        saveUser(updated);
        if (diff > 0) {
          sounds.playWin();
          setAdminGiftToast({
            message: `Quản trị viên vừa cấp thêm +$${diff.toLocaleString()} chip vào tài khoản của bạn!`,
            amount: diff,
          });
          setTimeout(() => setAdminGiftToast(null), 5000);
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleSelectGame = (gameId: string) => {
    const targetGame = games.find((g) => g.id === gameId);
    if (targetGame && targetGame.status !== 'available') {
      return;
    }
    if (!currentUser) {
      setIsPlayerRegisterOpen(true);
    }

    if (gameId === 'poker') {
      setScreen('POKER_TITLE');
    } else if (gameId === 'quayhu') {
      setScreen('SLOTS_PLAYING');
    } else if (gameId === 'caoveso') {
      setScreen('SCRATCH_PLAYING');
    } else if (gameId === 'blackjack') {
      setScreen('BLACKJACK_PLAYING');
    } else if (gameId === 'tienlen') {
      setScreen('TIENLEN_PLAYING');
    } else if (gameId === 'roulette') {
      setScreen('ROULETTE_PLAYING');
    } else if (gameId === 'loto') {
      setScreen('LOTO_PLAYING');
    }
  };

  const handleStartGame = (config: {
    mode: GameMode;
    theme: TableTheme;
    smallBlind: number;
    bigBlind: number;
    initialChips: number;
  }) => {
    setActiveRoomConfig(null);
    setGameConfig(config);
    setScreen('POKER_PLAYING');
  };

  const handleOpenPokerRoom = () => {
    const pokerGame = games.find((g) => g.id === 'poker');
    if (pokerGame && pokerGame.status !== 'available') {
      return;
    }
    if (!currentUser) {
      setIsPlayerRegisterOpen(true);
    }
    setIsPokerRoomOpen(true);
  };

  const handleEnterGameWithRoom = (room: PokerRoom) => {
    setIsPokerRoomOpen(false);
    setActiveRoomConfig({
      roomId: room.id,
      roomCode: room.code,
      roomName: room.name,
      isHost: room.hostId === (currentUser?.id || ''),
      turnTimeSeconds: room.turnTimeSeconds || 15,
      players: room.players,
    });
    setGameConfig({
      mode: 'ROOM',
      theme,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
      initialChips: room.buyIn,
    });
    setScreen('POKER_PLAYING');
  };

  const handleExitToPokerTitle = () => {
    setActiveRoomConfig(null);
    setScreen('POKER_TITLE');
  };

  const handleBackToGameList = () => {
    setActiveRoomConfig(null);
    setActiveTienLenRoomConfig(null);
    setScreen('GAME_LIST');
  };

  const handleOpenTienLenRoom = () => {
    if (!currentUser) {
      setIsPlayerRegisterOpen(true);
    }
    setIsTienLenRoomOpen(true);
  };

  const handleEnterTienLenGameWithRoom = (room: TienLenRoom) => {
    setIsTienLenRoomOpen(false);
    setActiveTienLenRoomConfig(room);
    setScreen('TIENLEN_PLAYING');
  };

  // Auth Handlers
  const handleUserSaved = (user: UserProfile) => {
    setCurrentUser(user);
    saveUser(user);
    syncUserWithServer(user);
  };

  const handleAdminLoggedIn = (adminUser: UserProfile) => {
    setCurrentUser(adminUser);
    saveUser(adminUser);
    syncUserWithServer(adminUser);
    setIsAdminDashboardOpen(true);
  };

  const handleLogoutAdmin = () => {
    clearUser();
    setCurrentUser(null);
  };

  const handlePokerStatsUpdate = (
    newChips: number,
    isWin: boolean,
    potSize: number,
    isTournamentWin?: boolean
  ) => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      chips: newChips,
      handsPlayed: (currentUser.handsPlayed || 0) + 1,
      handsWon: (currentUser.handsWon || 0) + (isWin ? 1 : 0),
      biggestPotWon: Math.max(currentUser.biggestPotWon || 0, potSize),
      tournamentTrophies: (currentUser.tournamentTrophies || 0) + (isTournamentWin ? 1 : 0),
    };
    setCurrentUser(updated);
    saveUser(updated);
    syncUserWithServer(updated);
  };

  const handleGeneralChipsUpdate = (newChips: number, delta: number) => {
    if (!currentUser) return;
    const isWin = delta > 0;
    const updated: UserProfile = {
      ...currentUser,
      chips: newChips,
      handsPlayed: (currentUser.handsPlayed || 0) + 1,
      handsWon: (currentUser.handsWon || 0) + (isWin ? 1 : 0),
      biggestPotWon: Math.max(currentUser.biggestPotWon || 0, isWin ? delta : 0),
    };
    setCurrentUser(updated);
    saveUser(updated);
    syncUserWithServer(updated);
  };

  // Device simulation wrapper class for desktop browsers previewing mobile/tablet
  const isSimulatedMobile = deviceMode === 'mobile' && actualScreen !== 'mobile';
  const isSimulatedTablet = deviceMode === 'tablet' && actualScreen === 'desktop';

  const containerFrameClass = isSimulatedMobile
    ? 'max-w-full sm:max-w-[420px] mx-auto min-h-[100dvh] my-0 sm:my-3 rounded-none sm:rounded-[40px] border-0 sm:border-4 border-slate-700 shadow-2xl overflow-hidden ring-0 sm:ring-4 ring-black w-full'
    : isSimulatedTablet
    ? 'max-w-full sm:max-w-[840px] mx-auto min-h-[100dvh] my-0 sm:my-3 rounded-none sm:rounded-[32px] border-0 sm:border-4 border-slate-700 shadow-2xl overflow-hidden ring-0 sm:ring-4 ring-black w-full'
    : 'w-full max-w-full min-h-[100dvh] overflow-x-hidden';

  return (
    <div className="w-full max-w-full min-h-[100dvh] bg-[#020617] font-sans text-slate-100 flex flex-col justify-start overflow-x-hidden">
      {/* Real-time Admin Chip Gift Toast */}
      {adminGiftToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-60 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-[0_10px_35px_rgba(251,191,36,0.6)] border-2 border-yellow-200 animate-bounce flex items-center gap-2.5 max-w-[90vw]">
          <span className="text-xl">🎁</span>
          <span>{adminGiftToast.message}</span>
        </div>
      )}

      {/* Simulation Mode Bar (Shown only when user manually previewing Mobile or Tablet on large display) */}
      {(isSimulatedMobile || isSimulatedTablet) && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-2">
            <span>{isSimulatedMobile ? '📲' : '📱'}</span>
            <span className="font-semibold">
              Đang xem trước chế độ{' '}
              <strong>{isSimulatedMobile ? 'Điện Thoại (Màn Dọc)' : 'Máy Tính Bảng (Tablet)'}</strong>
            </span>
          </div>
          <button
            onClick={() => setDeviceMode('auto')}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] transition-colors"
          >
            Quay Về Tự Động ⚡
          </button>
        </div>
      )}

      {/* Main Container Frame */}
      <div className={`${containerFrameClass} flex flex-col bg-slate-950 transition-all duration-300`}>
        {screen === 'GAME_LIST' && (
          <GameList
            onSelectGame={handleSelectGame}
            onOpenHandRankings={() => setIsHandRankingsOpen(true)}
            currentUser={currentUser}
            onOpenPlayerRegister={() => setIsPlayerRegisterOpen(true)}
            onOpenPlayerProfile={() => setIsPlayerProfileOpen(true)}
            onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
            onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
            onOpenPokerRoom={handleOpenPokerRoom}
            onOpenTienLenRoom={handleOpenTienLenRoom}
            games={games}
          />
        )}

        {screen === 'POKER_TITLE' && (
          <TitleScreen
            onStartGame={handleStartGame}
            selectedMode={mode}
            setSelectedMode={setMode}
            selectedTheme={theme}
            setSelectedTheme={setTheme}
            stakeTier={stakeTier}
            setStakeTier={setStakeTier}
            onOpenHandRankings={() => setIsHandRankingsOpen(true)}
            onOpenRoomMode={handleOpenPokerRoom}
            onBackToGameList={handleBackToGameList}
          />
        )}

        {screen === 'POKER_PLAYING' && (
          <PokerGame
            mode={gameConfig.mode}
            theme={gameConfig.theme}
            initialSmallBlind={gameConfig.smallBlind}
            initialBigBlind={gameConfig.bigBlind}
            initialBuyIn={currentUser ? Math.max(gameConfig.initialChips, currentUser.chips) : gameConfig.initialChips}
            onExitToTitle={handleBackToGameList}
            heroName={currentUser?.name}
            heroAvatarColor={currentUser?.avatarColor}
            roomConfig={activeRoomConfig || undefined}
            onStatsUpdate={handlePokerStatsUpdate}
          />
        )}

        {screen === 'SLOTS_PLAYING' && (
          <SlotsGame
            currentUser={currentUser}
            onUpdateChips={handleGeneralChipsUpdate}
            onExit={handleBackToGameList}
            onRequireRegister={() => setIsPlayerRegisterOpen(true)}
          />
        )}

        {screen === 'SCRATCH_PLAYING' && (
          <ScratchCardGame
            currentUser={currentUser}
            onUpdateChips={handleGeneralChipsUpdate}
            onExit={handleBackToGameList}
            onRequireRegister={() => setIsPlayerRegisterOpen(true)}
          />
        )}

        {screen === 'BLACKJACK_PLAYING' && (
          <BlackjackGame
            currentUser={currentUser}
            onUpdateChips={handleGeneralChipsUpdate}
            onExit={handleBackToGameList}
            onRequireRegister={() => setIsPlayerRegisterOpen(true)}
          />
        )}

        {screen === 'TIENLEN_PLAYING' && (
          <TienLenGame
            currentUser={currentUser}
            onUpdateChips={handleGeneralChipsUpdate}
            onExit={handleBackToGameList}
            onRequireRegister={() => setIsPlayerRegisterOpen(true)}
            roomConfig={activeTienLenRoomConfig}
          />
        )}

        {screen === 'ROULETTE_PLAYING' && (
          <RouletteGame
            currentUser={currentUser}
            onUpdateChips={handleGeneralChipsUpdate}
            onExit={handleBackToGameList}
            onRequireRegister={() => setIsPlayerRegisterOpen(true)}
          />
        )}

        {screen === 'LOTO_PLAYING' && (
          <LotoGame
            currentUser={currentUser}
            onUpdateChips={handleGeneralChipsUpdate}
            onExit={handleBackToGameList}
            onRequireRegister={() => setIsPlayerRegisterOpen(true)}
          />
        )}
      </div>

      {/* Poker Room Mode Modal: Tạo Phòng & Tham Gia Phòng */}
      <PokerRoomModal
        isOpen={isPokerRoomOpen}
        onClose={() => setIsPokerRoomOpen(false)}
        currentUser={currentUser}
        onEnterGameWithRoom={handleEnterGameWithRoom}
        onRequireRegisterName={() => setIsPlayerRegisterOpen(true)}
      />

      {/* Tien Len Room Mode Modal: Tạo Bàn & Tham Gia Bàn */}
      <TienLenRoomModal
        isOpen={isTienLenRoomOpen}
        onClose={() => setIsTienLenRoomOpen(false)}
        currentUser={currentUser}
        onEnterGameWithRoom={handleEnterTienLenGameWithRoom}
        onRequireRegisterName={() => setIsPlayerRegisterOpen(true)}
      />

      {/* Global Hand Ranking Modal */}
      <HandRankingModal
        isOpen={isHandRankingsOpen}
        onClose={() => setIsHandRankingsOpen(false)}
      />

      {/* Player Registration Modal */}
      <PlayerRegisterModal
        isOpen={isPlayerRegisterOpen}
        onClose={() => setIsPlayerRegisterOpen(false)}
        currentUser={currentUser}
        onUserSaved={handleUserSaved}
        onSwitchToAdmin={() => {
          setIsPlayerRegisterOpen(false);
          setIsAdminLoginOpen(true);
        }}
      />

      {/* Dedicated Player Profile Modal */}
      {currentUser && (
        <PlayerProfileModal
          isOpen={isPlayerProfileOpen}
          onClose={() => setIsPlayerProfileOpen(false)}
          currentUser={currentUser}
          onUserUpdated={handleUserSaved}
          onOpenEditName={() => {
            setIsPlayerProfileOpen(false);
            setIsPlayerRegisterOpen(true);
          }}
          onLogout={() => {
            clearUser();
            setCurrentUser(null);
            setIsPlayerProfileOpen(false);
          }}
        />
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onAdminLoggedIn={handleAdminLoggedIn}
        onSwitchToPlayer={() => {
          setIsAdminLoginOpen(false);
          setIsPlayerRegisterOpen(true);
        }}
      />

      {/* Admin Dashboard Modal */}
      {currentUser?.isAdmin && (
        <AdminDashboardModal
          isOpen={isAdminDashboardOpen}
          onClose={() => setIsAdminDashboardOpen(false)}
          currentUser={currentUser}
          onLogoutAdmin={handleLogoutAdmin}
          onGamesUpdated={(updatedGames) => {
            setGames(updatedGames);
          }}
          onUserUpdated={handleUserSaved}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <MainApp />
    </DeviceProvider>
  );
}
