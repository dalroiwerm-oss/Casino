/**
 * Room Management for Texas Hold'em Poker
 * Supports Create Room (Tạo Phòng) and Join Room (Tham Gia Phòng)
 * with multi-tab real-time sync via BroadcastChannel and localStorage.
 */

export interface RoomPlayer {
  id: string;
  name: string;
  avatarColor: string;
  chips: number;
  isHost: boolean;
  isBot?: boolean;
  isReady: boolean;
  seatIdx: number;
}

export interface RoomChatMessage {
  id: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface PokerRoom {
  id: string;
  code: string; // 6-digit code e.g. "849201"
  name: string;
  hostId: string;
  hostName: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  maxPlayers: number; // 2 to 6
  turnTimeSeconds: number; // customizable turn timer in seconds (e.g. 10, 15, 20, 30, 45, 60)
  hasPassword?: boolean;
  password?: string;
  status: 'WAITING' | 'PLAYING';
  createdAt: number;
  players: RoomPlayer[];
  messages: RoomChatMessage[];
}

const ROOMS_STORAGE_KEY = 'POKER_ROOMS_STORE_V1';

// Cross-tab broadcast channel
let roomChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    roomChannel = new BroadcastChannel('poker_room_sync');
  }
} catch {
  roomChannel = null;
}

// Generate 6-digit room code
export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Load all active rooms
export function getStoredRooms(): PokerRoom[] {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) {
      // Seed default public community room
      const defaultRoom: PokerRoom = {
        id: 'room_vip_public',
        code: '686868',
        name: 'Bàn Đấu VIP Hoàng Gia',
        hostId: 'system_host',
        hostName: 'Cao Thủ Poker (Host)',
        smallBlind: 25,
        bigBlind: 50,
        buyIn: 2500,
        maxPlayers: 6,
        turnTimeSeconds: 15,
        hasPassword: false,
        status: 'WAITING',
        createdAt: Date.now() - 120000,
        players: [
          {
            id: 'system_host',
            name: 'Cao Thủ Poker',
            avatarColor: '#f59e0b',
            chips: 2500,
            isHost: true,
            isReady: true,
            seatIdx: 0,
          },
          {
            id: 'bot_dragon',
            name: 'Hắc Long',
            avatarColor: '#ef4444',
            chips: 2500,
            isHost: false,
            isBot: true,
            isReady: true,
            seatIdx: 1,
          },
        ],
        messages: [
          {
            id: 'm1',
            senderName: 'Hệ Thống',
            senderColor: '#10b981',
            text: 'Chào mừng bạn đến với Bàn Đấu VIP! Mã phòng: 686868',
            timestamp: Date.now() - 60000,
            isSystem: true,
          },
        ],
      };
      saveRooms([defaultRoom]);
      return [defaultRoom];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Save rooms to storage and broadcast
export function saveRooms(rooms: PokerRoom[]): void {
  try {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
    if (roomChannel) {
      roomChannel.postMessage({ type: 'ROOMS_UPDATED', timestamp: Date.now() });
    }
  } catch (e) {
    console.error('Failed to save rooms', e);
  }
}

// Find room by code
export function findRoomByCode(code: string): PokerRoom | undefined {
  const cleaned = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  const rooms = getStoredRooms();
  return rooms.find((r) => r.code === cleaned);
}

// Find room by ID
export function getRoomById(roomId: string): PokerRoom | undefined {
  const rooms = getStoredRooms();
  return rooms.find((r) => r.id === roomId);
}

// Create new room
export interface CreateRoomParams {
  name: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  maxPlayers: number;
  turnTimeSeconds?: number;
  password?: string;
  hostUser: {
    id: string;
    name: string;
    avatarColor?: string;
    chips?: number;
  };
}

export function createNewRoom(params: CreateRoomParams): PokerRoom {
  const rooms = getStoredRooms();
  let code = generateRoomCode();
  // Ensure unique code
  while (rooms.some((r) => r.code === code)) {
    code = generateRoomCode();
  }

  const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const hostPlayer: RoomPlayer = {
    id: params.hostUser.id,
    name: params.hostUser.name,
    avatarColor: params.hostUser.avatarColor || '#f59e0b',
    chips: params.buyIn,
    isHost: true,
    isReady: true,
    seatIdx: 0,
  };

  const newRoom: PokerRoom = {
    id: roomId,
    code,
    name: params.name.trim() || `Phòng của ${params.hostUser.name}`,
    hostId: params.hostUser.id,
    hostName: params.hostUser.name,
    smallBlind: params.smallBlind,
    bigBlind: params.bigBlind,
    buyIn: params.buyIn,
    maxPlayers: Math.min(6, Math.max(2, params.maxPlayers)),
    turnTimeSeconds: params.turnTimeSeconds && params.turnTimeSeconds > 0 ? params.turnTimeSeconds : 15,
    hasPassword: Boolean(params.password && params.password.trim().length > 0),
    password: params.password ? params.password.trim() : undefined,
    status: 'WAITING',
    createdAt: Date.now(),
    players: [hostPlayer],
    messages: [
      {
        id: 'msg_welcome_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#10b981',
        text: `Phòng đã tạo thành công! Chia sẻ mã phòng [${code}] để bạn bè cùng tham gia.`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  const updatedRooms = [newRoom, ...rooms.filter((r) => r.id !== roomId)];
  saveRooms(updatedRooms);
  return newRoom;
}

// Join an existing room
export function joinRoom(
  roomIdOrCode: string,
  user: { id: string; name: string; avatarColor?: string; chips?: number },
  password?: string
): { success: boolean; room?: PokerRoom; error?: string } {
  const rooms = getStoredRooms();
  const room = rooms.find(
    (r) => r.id === roomIdOrCode || r.code === roomIdOrCode.trim()
  );

  if (!room) {
    return { success: false, error: 'Không tìm thấy phòng với mã này! Vui lòng kiểm tra lại.' };
  }

  if (room.hasPassword && room.password) {
    if (!password || password.trim() !== room.password) {
      return { success: false, error: 'Mật khẩu phòng không chính xác!' };
    }
  }

  // Check if player is already inside
  const existingPlayerIndex = room.players.findIndex((p) => p.id === user.id);
  if (existingPlayerIndex >= 0) {
    return { success: true, room };
  }

  // Check capacity
  if (room.players.length >= room.maxPlayers) {
    return { success: false, error: 'Phòng đã đủ số lượng người chơi tối đa!' };
  }

  // Find next available seat index (0 to maxPlayers - 1)
  const occupiedSeats = new Set(room.players.map((p) => p.seatIdx));
  let seatIdx = 0;
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!occupiedSeats.has(i)) {
      seatIdx = i;
      break;
    }
  }

  const newPlayer: RoomPlayer = {
    id: user.id,
    name: user.name,
    avatarColor: user.avatarColor || '#3b82f6',
    chips: room.buyIn,
    isHost: false,
    isReady: false,
    seatIdx,
  };

  const updatedRoom: PokerRoom = {
    ...room,
    players: [...room.players, newPlayer],
    messages: [
      ...room.messages,
      {
        id: 'msg_join_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#3b82f6',
        text: `${user.name} đã tham gia vào phòng (Ghế số ${seatIdx + 1}).`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  const updatedRooms = rooms.map((r) => (r.id === room.id ? updatedRoom : r));
  saveRooms(updatedRooms);
  return { success: true, room: updatedRoom };
}

// Leave room
export function leaveRoom(roomId: string, playerId: string): void {
  const rooms = getStoredRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const leavingPlayer = room.players.find((p) => p.id === playerId);
  const remainingPlayers = room.players.filter((p) => p.id !== playerId);

  // If host leaves and there are other players, assign next player as host
  if (room.hostId === playerId) {
    if (remainingPlayers.length === 0) {
      // Delete room if empty
      saveRooms(rooms.filter((r) => r.id !== roomId));
      return;
    } else {
      remainingPlayers[0].isHost = true;
      room.hostId = remainingPlayers[0].id;
      room.hostName = remainingPlayers[0].name;
    }
  }

  const updatedRoom: PokerRoom = {
    ...room,
    players: remainingPlayers,
    messages: leavingPlayer
      ? [
          ...room.messages,
          {
            id: 'msg_leave_' + Date.now(),
            senderName: 'Hệ Thống',
            senderColor: '#94a3b8',
            text: `${leavingPlayer.name} đã rời phòng.`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ]
      : room.messages,
  };

  saveRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
}

// Add Bot to fill seats
const BOT_TEMPLATES = [
  { name: 'Kỳ Thủ Sài Gòn', color: '#10b981' },
  { name: 'Thần Bài Poker', color: '#8b5cf6' },
  { name: 'Vua Bluffing', color: '#ec4899' },
  { name: 'Cá Mập Poker', color: '#06b6d4' },
  { name: 'Tiểu Lý Phi Tiêu', color: '#f97316' },
];

export function addBotToRoom(roomId: string): PokerRoom | null {
  const rooms = getStoredRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.players.length >= room.maxPlayers) return null;

  const occupiedSeats = new Set(room.players.map((p) => p.seatIdx));
  let seatIdx = 0;
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!occupiedSeats.has(i)) {
      seatIdx = i;
      break;
    }
  }

  const existingBotNames = new Set(room.players.filter((p) => p.isBot).map((p) => p.name));
  const availableTemplate =
    BOT_TEMPLATES.find((b) => !existingBotNames.has(b.name)) ||
    BOT_TEMPLATES[Math.floor(Math.random() * BOT_TEMPLATES.length)];

  const botPlayer: RoomPlayer = {
    id: 'bot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: availableTemplate.name + ' (AI)',
    avatarColor: availableTemplate.color,
    chips: room.buyIn,
    isHost: false,
    isBot: true,
    isReady: true,
    seatIdx,
  };

  const updatedRoom: PokerRoom = {
    ...room,
    players: [...room.players, botPlayer],
    messages: [
      ...room.messages,
      {
        id: 'msg_bot_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#8b5cf6',
        text: `Đã thêm người chơi ${botPlayer.name} vào ghế ${seatIdx + 1}.`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Remove last added bot
export function removeBotFromRoom(roomId: string): PokerRoom | null {
  const rooms = getStoredRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const bots = room.players.filter((p) => p.isBot);
  if (bots.length === 0) return room;

  const botToRemove = bots[bots.length - 1];
  const updatedPlayers = room.players.filter((p) => p.id !== botToRemove.id);

  const updatedRoom: PokerRoom = {
    ...room,
    players: updatedPlayers,
    messages: [
      ...room.messages,
      {
        id: 'msg_bot_rem_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#94a3b8',
        text: `Đã mời ${botToRemove.name} rời phòng.`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Toggle Ready State
export function togglePlayerReady(roomId: string, playerId: string): PokerRoom | null {
  const rooms = getStoredRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const updatedPlayers = room.players.map((p) =>
    p.id === playerId ? { ...p, isReady: !p.isReady } : p
  );

  const updatedRoom: PokerRoom = {
    ...room,
    players: updatedPlayers,
  };

  saveRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Send chat message in room
export function sendRoomMessage(
  roomId: string,
  senderName: string,
  senderColor: string,
  text: string
): PokerRoom | null {
  const rooms = getStoredRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || !text.trim()) return null;

  const newMessage: RoomChatMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    senderName,
    senderColor,
    text: text.trim(),
    timestamp: Date.now(),
  };

  const updatedRoom: PokerRoom = {
    ...room,
    messages: [...room.messages.slice(-50), newMessage], // keep last 50 messages
  };

  saveRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Start game in room
export function startRoomGame(roomId: string): PokerRoom | null {
  const rooms = getStoredRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const updatedRoom: PokerRoom = {
    ...room,
    status: 'PLAYING',
    messages: [
      ...room.messages,
      {
        id: 'msg_start_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#eab308',
        text: 'Chủ phòng đã bắt đầu ván bài! Chúc các cơ thủ may mắn.',
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Subscribe to room updates across tabs
export function subscribeToRoomUpdates(callback: () => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === ROOMS_STORAGE_KEY) {
      callback();
    }
  };

  const handleMessage = () => {
    callback();
  };

  window.addEventListener('storage', handleStorage);
  if (roomChannel) {
    roomChannel.addEventListener('message', handleMessage);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (roomChannel) {
      roomChannel.removeEventListener('message', handleMessage);
    }
  };
}
