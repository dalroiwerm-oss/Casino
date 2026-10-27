import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../logic/auth';
import { sounds } from '../logic/audio';
import { networkManager, NetworkStatus, NetworkPacket } from '../logic/network';
import { onlineHub } from '../logic/onlineHub';

export interface TienLenRoomPlayer {
  id: string;
  name: string;
  avatarColor: string;
  chips: number;
  isHost: boolean;
  isBot?: boolean;
  isReady: boolean;
  seatIdx: number;
}

export interface TienLenRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  stake: number;
  maxPlayers: number; // 4
  turnTimeSeconds?: number; // customizable seconds per turn (e.g. 10, 15, 20, 30, 45, 60)
  hasPassword?: boolean;
  password?: string;
  status: 'WAITING' | 'PLAYING';
  createdAt: number;
  players: TienLenRoomPlayer[];
}

const TL_ROOMS_STORAGE_KEY = 'TIENLEN_ROOMS_STORE_V1';

let tlChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    tlChannel = new BroadcastChannel('tienlen_room_sync');
  }
} catch {
  tlChannel = null;
}

export function getStoredTienLenRooms(): TienLenRoom[] {
  try {
    const raw = localStorage.getItem(TL_ROOMS_STORAGE_KEY);
    if (!raw) {
      const defaultRoom: TienLenRoom = {
        id: 'tl_room_vip',
        code: '999888',
        name: 'Sới Bạc Miền Nam VIP',
        hostId: 'system_tl_host',
        hostName: 'Cao Thủ Tiến Lên',
        stake: 100,
        maxPlayers: 4,
        turnTimeSeconds: 20,
        status: 'WAITING',
        createdAt: Date.now() - 60000,
        players: [
          {
            id: 'system_tl_host',
            name: 'Cao Thủ Tiến Lên',
            avatarColor: '#f43f5e',
            chips: 5000,
            isHost: true,
            isReady: true,
            seatIdx: 0,
          },
          {
            id: 'bot_namphong',
            name: 'Nam Phong (AI)',
            avatarColor: '#10b981',
            chips: 5000,
            isHost: false,
            isBot: true,
            isReady: true,
            seatIdx: 1,
          },
        ],
      };
      localStorage.setItem(TL_ROOMS_STORAGE_KEY, JSON.stringify([defaultRoom]));
      return [defaultRoom];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTienLenRooms(rooms: TienLenRoom[]): void {
  try {
    localStorage.setItem(TL_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
    if (tlChannel) {
      tlChannel.postMessage({ type: 'TL_ROOMS_UPDATED', timestamp: Date.now() });
    }
  } catch {
    // ignore
  }
}

interface TienLenRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onEnterGameWithRoom: (room: TienLenRoom) => void;
  onRequireRegisterName: () => void;
}

const STAKE_PRESETS = [
  { label: 'Tập Sự', stake: 20 },
  { label: 'Tiêu Chuẩn', stake: 50 },
  { label: 'Cao Cấp', stake: 100 },
  { label: 'Đại Gia', stake: 500 },
];

export const TienLenRoomModal: React.FC<TienLenRoomModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onEnterGameWithRoom,
  onRequireRegisterName,
}) => {
  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [currentRoom, setCurrentRoom] = useState<TienLenRoom | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [selectedStakeIdx, setSelectedStakeIdx] = useState<number>(1);
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState<number>(20);
  const [customTurnTime, setCustomTurnTime] = useState<string>('20');
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<TienLenRoom[]>([]);
  const [netStatus, setNetStatus] = useState<NetworkStatus>(networkManager.getStatus());

  const currentRoomRef = useRef<TienLenRoom | null>(null);
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Subscribe to real-time WebRTC P2P packets
  useEffect(() => {
    const unsubStatus = networkManager.onStatusChange((status) => {
      setNetStatus(status);
    });

    const unsubPacket = networkManager.onPacket((packet: NetworkPacket) => {
      if (packet.type === 'TL_PLAYER_JOIN') {
        const room = currentRoomRef.current;
        const user = currentUserRef.current;
        if (room && user && room.hostId === user.id) {
          const incoming = packet.payload;
          const maxP = room.maxPlayers || 4;
          if (room.players.length < maxP && !room.players.some((p) => p.id === incoming.id)) {
            const occupiedSeats = new Set(room.players.map((p) => p.seatIdx));
            let seatIdx = 0;
            for (let i = 0; i < maxP; i++) {
              if (!occupiedSeats.has(i)) {
                seatIdx = i;
                break;
              }
            }
            const newPlayer: TienLenRoomPlayer = {
              id: incoming.id,
              name: incoming.name,
              avatarColor: incoming.avatarColor || '#3b82f6',
              chips: incoming.chips || 2500,
              isHost: false,
              isReady: true,
              seatIdx,
            };
            const updated: TienLenRoom = {
              ...room,
              players: [...room.players, newPlayer],
            };
            const allRooms = getStoredTienLenRooms();
            saveTienLenRooms(allRooms.map((r) => (r.id === room.id ? updated : r)));
            setCurrentRoom(updated);
            networkManager.broadcast('TL_ROOM_SYNC', user, updated);
            sounds.playChips();
            showToast(`${incoming.name} vừa tham gia bàn!`);
          } else if (room.players.some((p) => p.id === incoming.id)) {
            // Re-sync current room state to joined player
            networkManager.broadcast('TL_ROOM_SYNC', user, room);
          }
        }
      } else if (packet.type === 'TL_ROOM_SYNC') {
        const remoteRoom: TienLenRoom = packet.payload;
        setCurrentRoom(remoteRoom);
        const allRooms = getStoredTienLenRooms();
        saveTienLenRooms([remoteRoom, ...allRooms.filter((r) => r.id !== remoteRoom.id)]);
      } else if (packet.type === 'TL_START_GAME') {
        const playingRoom: TienLenRoom = packet.payload;
        setCurrentRoom(playingRoom);
        onEnterGameWithRoom(playingRoom);
      }
    });

    return () => {
      unsubStatus();
      unsubPacket();
    };
  }, [onEnterGameWithRoom]);

  const refreshRooms = async () => {
    const localList = getStoredTienLenRooms();
    const serverRooms = await onlineHub.getRooms('tienlen');
    const map = new Map<string, TienLenRoom>();
    localList.forEach((r) => map.set(r.code, r));
    serverRooms.forEach((sr) => {
      map.set(sr.code, {
        id: sr.id,
        code: sr.code,
        name: sr.name,
        hostId: sr.hostId,
        hostName: sr.hostName,
        stake: sr.stake || 100,
        maxPlayers: sr.maxPlayers || 2,
        turnTimeSeconds: sr.turnTimeSeconds || 20,
        status: sr.status as any,
        createdAt: sr.createdAt,
        players: sr.players,
      });
    });
    const combined = Array.from(map.values());
    setAvailableRooms(combined);

    const active = currentRoomRef.current;
    if (active) {
      const updated = combined.find((r) => r.id === active.id || r.code === active.code);
      if (updated) {
        setCurrentRoom(updated);
        if (updated.status === 'PLAYING') {
          onEnterGameWithRoom(updated);
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshRooms();
      // Active polling every 1 second to ensure instant reaction when host starts game
      const interval = setInterval(refreshRooms, 1000);

      const handleStorage = (e: StorageEvent) => {
        if (e.key === TL_ROOMS_STORAGE_KEY) refreshRooms();
      };
      const handleMsg = (e: MessageEvent) => {
        if (e.data?.type === 'TL_START_GAME' && e.data?.room) {
          const playing = e.data.room;
          const active = currentRoomRef.current;
          if (active && (active.id === playing.id || active.code === playing.code)) {
            setCurrentRoom(playing);
            onEnterGameWithRoom(playing);
            return;
          }
        }
        refreshRooms();
      };
      window.addEventListener('storage', handleStorage);
      if (tlChannel) tlChannel.addEventListener('message', handleMsg);
      return () => {
        clearInterval(interval);
        window.removeEventListener('storage', handleStorage);
        if (tlChannel) tlChannel.removeEventListener('message', handleMsg);
      };
    }
  }, [isOpen, onEnterGameWithRoom]);

  useEffect(() => {
    if (currentUser?.name && !roomName) {
      setRoomName(`Bàn Của ${currentUser.name}`);
    }
  }, [currentUser?.name, roomName]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  if (!isOpen) return null;

  // Handle Create Room
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireRegisterName();
      return;
    }

    const finalTurnTime = Math.max(5, Math.min(120, Number(customTurnTime) || turnTimeSeconds || 20));

    const rooms = getStoredTienLenRooms();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newRoom: TienLenRoom = {
      id: 'tl_room_' + Date.now(),
      code,
      name: roomName.trim() || `Bàn Của ${currentUser.name}`,
      hostId: currentUser.id,
      hostName: currentUser.name,
      stake: STAKE_PRESETS[selectedStakeIdx].stake,
      maxPlayers: maxPlayers || 2,
      turnTimeSeconds: finalTurnTime,
      hasPassword: Boolean(roomPassword.trim()),
      password: roomPassword.trim() || undefined,
      status: 'WAITING',
      createdAt: Date.now(),
      players: [
        {
          id: currentUser.id,
          name: currentUser.name,
          avatarColor: currentUser.avatarColor || '#f43f5e',
          chips: currentUser.chips,
          isHost: true,
          isReady: true,
          seatIdx: 0,
        },
      ],
    };

    saveTienLenRooms([newRoom, ...rooms]);
    setCurrentRoom(newRoom);
    sounds.playChips();
    showToast(`Tạo bàn chơi thành công! Mã phòng: ${code}`);

    // Register room to Central Server for multi-device cross-internet discovery
    onlineHub.saveRoom({ ...newRoom, game: 'tienlen', lastActive: Date.now() });

    // Host room on WebRTC network for internet peers
    networkManager.hostRoom('tienlen', code, { id: currentUser.id, name: currentUser.name });
  };

  // Join Room by Code (Local or Remote WebRTC P2P + Central Server)
  const handleJoinByCode = async (codeToJoin: string) => {
    if (!currentUser) {
      onRequireRegisterName();
      return;
    }
    const cleanCode = codeToJoin.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!cleanCode) {
      setErrorMessage('Vui lòng nhập mã phòng!');
      return;
    }

    setErrorMessage(null);
    const rooms = getStoredTienLenRooms();
    const target = rooms.find((r) => r.code === cleanCode);

    const newPlayer: TienLenRoomPlayer = {
      id: currentUser.id,
      name: currentUser.name,
      avatarColor: currentUser.avatarColor || '#3b82f6',
      chips: currentUser.chips,
      isHost: false,
      isReady: true,
      seatIdx: 1,
    };

    if (target) {
      const maxP = target.maxPlayers || 4;
      if (target.players.some((p) => p.id === currentUser.id)) {
        setCurrentRoom(target);
        networkManager.joinRoom('tienlen', cleanCode, { id: currentUser.id, name: currentUser.name });
        return;
      }

      if (target.players.length >= maxP) {
        setErrorMessage(`Phòng #${cleanCode} đã đủ ${maxP} người chơi!`);
        return;
      }

      const occupiedSeats = new Set(target.players.map((p) => p.seatIdx));
      let seatIdx = 0;
      for (let i = 0; i < maxP; i++) {
        if (!occupiedSeats.has(i)) {
          seatIdx = i;
          break;
        }
      }
      newPlayer.seatIdx = seatIdx;

      const updated: TienLenRoom = {
        ...target,
        players: [...target.players, newPlayer],
      };

      saveTienLenRooms(rooms.map((r) => (r.id === target.id ? updated : r)));
      setCurrentRoom(updated);
      sounds.playChips();
      showToast(`Đã tham gia phòng [${target.name}]!`);

      // Sync join to central server and WebRTC P2P
      onlineHub.joinRoom(cleanCode, newPlayer);
      networkManager.joinRoom('tienlen', cleanCode, {
        id: currentUser.id,
        name: currentUser.name,
      }).then((conn) => {
        if (conn) {
          networkManager.broadcast('TL_PLAYER_JOIN', currentUser, newPlayer);
        }
      });
    } else {
      // Connect to remote player's room across the internet via Central Server + WebRTC P2P!
      showToast(`Đang kết nối tới phòng #${cleanCode} qua máy chủ & WebRTC P2P...`);

      // Optimistic waiting room so the member enters lobby immediately!
      const optimisticRoom: TienLenRoom = {
        id: 'remote_' + cleanCode,
        code: cleanCode,
        name: `Phòng #${cleanCode}`,
        hostId: '',
        hostName: 'Chủ phòng',
        stake: 100,
        maxPlayers: 2,
        turnTimeSeconds: 20,
        status: 'WAITING',
        createdAt: Date.now(),
        players: [newPlayer],
      };
      setCurrentRoom(optimisticRoom);

      // 1. Join via central server
      const serverJoinRes = await onlineHub.joinRoom(cleanCode, newPlayer);
      if (serverJoinRes.success && serverJoinRes.room) {
        const sr = serverJoinRes.room;
        const joinedRoom: TienLenRoom = {
          id: sr.id,
          code: sr.code,
          name: sr.name,
          hostId: sr.hostId,
          hostName: sr.hostName,
          stake: sr.stake || 100,
          maxPlayers: sr.maxPlayers || 2,
          turnTimeSeconds: sr.turnTimeSeconds || 20,
          status: sr.status as any,
          createdAt: sr.createdAt,
          players: sr.players,
        };
        setCurrentRoom(joinedRoom);
        saveTienLenRooms([joinedRoom, ...getStoredTienLenRooms().filter((r) => r.code !== cleanCode)]);
      }

      // 2. Connect via WebRTC P2P
      const connected = await networkManager.joinRoom('tienlen', cleanCode, {
        id: currentUser.id,
        name: currentUser.name,
      });

      if (connected) {
        const sendJoin = () => {
          networkManager.broadcast('TL_PLAYER_JOIN', currentUser, newPlayer);
        };
        sendJoin();
        setTimeout(sendJoin, 500);
        setTimeout(sendJoin, 1200);
        showToast(`Đã kết nối thành công tới phòng #${cleanCode}!`);
      } else if (!serverJoinRes.success) {
        sounds.playFold();
        setCurrentRoom(null);
        setErrorMessage('Không thể tìm thấy hoặc kết nối tới phòng qua Internet. Vui lòng kiểm tra mã phòng!');
      }
    }
  };

  // Add Bot to fill seats (respecting room maxPlayers)
  const handleAddBot = () => {
    if (!currentRoom) return;
    const maxP = currentRoom.maxPlayers || 4;
    if (currentRoom.players.length >= maxP) return;
    const botNames = ['Đông Hải', 'Nam Phong', 'Tây Sơn', 'Bắc Đẩu'];
    const botColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
    const occupiedSeats = new Set(currentRoom.players.map((p) => p.seatIdx));
    let seatIdx = 0;
    for (let i = 0; i < maxP; i++) {
      if (!occupiedSeats.has(i)) {
        seatIdx = i;
        break;
      }
    }

    const botPlayer: TienLenRoomPlayer = {
      id: 'bot_' + Date.now(),
      name: `${botNames[seatIdx % botNames.length]} (AI)`,
      avatarColor: botColors[seatIdx % botColors.length],
      chips: 5000,
      isHost: false,
      isBot: true,
      isReady: true,
      seatIdx,
    };

    const updated = {
      ...currentRoom,
      players: [...currentRoom.players, botPlayer],
    };

    const rooms = getStoredTienLenRooms();
    saveTienLenRooms(rooms.map((r) => (r.id === currentRoom.id ? updated : r)));
    setCurrentRoom(updated);
    onlineHub.saveRoom({ ...updated, game: 'tienlen', lastActive: Date.now() });
    if (currentUser) {
      networkManager.broadcast('TL_ROOM_SYNC', currentUser, updated);
    }
    sounds.playClick();
  };

  // Remove Bot
  const handleRemoveBot = () => {
    if (!currentRoom) return;
    const bots = currentRoom.players.filter((p) => p.isBot);
    if (bots.length === 0) return;
    const lastBot = bots[bots.length - 1];
    const updated: TienLenRoom = {
      ...currentRoom,
      players: currentRoom.players.filter((p) => p.id !== lastBot.id),
    };
    const rooms = getStoredTienLenRooms();
    saveTienLenRooms(rooms.map((r) => (r.id === currentRoom.id ? updated : r)));
    setCurrentRoom(updated);
    onlineHub.saveRoom({ ...updated, game: 'tienlen', lastActive: Date.now() });
    if (currentUser) {
      networkManager.broadcast('TL_ROOM_SYNC', currentUser, updated);
    }
    sounds.playClick();
  };

  // Start Room Game
  const handleStartGame = () => {
    if (!currentRoom) return;
    if (currentRoom.players.length < 2) {
      setErrorMessage('Cần ít nhất 2 người chơi (hoặc thêm Bot AI) để bắt đầu!');
      return;
    }

    sounds.playCardDeal();
    const updated: TienLenRoom = {
      ...currentRoom,
      status: 'PLAYING',
    };

    const rooms = getStoredTienLenRooms();
    saveTienLenRooms(rooms.map((r) => (r.id === currentRoom.id ? updated : r)));
    onlineHub.setRoomStatus(currentRoom.id, 'PLAYING');
    if (currentUser) {
      networkManager.broadcast('TL_START_GAME', currentUser, updated);
    }
    if (tlChannel) {
      tlChannel.postMessage({ type: 'TL_START_GAME', room: updated });
    }
    onEnterGameWithRoom(updated);
  };

  const isHost = currentRoom && currentUser && currentRoom.hostId === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-xl bg-slate-900 border border-rose-500/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center text-lg font-bold shadow-sm">
              ♥
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white font-serif uppercase">
                Phòng Chơi Tiến Lên Miền Nam
              </h2>
              <p className="text-[11px] text-slate-400">
                Tạo bàn 4 người riêng hoặc tham gia cùng bạn bè bằng Mã Phòng
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-900 border border-slate-700">
              <span
                className={`w-2 h-2 rounded-full ${
                  netStatus === 'HOSTING' || netStatus === 'CONNECTED'
                    ? 'bg-emerald-400 animate-pulse'
                    : netStatus === 'CONNECTING'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-slate-500'
                }`}
              />
              <span
                className={
                  netStatus === 'HOSTING' || netStatus === 'CONNECTED'
                    ? 'text-emerald-300'
                    : 'text-slate-400'
                }
              >
                {netStatus === 'HOSTING'
                  ? 'P2P Online (Chủ Bàn)'
                  : netStatus === 'CONNECTED'
                  ? 'P2P Online (Đã Nối)'
                  : netStatus === 'CONNECTING'
                  ? 'Đang Nối P2P...'
                  : 'WebRTC P2P'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toasts / Alerts */}
        {successToast && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-300">
            {successToast}
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-2 text-xs font-bold text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Body */}
        {currentRoom ? (
          /* WAITING ROOM LOBBY */
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Room Code Banner */}
            <div className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/60 border border-rose-500/40 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                MÃ PHÒNG (ROOM CODE)
              </span>
              <div className="flex items-center justify-center gap-3 my-1">
                <span className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-[0.2em]">
                  {currentRoom.code}
                </span>
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(currentRoom.code);
                      showToast(`Đã sao chép mã: ${currentRoom.code}`);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors"
                >
                  Sao chép
                </button>
              </div>
              <div className="text-xs text-slate-300 flex flex-wrap items-center justify-center gap-2 mt-1">
                <span>Bàn: <strong>{currentRoom.name}</strong></span>
                <span>·</span>
                <span>Mức cược: <strong className="text-emerald-400 font-mono">${currentRoom.stake}</strong></span>
                <span>·</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono font-bold text-[11px]">
                  ⏱ {currentRoom.turnTimeSeconds || 20}s / lượt
                </span>
              </div>
            </div>

            {/* Dynamic Player Seats */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                  Người Chơi ({currentRoom.players.length}/{currentRoom.maxPlayers || 2})
                </span>
                {isHost && (
                  <div className="flex items-center gap-1.5">
                    {currentRoom.players.some((p) => p.isBot) && (
                      <button
                        onClick={handleRemoveBot}
                        className="px-2.5 py-1 rounded-lg bg-rose-950 border border-rose-600/50 text-rose-300 text-xs font-semibold hover:bg-rose-900 transition-colors"
                      >
                        - Bớt Bot
                      </button>
                    )}
                    {currentRoom.players.length < (currentRoom.maxPlayers || 2) && (
                      <button
                        onClick={handleAddBot}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-600/50 text-emerald-300 text-xs font-semibold hover:bg-emerald-900 transition-colors"
                      >
                        + Thêm Bot AI
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={`grid gap-2 ${currentRoom.maxPlayers === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {Array.from({ length: currentRoom.maxPlayers || 2 }).map((_, seatIdx) => {
                  const p = currentRoom.players.find((pl) => pl.seatIdx === seatIdx);
                  return (
                    <div
                      key={seatIdx}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        p
                          ? 'bg-slate-800/80 border-slate-700'
                          : 'bg-slate-950/40 border-dashed border-slate-800 text-slate-500'
                      }`}
                    >
                      {p ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow"
                            style={{ backgroundColor: p.avatarColor }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold truncate flex items-center gap-1">
                              <span>{p.name}</span>
                              {p.isHost && (
                                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  Chủ
                                </span>
                              )}
                              {p.isBot && (
                                <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Bot AI
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-emerald-400 font-mono">
                              ${p.chips.toLocaleString()} chip
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-500">Ghế {seatIdx + 1} đang chờ người...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
              <button
                onClick={() => setCurrentRoom(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Rời Bàn
              </button>

              {isHost ? (
                <button
                  onClick={handleStartGame}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-black text-sm uppercase tracking-wide shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  BẮT ĐẦU CHƠI
                </button>
              ) : (
                <span className="text-xs text-amber-300 italic">Đang chờ chủ bàn bắt đầu ván...</span>
              )}
            </div>
          </div>
        ) : (
          /* JOIN OR CREATE TABS */
          <div className="p-5 space-y-5 overflow-y-auto">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('JOIN')}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  activeTab === 'JOIN' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                THAM GIA PHÒNG
              </button>
              <button
                onClick={() => setActiveTab('CREATE')}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  activeTab === 'CREATE' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                TẠO PHÒNG MỚI
              </button>
            </div>

            {activeTab === 'JOIN' ? (
              <div className="space-y-4">
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-center">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Nhập Mã Phòng 6 Số:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={8}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="VD: 999888"
                      className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-black text-xl text-amber-300 uppercase tracking-widest focus:outline-none focus:border-rose-400"
                    />
                    <button
                      disabled={!inputCode.trim()}
                      onClick={() => handleJoinByCode(inputCode)}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wide transition-all"
                    >
                      Vào Bàn
                    </button>
                  </div>
                </div>

                {/* Available Rooms List */}
                <div>
                  <span className="text-xs font-bold uppercase text-slate-300 tracking-wider mb-2 block">
                    Bàn Chơi Đang Mở ({availableRooms.length})
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableRooms.map((room) => (
                      <div
                        key={room.id}
                        className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 shrink-0">
                              #{room.code}
                            </span>
                            <span className="font-bold text-xs text-white truncate">{room.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="truncate max-w-[80px]">Chủ: {room.hostName}</span>
                            <span>·</span>
                            <span>Cược: <span className="text-emerald-400 font-mono">${room.stake}</span></span>
                            <span>·</span>
                            <span>{room.players.length}/4 người</span>
                            <span>·</span>
                            <span className="text-rose-400 font-mono font-semibold">⏱ {room.turnTimeSeconds || 20}s/lượt</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinByCode(room.code)}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shrink-0 active:scale-95 transition-all"
                        >
                          Vào
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* CREATE ROOM FORM */
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tên Bàn Chơi:
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="VD: Sới Bạc Miền Nam, Bàn Anh Em..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                {/* Player Count */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Số Lượng Người Chơi:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { count: 2, label: '2 Người', desc: 'Đấu Solo 1 vs 1' },
                      { count: 3, label: '3 Người', desc: 'Tam Đấu' },
                      { count: 4, label: '4 Người', desc: 'Bàn Đầy Đủ' },
                    ].map((opt) => (
                      <button
                        key={opt.count}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setMaxPlayers(opt.count);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          maxPlayers === opt.count
                            ? 'bg-rose-950/80 border-rose-500 text-white ring-1 ring-rose-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Mức Cược Ván:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {STAKE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedStakeIdx(idx)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          selectedStakeIdx === idx
                            ? 'bg-rose-950/80 border-rose-500 text-white ring-1 ring-rose-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">{p.label}</div>
                        <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                          ${p.stake}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turn Time (Seconds) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <span>⏱ Thời Gian Mỗi Lượt (Giây):</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/80 border border-rose-500/30 px-2 py-0.5 rounded">
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
                            ? 'bg-rose-600 text-white font-black border-rose-400 shadow-md'
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
                      placeholder="20"
                      className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-rose-400 text-center"
                    />
                    <span className="text-xs text-slate-400">giây (5s - 120s)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-600/25 active:scale-95 transition-all"
                >
                  TẠO BÀN VÀ LẤY MÃ PHÒNG
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
