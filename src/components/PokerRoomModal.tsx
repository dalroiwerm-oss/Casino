import React, { useState, useEffect, useRef } from 'react';
import {
  PokerRoom,
  createNewRoom,
  joinRoom,
  leaveRoom,
  addBotToRoom,
  removeBotFromRoom,
  togglePlayerReady,
  sendRoomMessage,
  startRoomGame,
  getStoredRooms,
  findRoomByCode,
  subscribeToRoomUpdates,
  saveRooms,
} from '../logic/room';
import { UserProfile } from '../logic/auth';
import { sounds } from '../logic/audio';
import { networkManager, NetworkPacket, NetworkStatus } from '../logic/network';
import { onlineHub } from '../logic/onlineHub';

interface PokerRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onEnterGameWithRoom: (room: PokerRoom) => void;
  onRequireRegisterName: () => void;
}

const BLIND_PRESETS = [
  { label: 'Tập Sự', sb: 10, bb: 20, buyIn: 1000 },
  { label: 'Tiêu Chuẩn', sb: 25, bb: 50, buyIn: 2500 },
  { label: 'Cao Cấp', sb: 100, bb: 200, buyIn: 10000 },
  { label: 'Đại Gia', sb: 500, bb: 1000, buyIn: 50000 },
];

export const PokerRoomModal: React.FC<PokerRoomModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onEnterGameWithRoom,
  onRequireRegisterName,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('JOIN');
  
  // Current active room state (if user is currently in a waiting room)
  const [currentRoom, setCurrentRoom] = useState<PokerRoom | null>(null);

  // Create form state
  const [roomName, setRoomName] = useState<string>('');
  const [selectedBlindIdx, setSelectedBlindIdx] = useState<number>(1);
  const [maxPlayers, setMaxPlayers] = useState<number>(6);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState<number>(15);
  const [customTurnTime, setCustomTurnTime] = useState<string>('15');
  const [roomPassword, setRoomPassword] = useState<string>('');

  // Join form state
  const [inputCode, setInputCode] = useState<string>('');
  const [joinPassword, setJoinPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<PokerRoom[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [netStatus, setNetStatus] = useState<NetworkStatus>(networkManager.getStatus());

  const currentRoomRef = useRef<PokerRoom | null>(null);
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Real-time WebRTC P2P Packet Listener
  useEffect(() => {
    const unsubStatus = networkManager.onStatusChange((status) => {
      setNetStatus(status);
    });

    const unsubPacket = networkManager.onPacket((packet: NetworkPacket) => {
      if (packet.type === 'PK_PLAYER_JOIN') {
        const room = currentRoomRef.current;
        const user = currentUserRef.current;
        if (room && user && room.hostId === user.id) {
          const incoming = packet.payload;
          if (room.players.length < room.maxPlayers && !room.players.some((p) => p.id === incoming.id)) {
            const occupied = new Set(room.players.map((p) => p.seatIdx));
            let seatIdx = 0;
            for (let i = 0; i < room.maxPlayers; i++) {
              if (!occupied.has(i)) {
                seatIdx = i;
                break;
              }
            }
            const newPlayer = {
              id: incoming.id,
              name: incoming.name,
              avatarColor: incoming.avatarColor || '#3b82f6',
              chips: room.buyIn,
              isHost: false,
              isReady: false,
              seatIdx,
            };
            const updated = {
              ...room,
              players: [...room.players, newPlayer],
            };
            const allRooms = getStoredRooms();
            saveRooms(allRooms.map((r) => (r.id === room.id ? updated : r)));
            setCurrentRoom(updated);
            networkManager.broadcast('PK_ROOM_SYNC', user, updated);
            sounds.playChips();
            showToast(`${incoming.name} vừa tham gia phòng qua WebRTC Internet!`);
          }
        }
      } else if (packet.type === 'PK_ROOM_SYNC') {
        const remoteRoom: PokerRoom = packet.payload;
        setCurrentRoom(remoteRoom);
        const allRooms = getStoredRooms();
        saveRooms([remoteRoom, ...allRooms.filter((r) => r.id !== remoteRoom.id)]);
      } else if (packet.type === 'PK_START_GAME') {
        const playingRoom: PokerRoom = packet.payload;
        setCurrentRoom(playingRoom);
        onEnterGameWithRoom(playingRoom);
      }
    });

    return () => {
      unsubStatus();
      unsubPacket();
    };
  }, [onEnterGameWithRoom]);

  // Refresh available rooms from local store + Central Server
  const refreshRooms = async () => {
    try {
      const localList = getStoredRooms();
      const serverList = await onlineHub.getRooms('poker');
      const mergedMap = new Map();
      localList.forEach((r) => mergedMap.set(r.id, r));
      serverList.forEach((sr) => {
        mergedMap.set(sr.id, {
          id: sr.id,
          code: sr.code,
          name: sr.name,
          hostId: sr.hostId,
          hostName: sr.hostName,
          smallBlind: sr.smallBlind || 25,
          bigBlind: sr.bigBlind || 50,
          buyIn: sr.buyIn || 2500,
          maxPlayers: sr.maxPlayers || 6,
          turnTimeSeconds: sr.turnTimeSeconds || 15,
          hasPassword: sr.hasPassword,
          status: (sr.status === 'PLAYING' ? 'PLAYING' : 'WAITING') as 'WAITING' | 'PLAYING',
          createdAt: sr.createdAt,
          players: sr.players || [],
          messages: [],
        });
      });
      const list = Array.from(mergedMap.values());
      setAvailableRooms(list);
      const active = currentRoomRef.current;
      if (active) {
        const updated = list.find((r) => r.id === active.id || r.code === active.code);
        if (updated) {
          setCurrentRoom(updated);
          if (updated.status === 'PLAYING') {
            onEnterGameWithRoom(updated);
          }
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshRooms();
      const interval = setInterval(refreshRooms, 1000);
      const unsubscribe = subscribeToRoomUpdates(() => {
        refreshRooms();
      });
      return () => {
        clearInterval(interval);
        unsubscribe();
      };
    }
  }, [isOpen, onEnterGameWithRoom]);

  useEffect(() => {
    if (currentUser?.name && !roomName) {
      setRoomName(`Phòng Của ${currentUser.name}`);
    }
  }, [currentUser?.name, roomName]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  if (!isOpen) return null;

  // Handler for creating room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      onRequireRegisterName();
      return;
    }

    const preset = BLIND_PRESETS[selectedBlindIdx];
    const finalTurnTime = Math.max(5, Math.min(120, Number(customTurnTime) || turnTimeSeconds || 15));

    const newRoom = createNewRoom({
      name: roomName.trim() || `Phòng Của ${currentUser.name}`,
      smallBlind: preset.sb,
      bigBlind: preset.bb,
      buyIn: preset.buyIn,
      maxPlayers,
      turnTimeSeconds: finalTurnTime,
      password: roomPassword.trim() || undefined,
      hostUser: {
        id: currentUser.id,
        name: currentUser.name,
        avatarColor: currentUser.avatarColor,
        chips: currentUser.chips,
      },
    });

    sounds.playChips();
    setCurrentRoom(newRoom);
    showToast(`Đã tạo phòng thành công! Mã phòng: ${newRoom.code}`);

    // Register room on central server for cross-device discovery
    await onlineHub.saveRoom({
      id: newRoom.id,
      game: 'poker',
      code: newRoom.code,
      name: newRoom.name,
      hostId: currentUser.id,
      hostName: currentUser.name,
      status: 'WAITING',
      maxPlayers: newRoom.maxPlayers,
      smallBlind: newRoom.smallBlind,
      bigBlind: newRoom.bigBlind,
      buyIn: newRoom.buyIn,
      turnTimeSeconds: newRoom.turnTimeSeconds,
      hasPassword: Boolean(roomPassword.trim()),
      password: roomPassword.trim() || undefined,
      players: newRoom.players,
      createdAt: newRoom.createdAt,
      lastActive: Date.now(),
    });

    // Register host on WebRTC P2P network
    networkManager.hostRoom('poker', newRoom.code, { id: currentUser.id, name: currentUser.name });
  };

  // Handler for joining room by code (Local or Remote WebRTC P2P)
  const handleJoinByCode = async (codeToJoin: string, passwordToUse?: string) => {
    setErrorMessage(null);

    if (!currentUser) {
      onRequireRegisterName();
      return;
    }

    const cleaned = codeToJoin.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!cleaned) {
      setErrorMessage('Vui lòng nhập mã phòng!');
      return;
    }

    // Try central server join first for seamless cross-device joining
    const serverJoin = await onlineHub.joinRoom(
      cleaned,
      {
        id: currentUser.id,
        name: currentUser.name,
        avatarColor: currentUser.avatarColor,
        chips: currentUser.chips,
      },
      passwordToUse || joinPassword
    );

    if (serverJoin.success && serverJoin.room) {
      const sr = serverJoin.room;
      const formatted = {
        id: sr.id,
        code: sr.code,
        name: sr.name,
        hostId: sr.hostId,
        hostName: sr.hostName,
        smallBlind: sr.smallBlind || 25,
        bigBlind: sr.bigBlind || 50,
        buyIn: sr.buyIn || 2500,
        maxPlayers: sr.maxPlayers || 6,
        turnTimeSeconds: sr.turnTimeSeconds || 15,
        status: (sr.status === 'PLAYING' ? 'PLAYING' : 'WAITING') as 'WAITING' | 'PLAYING',
        createdAt: sr.createdAt,
        players: sr.players,
        messages: [],
      };
      sounds.playChips();
      setCurrentRoom(formatted);
      const allRooms = getStoredRooms();
      saveRooms([formatted, ...allRooms.filter((r) => r.id !== formatted.id)]);
      showToast(`Đã tham gia phòng [${formatted.name}] thành công!`);

      networkManager.joinRoom('poker', cleaned, {
        id: currentUser.id,
        name: currentUser.name,
      }).then((conn) => {
        if (conn) {
          networkManager.broadcast('PK_PLAYER_JOIN', currentUser, {
            id: currentUser.id,
            name: currentUser.name,
            avatarColor: currentUser.avatarColor || '#f59e0b',
            chips: currentUser.chips,
          });
        }
      });
      return;
    }

    const result = joinRoom(
      cleaned,
      {
        id: currentUser.id,
        name: currentUser.name,
        avatarColor: currentUser.avatarColor,
        chips: currentUser.chips,
      },
      passwordToUse || joinPassword
    );

    if (result.success && result.room) {
      sounds.playChips();
      setCurrentRoom(result.room);
      showToast(`Đã tham gia phòng [${result.room.name}] thành công!`);

      // Connect WebRTC P2P as well for cross-network reliability
      networkManager.joinRoom('poker', cleaned, {
        id: currentUser.id,
        name: currentUser.name,
      }).then((conn) => {
        if (conn) {
          networkManager.broadcast('PK_PLAYER_JOIN', currentUser, {
            id: currentUser.id,
            name: currentUser.name,
            avatarColor: currentUser.avatarColor || '#f59e0b',
            chips: currentUser.chips,
          });
        }
      });
    } else {
      // Connect to remote room across the internet via WebRTC P2P!
      showToast(`Đang tìm kiếm phòng #${cleaned} qua WebRTC P2P...`);

      // Optimistic waiting room so member enters lobby immediately!
      const optimistic: PokerRoom = {
        id: 'remote_' + cleaned,
        code: cleaned,
        name: `Phòng #${cleaned}`,
        hostId: '',
        hostName: 'Chủ phòng',
        smallBlind: 25,
        bigBlind: 50,
        buyIn: 2500,
        maxPlayers: 6,
        turnTimeSeconds: 15,
        status: 'WAITING',
        createdAt: Date.now(),
        players: [
          {
            id: currentUser.id,
            name: currentUser.name,
            avatarColor: currentUser.avatarColor || '#f59e0b',
            chips: currentUser.chips,
            isHost: false,
            isReady: true,
            seatIdx: 1,
          },
        ],
        messages: [],
      };
      setCurrentRoom(optimistic);

      const connected = await networkManager.joinRoom('poker', cleaned, {
        id: currentUser.id,
        name: currentUser.name,
      });

      if (connected) {
        const sendJoin = () => {
          networkManager.broadcast('PK_PLAYER_JOIN', currentUser, {
            id: currentUser.id,
            name: currentUser.name,
            avatarColor: currentUser.avatarColor || '#f59e0b',
            chips: currentUser.chips,
          });
        };
        sendJoin();
        setTimeout(sendJoin, 500);
        setTimeout(sendJoin, 1200);
        showToast(`Đã kết nối thành công tới phòng #${cleaned}!`);
      } else {
        sounds.playFold();
        setCurrentRoom(null);
        setErrorMessage('Không thể tìm thấy hoặc kết nối tới phòng qua Internet. Vui lòng kiểm tra mã phòng!');
      }
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    sounds.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      showToast(`Đã sao chép mã phòng: ${code}`);
    }
  };

  // Host starts game
  const handleStartGame = async () => {
    if (!currentRoom) return;
    if (currentRoom.players.length < 2) {
      setErrorMessage('Cần ít nhất 2 người chơi hoặc thêm Bot AI để bắt đầu ván bài!');
      return;
    }

    sounds.playCardDeal();
    await onlineHub.setRoomStatus(currentRoom.id, 'PLAYING');
    const updated = startRoomGame(currentRoom.id) || { ...currentRoom, status: 'PLAYING' };
    if (currentUser) {
      networkManager.broadcast('PK_START_GAME', currentUser, updated);
    }
    onEnterGameWithRoom(updated);
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (!currentRoom || !currentUser) return;
    sounds.playClick();
    leaveRoom(currentRoom.id, currentUser.id);
    setCurrentRoom(null);
    refreshRooms();
  };

  // Add Bot to empty seat
  const handleAddBot = () => {
    if (!currentRoom) return;
    sounds.playClick();
    const updated = addBotToRoom(currentRoom.id);
    if (updated) setCurrentRoom(updated);
  };

  // Remove Bot
  const handleRemoveBot = () => {
    if (!currentRoom) return;
    sounds.playClick();
    const updated = removeBotFromRoom(currentRoom.id);
    if (updated) setCurrentRoom(updated);
  };

  // Toggle ready status
  const handleToggleReady = () => {
    if (!currentRoom || !currentUser) return;
    sounds.playClick();
    const updated = togglePlayerReady(currentRoom.id, currentUser.id);
    if (updated) setCurrentRoom(updated);
  };

  // Send message in lobby
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !currentUser || !chatInput.trim()) return;
    sounds.playClick();
    const updated = sendRoomMessage(
      currentRoom.id,
      currentUser.name,
      currentUser.avatarColor || '#f59e0b',
      chatInput
    );
    if (updated) {
      setCurrentRoom(updated);
      setChatInput('');
    }
  };

  const isHost = currentRoom && currentUser && currentRoom.hostId === currentUser.id;
  const currentPlayerInRoom = currentRoom?.players.find((p) => p.id === currentUser?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg shadow-sm">
              ♠
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center gap-2">
                Chế Độ Phòng (Room Mode)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Nhiều Người Chơi
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Tạo bàn riêng hoặc tham gia cùng bạn bè bằng Mã Phòng
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              if (currentRoom) handleLeaveRoom();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors min-w-[44px] min-h-[44px]"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs font-semibold text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>{successToast}</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2 text-xs font-semibold text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Area */}
        {currentRoom ? (
          /* =========================================================
             WAITING LOBBY (WHEN USER IS INSIDE A ROOM)
             ========================================================= */
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {/* Room Code Lockup Box */}
            <div className="bg-gradient-to-br from-amber-500/10 via-slate-800/80 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-center relative overflow-hidden shadow-lg">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90 mb-1">
                MÃ PHÒNG (ROOM CODE)
              </div>
              <div className="flex items-center justify-center gap-3 my-2">
                <span className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-[0.25em] pl-2 drop-shadow-md">
                  {currentRoom.code}
                </span>
                <button
                  onClick={() => handleCopyCode(currentRoom.code)}
                  className="px-3 py-1.5 min-h-[44px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs transition-colors flex items-center gap-1.5 active:scale-95"
                >
                  <span>📋</span>
                  <span>Sao chép</span>
                </button>
              </div>
              <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center justify-center gap-2">
                <span>Tên phòng: <strong className="text-white">{currentRoom.name}</strong></span>
                <span>•</span>
                <span>Mức cược:{' '}
                  <span className="text-emerald-400 font-mono font-bold">
                    ${currentRoom.smallBlind}/${currentRoom.bigBlind}
                  </span>
                </span>
                <span>•</span>
                <span>Vốn: <span className="text-amber-400 font-mono font-bold">${currentRoom.buyIn}</span></span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-[11px]">
                  ⏱ {currentRoom.turnTimeSeconds || 15}s / lượt
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Gửi mã 6 số này cho bạn bè để cùng vào phòng chơi Texas Hold'em!
              </p>
            </div>

            {/* Seated Players Diagram */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Người Chơi Trong Phòng</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-amber-400 font-mono">
                    {currentRoom.players.length}/{currentRoom.maxPlayers}
                  </span>
                </h3>

                {isHost && (
                  <div className="flex items-center gap-1.5">
                    {currentRoom.players.length < currentRoom.maxPlayers && (
                      <button
                        onClick={handleAddBot}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 hover:bg-emerald-900 transition-colors"
                      >
                        + Thêm Bot AI
                      </button>
                    )}
                    {currentRoom.players.some((p) => p.isBot) && (
                      <button
                        onClick={handleRemoveBot}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                      >
                        - Bớt Bot
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: currentRoom.maxPlayers }).map((_, seatIdx) => {
                  const player = currentRoom.players.find((p) => p.seatIdx === seatIdx);
                  return (
                    <div
                      key={seatIdx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        player
                          ? 'bg-slate-800/80 border-slate-700 text-white'
                          : 'bg-slate-900/40 border-dashed border-slate-800 text-slate-500'
                      }`}
                    >
                      {player ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm shrink-0 text-xs"
                            style={{ backgroundColor: player.avatarColor }}
                          >
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                              <span className="truncate">{player.name}</span>
                              {player.isHost && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  Chủ Phòng
                                </span>
                              )}
                              {player.isBot && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  AI
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-emerald-400">
                              ${player.chips.toLocaleString()} chip
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                          <div className="w-8 h-8 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-xs font-mono">
                            {seatIdx + 1}
                          </div>
                          <span className="text-[11px] italic">Ghế trống (Đang chờ...)</span>
                        </div>
                      )}

                      {player && (
                        <div className="shrink-0 text-right">
                          {player.isReady ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              ✓ Sẵn sàng
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                              Chờ
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Room Chat & Log */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col h-36">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 border-b border-slate-800/80 pb-1 flex justify-between">
                <span>Trò Chuyện & Hoạt Động Phòng</span>
                <span className="text-slate-500">Trực tiếp</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-xs font-sans">
                {currentRoom.messages.slice(-20).map((msg) => (
                  <div key={msg.id} className="leading-tight">
                    <span
                      className="font-bold mr-1 text-[11px]"
                      style={{ color: msg.senderColor }}
                    >
                      {msg.senderName}:
                    </span>
                    <span className={msg.isSystem ? 'text-amber-300/90 italic text-[11px]' : 'text-slate-200 text-xs'}>
                      {msg.text}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Gửi tin nhắn trong phòng..."
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 min-h-[36px]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-xs rounded-lg transition-colors min-h-[36px]"
                >
                  Gửi
                </button>
              </form>
            </div>

            {/* Lobby Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
              <button
                onClick={handleLeaveRoom}
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <span>← Rời Phòng</span>
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                {!isHost && (
                  <button
                    onClick={handleToggleReady}
                    className={`flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                      currentPlayerInRoom?.isReady
                        ? 'bg-slate-800 text-slate-300 border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    }`}
                  >
                    {currentPlayerInRoom?.isReady ? 'Hủy Sẵn Sàng' : 'Tôi Đã Sẵn Sàng!'}
                  </button>
                )}

                {isHost && (
                  <button
                    onClick={handleStartGame}
                    className="flex-1 sm:flex-initial px-6 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wide shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>BẮT ĐẦU VÁN BÀI</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             MAIN SELECTION: CREATE ROOM vs JOIN ROOM
             ========================================================= */
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveTab('JOIN');
                  setErrorMessage(null);
                }}
                className={`py-2.5 min-h-[44px] rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'JOIN'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🔑</span>
                <span>THAM GIA PHÒNG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveTab('CREATE');
                  setErrorMessage(null);
                }}
                className={`py-2.5 min-h-[44px] rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'CREATE'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>➕</span>
                <span>TẠO PHÒNG MỚI</span>
              </button>
            </div>

            {/* TAB 1: JOIN ROOM */}
            {activeTab === 'JOIN' && (
              <div className="space-y-5">
                {/* Direct Code Input Box */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-inner">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Nhập Mã Phòng (6 Chữ Số):
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        maxLength={8}
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                        placeholder="Ví dụ: 686868"
                        className="w-full px-4 py-3 min-h-[48px] bg-slate-900 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-center text-xl font-mono font-black text-amber-300 tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:font-normal placeholder:text-sm placeholder:text-slate-500 focus:outline-none transition-colors"
                      />
                      {inputCode && (
                        <button
                          type="button"
                          onClick={() => setInputCode('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs px-1.5 py-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinByCode(inputCode)}
                      disabled={!inputCode.trim()}
                      className="px-6 py-3 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-black text-sm uppercase tracking-wide transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>Vào Bàn</span>
                      <span>→</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Hỏi bạn bè hoặc chủ phòng mã 6 ký tự để tham gia trực tiếp.
                  </p>
                </div>

                {/* Available Public Rooms List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span>Phòng Đang Mở Công Khai</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({availableRooms.length} phòng)
                      </span>
                    </h3>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        refreshRooms();
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <span>🔄</span>
                      <span>Làm Mới</span>
                    </button>
                  </div>

                  {availableRooms.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs">
                      Hiện chưa có phòng mở nào. Hãy là người đầu tiên{' '}
                      <button
                        onClick={() => setActiveTab('CREATE')}
                        className="text-amber-400 font-bold underline hover:text-amber-300"
                      >
                        Tạo Phòng Mới
                      </button>
                      !
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {availableRooms.map((room) => (
                        <div
                          key={room.id}
                          className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                #{room.code}
                              </span>
                              <h4 className="text-xs font-bold text-white truncate">{room.name}</h4>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                              <span>Chủ: <strong className="text-slate-300">{room.hostName}</strong></span>
                              <span>•</span>
                              <span className="text-emerald-400 font-mono font-semibold">
                                ${room.smallBlind}/${room.bigBlind}
                              </span>
                              <span>•</span>
                              <span className="text-slate-300">
                                {room.players.length}/{room.maxPlayers} người
                              </span>
                              <span>•</span>
                              <span className="text-cyan-400 font-mono font-semibold">
                                ⏱ {room.turnTimeSeconds || 15}s/lượt
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleJoinByCode(room.code)}
                            className="px-4 py-2 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide transition-colors shrink-0 shadow-sm active:scale-95"
                          >
                            Tham Gia
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CREATE ROOM */}
            {activeTab === 'CREATE' && (
              <form onSubmit={handleCreateRoom} className="space-y-4">
                {/* Room Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tên Phòng:
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Ví dụ: Bàn Đấu Hoàng Gia, Phòng Bạn Thân..."
                    maxLength={30}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                {/* Blind Presets */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Mức Cược (Small / Big Blind & Vốn Vào Bàn):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {BLIND_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setSelectedBlindIdx(idx);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all min-h-[56px] ${
                          selectedBlindIdx === idx
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-white">{p.label}</div>
                        <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                          ${p.sb}/${p.bb}
                        </div>
                        <div className="text-[10px] text-slate-400">Vốn: ${p.buyIn.toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Players */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Số Lượng Người Chơi Tối Đa:
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setMaxPlayers(num);
                        }}
                        className={`py-2 rounded-xl border text-center font-bold text-xs min-h-[44px] transition-all ${
                          maxPlayers === num
                            ? 'bg-amber-500 text-slate-950 font-black border-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {num} Người
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turn Time (Seconds) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⏱ Thời Gian Mỗi Lượt (Giây):</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded">
                      {customTurnTime || turnTimeSeconds} giây / lượt
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 mb-2">
                    {[10, 15, 20, 30, 45, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setTurnTimeSeconds(sec);
                          setCustomTurnTime(sec.toString());
                        }}
                        className={`py-2 rounded-xl border text-center font-bold text-xs min-h-[40px] transition-all ${
                          Number(customTurnTime) === sec
                            ? 'bg-cyan-500 text-slate-950 font-black border-cyan-400 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">Tùy chỉnh số giây:</span>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={customTurnTime}
                      onChange={(e) => setCustomTurnTime(e.target.value)}
                      placeholder="15"
                      className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-400 text-center"
                    />
                    <span className="text-xs text-slate-400">giây (5s - 120s)</span>
                  </div>
                </div>

                {/* Password / PIN (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Mật Khẩu Phòng (Tùy Chọn):
                  </label>
                  <input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder="Để trống nếu muốn phòng công khai"
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nếu đặt mật khẩu, người chơi khác cần nhập đúng mã này để vào phòng.
                  </p>
                </div>

                {/* Submit Create Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 min-h-[50px] rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <span>TẠO PHÒNG & NHẬN MÃ PHÒNG</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <div>
            Người chơi: <strong className="text-amber-400">{currentUser?.name || 'Khách chưa đăng ký'}</strong>
          </div>
          <div className="text-slate-500 text-[10px]">
            Hệ thống phòng Texas Hold'em đồng bộ tức thì
          </div>
        </div>
      </div>
    </div>
  );
};
