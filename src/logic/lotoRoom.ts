/**
 * Room Management & Multiplayer State Synchronization for Lô Tô
 * Pure human multiplayer, dynamic cumulative prize pool: Prize = ticketPrice * players.length
 * Real-time cross-tab sync via BroadcastChannel and localStorage.
 */

import { UserProfile } from './auth';

export interface LotoCell {
  id: string;
  value: number | null; // null represents blank space in 3x9 grid
  marked: boolean;
}

export type LotoRow = LotoCell[];
export type LotoBoard = LotoRow[]; // exactly 3 rows, 9 cols, 5 numbers per row (15 total)

export interface LotoTicket {
  id: string;
  name: string;
  colorTheme: 'cyan' | 'amber' | 'rose' | 'emerald' | 'purple';
  board: LotoBoard;
}

export interface LotoRoomPlayer {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isReady: boolean;
  ticket: LotoTicket;
  joinedAt: number;
}

export interface LotoChatMessage {
  id: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface LotoRoom {
  id: string;
  code: string; // 6-digit code e.g. "729481"
  name: string;
  hostId: string;
  hostName: string;
  ticketPrice: number; // e.g. 50, 100, 200, 500
  turnTimeSeconds: number; // drawing interval per ball in seconds (e.g. 3s, 5s, 8s, 10s)
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: LotoRoomPlayer[];
  drawSequence: number[]; // 1 to 90 shuffled authoritative sequence
  currentBallIndex: number; // -1 if not started, 0..89 as balls are drawn
  winnerId?: string;
  winnerName?: string;
  winningNumbers?: number[];
  winningPot?: number;
  createdAt: number;
  startedAt?: number;
  messages: LotoChatMessage[];
}

const LOTO_ROOMS_KEY = 'LOTO_ROOMS_STORE_V3';

// Cross-tab broadcast channel for instant synchronization
let lotoChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    lotoChannel = new BroadcastChannel('loto_room_sync_v3');
  }
} catch {
  lotoChannel = null;
}

// Generate 6-digit room code
export function generateLotoRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate authentic Vietnamese 3x9 Lô Tô ticket board (5 numbers per row, 15 numbers total)
export function generateLotoTicket(id: string, name: string, colorTheme: LotoTicket['colorTheme'] = 'amber'): LotoTicket {
  const colRanges: [number, number][] = [
    [1, 9],
    [10, 19],
    [20, 29],
    [30, 39],
    [40, 49],
    [50, 59],
    [60, 69],
    [70, 79],
    [80, 90],
  ];

  let rowColPicks: number[][] = [[], [], []];
  let validDistribution = false;

  while (!validDistribution) {
    rowColPicks = [[], [], []];
    const colCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let r = 0; r < 3; r++) {
      const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
      const chosen = cols.slice(0, 5).sort((a, b) => a - b);
      rowColPicks[r] = chosen;
      chosen.forEach((c) => colCounts[c]++);
    }

    if (colCounts.every((cnt) => cnt >= 1 && cnt <= 3)) {
      validDistribution = true;
    }
  }

  const colNumbers: number[][] = [];
  for (let c = 0; c < 9; c++) {
    const [min, max] = colRanges[c];
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let needed = 0;
    for (let r = 0; r < 3; r++) {
      if (rowColPicks[r].includes(c)) needed++;
    }

    const picked = pool.slice(0, needed).sort((a, b) => a - b);
    colNumbers.push(picked);
  }

  const colCounters = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const board: LotoBoard = [];

  for (let r = 0; r < 3; r++) {
    const row: LotoRow = [];
    for (let c = 0; c < 9; c++) {
      if (rowColPicks[r].includes(c)) {
        const val = colNumbers[c][colCounters[c]++];
        row.push({
          id: `${id}_r${r}_c${c}_${val}`,
          value: val,
          marked: false,
        });
      } else {
        row.push({
          id: `${id}_r${r}_c${c}_blank`,
          value: null,
          marked: false,
        });
      }
    }
    board.push(row);
  }

  return { id, name, colorTheme, board };
}

// Generate shuffled 1 to 90 array
export function generateDrawSequence(): number[] {
  const nums: number[] = [];
  for (let i = 1; i <= 90; i++) nums.push(i);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

// Check if any row of 5 numbers is marked
export function checkWinningTicketRow(ticket: LotoTicket): number[] | null {
  for (const row of ticket.board) {
    const numbersInRow = row.filter((cell) => cell.value !== null);
    if (numbersInRow.length === 5 && numbersInRow.every((cell) => cell.marked)) {
      return numbersInRow.map((cell) => cell.value as number);
    }
  }
  return null;
}

// Retrieve stored rooms (only real player-created rooms)
export function getStoredLotoRooms(): LotoRoom[] {
  try {
    // Clean up any legacy test room store
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('LOTO_ROOMS_STORE_V2');
      } catch {
        // ignore
      }
    }
    const raw = localStorage.getItem(LOTO_ROOMS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: LotoRoom[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ensure no leftover mock/seed rooms exist
    return parsed.filter(
      (r) =>
        r.id !== 'loto_room_vip_100' &&
        r.id !== 'loto_room_casual_50' &&
        r.code !== '888888' &&
        r.code !== '686868'
    );
  } catch {
    return [];
  }
}

// Save rooms to storage and broadcast
export function saveLotoRooms(rooms: LotoRoom[]): void {
  try {
    localStorage.setItem(LOTO_ROOMS_KEY, JSON.stringify(rooms));
    if (lotoChannel) {
      lotoChannel.postMessage({ type: 'LOTO_ROOMS_SYNC', timestamp: Date.now() });
    }
  } catch (e) {
    console.error('Failed to save loto rooms', e);
  }
}

// Find room by code
export function findLotoRoomByCode(code: string): LotoRoom | undefined {
  const cleaned = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  const rooms = getStoredLotoRooms();
  return rooms.find((r) => r.code === cleaned);
}

// Find room by ID
export function getLotoRoomById(roomId: string): LotoRoom | undefined {
  const rooms = getStoredLotoRooms();
  return rooms.find((r) => r.id === roomId);
}

// Create new Lô Tô room
export function createLotoRoom(params: {
  name: string;
  ticketPrice: number;
  turnTimeSeconds?: number;
  hostUser: UserProfile;
}): LotoRoom {
  const rooms = getStoredLotoRooms();
  let code = generateLotoRoomCode();
  while (rooms.some((r) => r.code === code)) {
    code = generateLotoRoomCode();
  }

  const roomId = 'loto_room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const hostTicket = generateLotoTicket(`ticket_host_${Date.now()}`, `Vé của ${params.hostUser.name}`, 'amber');

  const hostPlayer: LotoRoomPlayer = {
    id: params.hostUser.id,
    name: params.hostUser.name,
    avatarColor: params.hostUser.avatarColor || '#f59e0b',
    isHost: true,
    isReady: true,
    ticket: hostTicket,
    joinedAt: Date.now(),
  };

  const turnTime = params.turnTimeSeconds && params.turnTimeSeconds >= 2 ? params.turnTimeSeconds : 5;

  const newRoom: LotoRoom = {
    id: roomId,
    code,
    name: params.name.trim() || `Phòng Lô Tô của ${params.hostUser.name}`,
    hostId: params.hostUser.id,
    hostName: params.hostUser.name,
    ticketPrice: Math.max(10, params.ticketPrice),
    turnTimeSeconds: turnTime,
    status: 'WAITING',
    players: [hostPlayer],
    drawSequence: generateDrawSequence(),
    currentBallIndex: -1,
    createdAt: Date.now(),
    messages: [
      {
        id: 'msg_created_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#10b981',
        text: `Phòng tạo thành công! Mã phòng [${code}]. Vé $${params.ticketPrice} · Xổ ${turnTime}s/số. Càng nhiều người vào giải thưởng càng cộng dồn!`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  const updated = [newRoom, ...rooms.filter((r) => r.id !== roomId)];
  saveLotoRooms(updated);
  return newRoom;
}

// Join existing room
export function joinLotoRoom(
  roomIdOrCode: string,
  user: UserProfile
): { success: boolean; room?: LotoRoom; error?: string } {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomIdOrCode || r.code === roomIdOrCode.trim());

  if (!room) {
    return { success: false, error: 'Không tìm thấy phòng Lô Tô với mã này!' };
  }

  if (room.status === 'PLAYING') {
    return { success: false, error: 'Phòng này đang quay số dở rồi, vui lòng chờ ván kết thúc hoặc chọn phòng khác!' };
  }

  // Check if player is already inside
  const existingPlayer = room.players.find((p) => p.id === user.id);
  if (existingPlayer) {
    return { success: true, room };
  }

  // Create authentic ticket for joining player
  const themes: LotoTicket['colorTheme'][] = ['cyan', 'rose', 'emerald', 'purple', 'amber'];
  const chosenTheme = themes[room.players.length % themes.length];
  const playerTicket = generateLotoTicket(
    `ticket_${user.id}_${Date.now()}`,
    `Vé ${user.name}`,
    chosenTheme
  );

  const newPlayer: LotoRoomPlayer = {
    id: user.id,
    name: user.name,
    avatarColor: user.avatarColor || '#3b82f6',
    isHost: false,
    isReady: true,
    ticket: playerTicket,
    joinedAt: Date.now(),
  };

  const totalPot = (room.players.length + 1) * room.ticketPrice;

  const updatedRoom: LotoRoom = {
    ...room,
    players: [...room.players, newPlayer],
    messages: [
      ...room.messages,
      {
        id: 'msg_join_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#3b82f6',
        text: `${user.name} đã mua vé vào phòng! Giải thưởng tăng lên: $${totalPot.toLocaleString()}!`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  const updatedRooms = rooms.map((r) => (r.id === room.id ? updatedRoom : r));
  saveLotoRooms(updatedRooms);
  return { success: true, room: updatedRoom };
}

// Add a test simulated human player to room (helps testing prize accumulation easily)
export function addTestPlayerToLotoRoom(roomId: string): LotoRoom | null {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.status === 'PLAYING') return null;

  const names = ['Thành Nam', 'Hoàng Bách', 'Mỹ Duyên', 'Quốc Bảo', 'Bích Ngọc', 'Tuấn Khang', 'Hồng Vân', 'Kim Ngân'];
  const existingNames = new Set(room.players.map((p) => p.name));
  const candidateName = names.find((n) => !existingNames.has(n)) || `Người Chơi #${room.players.length + 1}`;

  const colors = ['#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#3b82f6'];
  const chosenColor = colors[room.players.length % colors.length];

  const themes: LotoTicket['colorTheme'][] = ['cyan', 'emerald', 'purple', 'rose', 'amber'];
  const chosenTheme = themes[room.players.length % themes.length];

  const newTicket = generateLotoTicket(`ticket_sim_${Date.now()}`, `Vé ${candidateName}`, chosenTheme);

  const newPlayer: LotoRoomPlayer = {
    id: 'user_sim_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    name: candidateName,
    avatarColor: chosenColor,
    isHost: false,
    isReady: true,
    ticket: newTicket,
    joinedAt: Date.now(),
  };

  const totalPot = (room.players.length + 1) * room.ticketPrice;

  const updatedRoom: LotoRoom = {
    ...room,
    players: [...room.players, newPlayer],
    messages: [
      ...room.messages,
      {
        id: 'msg_sim_join_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#06b6d4',
        text: `${candidateName} vừa mua vé vào phòng! Giải thưởng cộng dồn: $${totalPot.toLocaleString()}!`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Leave room
export function leaveLotoRoom(roomId: string, userId: string): void {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const remaining = room.players.filter((p) => p.id !== userId);
  const leavingPlayer = room.players.find((p) => p.id === userId);

  if (remaining.length === 0) {
    saveLotoRooms(rooms.filter((r) => r.id !== roomId));
    return;
  }

  // If host leaves, assign next player as host
  if (room.hostId === userId) {
    remaining[0].isHost = true;
    room.hostId = remaining[0].id;
    room.hostName = remaining[0].name;
  }

  const updatedRoom: LotoRoom = {
    ...room,
    players: remaining,
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

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
}

// Start Lô Tô round in room
export function startLotoGame(roomId: string): LotoRoom | null {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.players.length < 2) return null;

  const totalPot = room.ticketPrice * room.players.length;

  const updatedRoom: LotoRoom = {
    ...room,
    status: 'PLAYING',
    drawSequence: generateDrawSequence(),
    currentBallIndex: 0, // First ball is ready
    winnerId: undefined,
    winnerName: undefined,
    winningNumbers: undefined,
    winningPot: totalPot,
    startedAt: Date.now(),
    messages: [
      ...room.messages,
      {
        id: 'msg_start_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#eab308',
        text: `BẮT ĐẦU QUAY SỐ! Tổng giải thưởng Độc Đắc: $${totalPot.toLocaleString()} (${room.players.length} người tham gia). Chúc mọi người may mắn!`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Next ball drawn in room
export function nextLotoBall(roomId: string): LotoRoom | null {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.status !== 'PLAYING') return null;

  if (room.currentBallIndex >= 89) {
    // All 90 balls drawn
    return room;
  }

  const nextIndex = room.currentBallIndex + 1;
  const drawnBall = room.drawSequence[nextIndex];

  // Auto-mark drawn numbers for simulated test players so the user can test multiplayer dynamics
  const updatedPlayers = room.players.map((p) => {
    if (p.id.startsWith('user_sim_') || p.id.startsWith('bot_')) {
      const updatedBoard = p.ticket.board.map((row) =>
        row.map((cell) => {
          if (cell.value === drawnBall) {
            return { ...cell, marked: true };
          }
          return cell;
        })
      );
      return {
        ...p,
        ticket: { ...p.ticket, board: updatedBoard },
      };
    }
    return p;
  });

  const updatedRoom: LotoRoom = {
    ...room,
    players: updatedPlayers,
    currentBallIndex: nextIndex,
    messages: [
      ...room.messages.slice(-40),
      {
        id: 'msg_ball_' + nextIndex + '_' + Date.now(),
        senderName: 'Lồng Cầu',
        senderColor: '#38bdf8',
        text: `Quay ra số [${drawnBall}]! (Số thứ ${nextIndex + 1}/90)`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Claim "BÁO KINH!"
export function claimLotoKinh(
  roomId: string,
  userId: string,
  winningNumbers: number[]
): { valid: boolean; room?: LotoRoom; error?: string } {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.status !== 'PLAYING') {
    return { valid: false, error: 'Phòng không ở trạng thái đang quay số.' };
  }

  const player = room.players.find((p) => p.id === userId);
  if (!player) {
    return { valid: false, error: 'Bạn không có trong phòng này.' };
  }

  // Validate winning numbers: must be exactly 5 numbers, all drawn so far
  const drawnSoFar = new Set(room.drawSequence.slice(0, room.currentBallIndex + 1));
  const allDrawn = winningNumbers.length === 5 && winningNumbers.every((n) => drawnSoFar.has(n));

  if (!allDrawn) {
    return {
      valid: false,
      error: 'Hàng số chưa đủ 5 số đã xổ! Hãy kiểm tra lại vé.',
    };
  }

  const totalPot = room.ticketPrice * room.players.length;

  const updatedRoom: LotoRoom = {
    ...room,
    status: 'FINISHED',
    winnerId: player.id,
    winnerName: player.name,
    winningNumbers,
    winningPot: totalPot,
    messages: [
      ...room.messages,
      {
        id: 'msg_win_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#f59e0b',
        text: `🎉 KINH RỒI! ${player.name} đã BÁO KINH thành công hàng 5 số [${winningNumbers.join(', ')}] và ẵm trọn giải thưởng $${totalPot.toLocaleString()}!`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return { valid: true, room: updatedRoom };
}

// Reset room for a new round
export function resetLotoRoomForNewRound(roomId: string): LotoRoom | null {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  // Generate fresh tickets for all remaining players
  const themes: LotoTicket['colorTheme'][] = ['amber', 'cyan', 'rose', 'emerald', 'purple'];
  const updatedPlayers = room.players.map((p, idx) => ({
    ...p,
    ticket: generateLotoTicket(`ticket_${p.id}_${Date.now()}`, `Vé ${p.name}`, themes[idx % themes.length]),
  }));

  const updatedRoom: LotoRoom = {
    ...room,
    status: 'WAITING',
    players: updatedPlayers,
    drawSequence: generateDrawSequence(),
    currentBallIndex: -1,
    winnerId: undefined,
    winnerName: undefined,
    winningNumbers: undefined,
    winningPot: undefined,
    messages: [
      ...room.messages,
      {
        id: 'msg_reset_' + Date.now(),
        senderName: 'Hệ Thống',
        senderColor: '#10b981',
        text: 'Ván mới đã sẵn sàng! Đã phát vé mới cho tất cả người chơi.',
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Send chat message
export function sendLotoRoomMessage(
  roomId: string,
  senderName: string,
  senderColor: string,
  text: string
): LotoRoom | null {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room || !text.trim()) return null;

  const newMessage: LotoChatMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    senderName,
    senderColor,
    text: text.trim(),
    timestamp: Date.now(),
  };

  const updatedRoom: LotoRoom = {
    ...room,
    messages: [...room.messages.slice(-50), newMessage],
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Update player's marked cell on their ticket
export function updatePlayerTicketMark(
  roomId: string,
  userId: string,
  rowIdx: number,
  cellIdx: number
): LotoRoom | null {
  const rooms = getStoredLotoRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const playerIdx = room.players.findIndex((p) => p.id === userId);
  if (playerIdx === -1) return null;

  const player = room.players[playerIdx];
  const board = player.ticket.board.map((row, r) =>
    r === rowIdx
      ? row.map((cell, c) => (c === cellIdx ? { ...cell, marked: !cell.marked } : cell))
      : row
  );

  const updatedPlayer = {
    ...player,
    ticket: {
      ...player.ticket,
      board,
    },
  };

  const updatedPlayers = [...room.players];
  updatedPlayers[playerIdx] = updatedPlayer;

  const updatedRoom: LotoRoom = {
    ...room,
    players: updatedPlayers,
  };

  saveLotoRooms(rooms.map((r) => (r.id === room.id ? updatedRoom : r)));
  return updatedRoom;
}

// Subscribe to room updates
export function subscribeToLotoRoomUpdates(callback: () => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === LOTO_ROOMS_KEY) {
      callback();
    }
  };

  const handleMessage = () => {
    callback();
  };

  window.addEventListener('storage', handleStorage);
  if (lotoChannel) {
    lotoChannel.addEventListener('message', handleMessage);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (lotoChannel) {
      lotoChannel.removeEventListener('message', handleMessage);
    }
  };
}
