import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Persistent Player Store
interface ServerPlayer {
  id: string;
  name: string;
  chips: number;
  avatarColor: string;
  isAdmin: boolean;
  role: 'player' | 'admin';
  createdAt: string;
  lastActive: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  lastIp?: string;
  handsPlayed?: number;
  handsWon?: number;
  biggestPotWon?: number;
}

const DATA_DIR = path.resolve(__dirname, 'data');
const PLAYERS_FILE = path.resolve(DATA_DIR, 'players.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadPlayers(): ServerPlayer[] {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const raw = fs.readFileSync(PLAYERS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error loading players:', err);
  }

  // Initial seed players representing other active devices
  const initialPlayers: ServerPlayer[] = [
    {
      id: 'usr_mobile_demo_1',
      name: 'Tài Khoản iPhone (Demo)',
      chips: 25000,
      avatarColor: '#10b981',
      isAdmin: false,
      role: 'player',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      lastActive: Date.now() - 1000 * 30, // 30 seconds ago
      deviceType: 'mobile',
      handsPlayed: 14,
      handsWon: 6,
      biggestPotWon: 12000,
    },
    {
      id: 'usr_tablet_demo_2',
      name: 'Khách iPad Air (Demo)',
      chips: 50000,
      avatarColor: '#3b82f6',
      isAdmin: false,
      role: 'player',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      lastActive: Date.now() - 1000 * 120, // 2 minutes ago
      deviceType: 'tablet',
      handsPlayed: 32,
      handsWon: 15,
      biggestPotWon: 35000,
    },
  ];
  savePlayers(initialPlayers);
  return initialPlayers;
}

function savePlayers(players: ServerPlayer[]) {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving players:', err);
  }
}

// System settings
interface SystemSettings {
  defaultStartingChips: number;
  maintenanceMode: boolean;
  allowGuestRebuy: boolean;
  maxRaiseMultiplier: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  defaultStartingChips: 2500,
  maintenanceMode: false,
  allowGuestRebuy: true,
  maxRaiseMultiplier: 10,
};

function loadSettings(): SystemSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: SystemSettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// In-memory cache synced with disk
let playersCache = loadPlayers();
let settingsCache = loadSettings();

// Helper to determine device type from User-Agent
function detectDeviceType(userAgent?: string): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) return 'mobile';
  return 'desktop';
}

// API: Get all registered players across all devices
app.get('/api/players', (_req: Request, res: Response) => {
  const now = Date.now();
  const sorted = [...playersCache].map((p) => ({
    ...p,
    // Considered online if active within last 3 minutes
    isOnline: now - p.lastActive < 180000,
  })).sort((a, b) => b.lastActive - a.lastActive);

  res.json({
    success: true,
    players: sorted,
    totalCount: sorted.length,
    onlineCount: sorted.filter((p) => p.isOnline).length,
    totalChips: sorted.reduce((sum, p) => sum + p.chips, 0),
  });
});

// API: Register or update player from any device
app.post('/api/players/register', (req: Request, res: Response) => {
  const { id, name, chips, avatarColor, role, isAdmin, deviceType, stats } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Tên người chơi không được để trống' });
  }

  const cleanName = name.trim();
  const playerId = id || 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const clientDevice = deviceType || detectDeviceType(req.headers['user-agent']);
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

  const existingIdx = playersCache.findIndex((p) => p.id === playerId || p.name.toLowerCase() === cleanName.toLowerCase());

  if (existingIdx >= 0) {
    // Keep server chips if admin previously updated them, unless client reports win/loss update
    const current = playersCache[existingIdx];
    const updated: ServerPlayer = {
      ...current,
      name: cleanName,
      avatarColor: avatarColor || current.avatarColor,
      role: role || current.role,
      isAdmin: isAdmin !== undefined ? isAdmin : current.isAdmin,
      deviceType: clientDevice,
      lastActive: Date.now(),
      lastIp: clientIp,
      chips: chips !== undefined ? chips : current.chips,
      handsPlayed: stats?.handsPlayed ?? current.handsPlayed,
      handsWon: stats?.handsWon ?? current.handsWon,
      biggestPotWon: stats?.biggestPotWon ?? current.biggestPotWon,
    };
    playersCache[existingIdx] = updated;
    savePlayers(playersCache);
    return res.json({ success: true, player: updated, isNew: false });
  }

  const newPlayer: ServerPlayer = {
    id: playerId,
    name: cleanName,
    chips: chips !== undefined ? chips : settingsCache.defaultStartingChips,
    avatarColor: avatarColor || '#f59e0b',
    isAdmin: Boolean(isAdmin),
    role: role || (isAdmin ? 'admin' : 'player'),
    createdAt: new Date().toISOString(),
    lastActive: Date.now(),
    deviceType: clientDevice,
    lastIp: clientIp,
    handsPlayed: stats?.handsPlayed || 0,
    handsWon: stats?.handsWon || 0,
    biggestPotWon: stats?.biggestPotWon || 0,
  };

  playersCache.push(newPlayer);
  savePlayers(playersCache);
  return res.json({ success: true, player: newPlayer, isNew: true });
});

// API: Heartbeat ping to keep device active and sync latest chips from server
app.post('/api/players/heartbeat', (req: Request, res: Response) => {
  const { id, chips, deviceType } = req.body;
  if (!id) return res.status(400).json({ success: false, error: 'Thiếu id người chơi' });

  const idx = playersCache.findIndex((p) => p.id === id);
  if (idx >= 0) {
    playersCache[idx].lastActive = Date.now();
    if (deviceType) playersCache[idx].deviceType = deviceType;
    // If client provided updated chips from playing, store it
    if (chips !== undefined && typeof chips === 'number') {
      playersCache[idx].chips = chips;
    }
    savePlayers(playersCache);
    return res.json({ success: true, player: playersCache[idx] });
  }

  return res.json({ success: false, error: 'Không tìm thấy người chơi' });
});

// API: Admin gives chips to a specific player
app.post('/api/admin/give-chips', (req: Request, res: Response) => {
  const { playerId, amount, mode } = req.body;
  if (!playerId) {
    return res.status(400).json({ success: false, error: 'Thiếu ID người chơi' });
  }

  const idx = playersCache.findIndex((p) => p.id === playerId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản người chơi này' });
  }

  const player = playersCache[idx];
  const numAmount = Number(amount) || 0;

  if (mode === 'set') {
    player.chips = Math.max(0, numAmount);
  } else {
    player.chips = Math.max(0, player.chips + numAmount);
  }

  player.lastActive = Date.now();
  playersCache[idx] = player;
  savePlayers(playersCache);

  return res.json({
    success: true,
    player,
    message: `Đã cấp thành công $${numAmount.toLocaleString()} chip cho [${player.name}]!`,
  });
});

// API: Admin deletes an account
app.delete('/api/admin/players/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLen = playersCache.length;
  playersCache = playersCache.filter((p) => p.id !== id);

  if (playersCache.length < initialLen) {
    savePlayers(playersCache);
    return res.json({ success: true, message: 'Đã xóa tài khoản người chơi thành công' });
  }
  return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản cần xóa' });
});

// API: Admin creates a simulated test player
app.post('/api/admin/add-test-player', (req: Request, res: Response) => {
  const names = ['Tuấn Poker (iPhone)', 'Hùng Shark (Android)', 'Linh VIP (iPad)', 'Bảo Châu (Laptop)', 'Minh Đức (Xiaomi)'];
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];
  const devices: ('mobile' | 'tablet' | 'desktop')[] = ['mobile', 'tablet', 'desktop', 'mobile', 'mobile'];

  const randIdx = Math.floor(Math.random() * names.length);
  const testId = 'usr_test_' + Date.now().toString(36);
  const testPlayer: ServerPlayer = {
    id: testId,
    name: `${names[randIdx]} #${Math.floor(10 + Math.random() * 90)}`,
    chips: 10000 + Math.floor(Math.random() * 50000),
    avatarColor: colors[randIdx % colors.length],
    isAdmin: false,
    role: 'player',
    createdAt: new Date().toISOString(),
    lastActive: Date.now(),
    deviceType: devices[randIdx % devices.length],
    handsPlayed: Math.floor(5 + Math.random() * 30),
    handsWon: Math.floor(1 + Math.random() * 15),
    biggestPotWon: Math.floor(5000 + Math.random() * 20000),
  };

  playersCache.unshift(testPlayer);
  savePlayers(playersCache);

  return res.json({ success: true, player: testPlayer });
});

// API: System settings
app.get('/api/system/settings', (_req: Request, res: Response) => {
  res.json({ success: true, settings: settingsCache });
});

app.post('/api/system/settings', (req: Request, res: Response) => {
  settingsCache = { ...settingsCache, ...req.body };
  saveSettings(settingsCache);
  // ==========================================
// Central Online Rooms & Real-Time Sync API
// ==========================================
interface ServerRoom {
  id: string;
  game: 'tienlen' | 'poker' | 'loto';
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  maxPlayers: number;
  stake?: number;
  smallBlind?: number;
  bigBlind?: number;
  buyIn?: number;
  turnTimeSeconds?: number;
  ticketPrice?: number;
  hasPassword?: boolean;
  password?: string;
  players: any[];
  extraData?: any;
  createdAt: number;
  lastActive: number;
}

interface ServerGameEvent {
  id: string;
  roomId: string;
  type: string;
  senderId: string;
  senderName: string;
  payload: any;
  timestamp: number;
}

const ROOMS_FILE = path.resolve(DATA_DIR, 'rooms.json');

function loadRooms(): ServerRoom[] {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error loading rooms:', err);
  }
  return [];
}

function saveRooms(rooms: ServerRoom[]) {
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving rooms:', err);
  }
}

let roomsCache: ServerRoom[] = loadRooms();
const roomEventsMap: Map<string, ServerGameEvent[]> = new Map();

// Periodic cleanup of rooms older than 2 hours
setInterval(() => {
  const now = Date.now();
  const valid = roomsCache.filter((r) => now - r.lastActive < 7200000);
  if (valid.length !== roomsCache.length) {
    roomsCache = valid;
    saveRooms(roomsCache);
  }
}, 60000);

// API: Get active rooms by game
app.get('/api/rooms', (req: Request, res: Response) => {
  const { game } = req.query;
  const now = Date.now();
  let filtered = roomsCache.filter((r) => now - r.lastActive < 3600000);
  if (game && typeof game === 'string') {
    filtered = filtered.filter((r) => r.game === game);
  }
  // Sort most recently active first
  filtered.sort((a, b) => b.lastActive - a.lastActive);
  res.json({ success: true, rooms: filtered });
});

// API: Get room by ID or 6-digit Code
app.get('/api/rooms/get', (req: Request, res: Response) => {
  const query = ((req.query.query as string) || '').trim().toUpperCase();
  if (!query) {
    return res.status(400).json({ success: false, error: 'Thiếu mã hoặc ID phòng' });
  }
  const room = roomsCache.find((r) => r.id === query || r.code === query);
  if (room) {
    return res.json({ success: true, room });
  }
  return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
});

// API: Create or update room on server
app.post('/api/rooms', (req: Request, res: Response) => {
  const incoming = req.body as Partial<ServerRoom>;
  if (!incoming.code || !incoming.name || !incoming.game) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin phòng' });
  }

  const existingIdx = roomsCache.findIndex(
    (r) => (incoming.id && r.id === incoming.id) || r.code === incoming.code
  );

  const fullRoom: ServerRoom = {
    id: incoming.id || 'room_' + Date.now().toString(36),
    game: incoming.game,
    code: incoming.code.trim().toUpperCase(),
    name: incoming.name.trim(),
    hostId: incoming.hostId || 'host',
    hostName: incoming.hostName || 'Chủ phòng',
    status: incoming.status || 'WAITING',
    maxPlayers: incoming.maxPlayers || 4,
    stake: incoming.stake,
    smallBlind: incoming.smallBlind,
    bigBlind: incoming.bigBlind,
    buyIn: incoming.buyIn,
    turnTimeSeconds: incoming.turnTimeSeconds || 20,
    ticketPrice: incoming.ticketPrice,
    hasPassword: Boolean(incoming.password && incoming.password.trim()),
    password: incoming.password ? incoming.password.trim() : undefined,
    players: Array.isArray(incoming.players) ? incoming.players : [],
    extraData: incoming.extraData || null,
    createdAt: incoming.createdAt || Date.now(),
    lastActive: Date.now(),
  };

  if (existingIdx >= 0) {
    roomsCache[existingIdx] = fullRoom;
  } else {
    roomsCache.unshift(fullRoom);
  }

  saveRooms(roomsCache);
  return res.json({ success: true, room: fullRoom });
});

// API: Join room on server
app.post('/api/rooms/join', (req: Request, res: Response) => {
  const { codeOrId, player, password } = req.body;
  if (!codeOrId || !player) {
    return res.status(400).json({ success: false, error: 'Thiếu mã phòng hoặc người chơi' });
  }

  const cleanQuery = codeOrId.trim().toUpperCase();
  const roomIdx = roomsCache.findIndex((r) => r.code === cleanQuery || r.id === cleanQuery);

  if (roomIdx === -1) {
    return res.status(440).json({ success: false, error: 'Không tìm thấy phòng với mã này trên máy chủ' });
  }

  const room = roomsCache[roomIdx];

  // Password check
  if (room.hasPassword && room.password) {
    if (!password || password.trim() !== room.password) {
      return res.status(403).json({ success: false, error: 'Mật khẩu phòng không đúng!' });
    }
  }

  // Already in room check
  const alreadyIn = room.players.find((p) => p.id === player.id);
  if (alreadyIn) {
    room.lastActive = Date.now();
    return res.json({ success: true, room });
  }

  // Capacity check
  const maxP = room.maxPlayers || 4;
  if (room.players.length >= maxP) {
    return res.status(400).json({ success: false, error: `Phòng đã đủ số lượng tối đa (${maxP} người)` });
  }

  // Assign seat index
  const occupiedSeats = new Set(room.players.map((p) => p.seatIdx ?? p.seatIndex ?? 0));
  let seatIdx = 0;
  for (let i = 0; i < maxP; i++) {
    if (!occupiedSeats.has(i)) {
      seatIdx = i;
      break;
    }
  }

  const newPlayerObj = {
    ...player,
    seatIdx,
    isHost: false,
    isReady: true,
  };

  room.players.push(newPlayerObj);
  room.lastActive = Date.now();
  roomsCache[roomIdx] = room;
  saveRooms(roomsCache);

  return res.json({ success: true, room });
});

// API: Update room status (e.g. Host clicks Start Game)
app.post('/api/rooms/status', (req: Request, res: Response) => {
  const { roomId, status } = req.body;
  if (!roomId || !status) {
    return res.status(400).json({ success: false, error: 'Thiếu roomId hoặc status' });
  }

  const roomIdx = roomsCache.findIndex((r) => r.id === roomId || r.code === roomId);
  if (roomIdx >= 0) {
    roomsCache[roomIdx].status = status;
    roomsCache[roomIdx].lastActive = Date.now();
    saveRooms(roomsCache);
    return res.json({ success: true, room: roomsCache[roomIdx] });
  }
  return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
});

// API: Post real-time in-game event (cards played, passes, ball draws, victory)
app.post('/api/rooms/event', (req: Request, res: Response) => {
  const { roomId, type, senderId, senderName, payload, timestamp } = req.body;
  if (!roomId || !type) {
    return res.status(400).json({ success: false, error: 'Thiếu dữ liệu sự kiện' });
  }

  const event: ServerGameEvent = {
    id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
    roomId,
    type,
    senderId: senderId || 'anon',
    senderName: senderName || 'Player',
    payload: payload || {},
    timestamp: timestamp || Date.now(),
  };

  const list = roomEventsMap.get(roomId) || [];
  list.push(event);
  if (list.length > 200) list.shift(); // keep last 200 events per room
  roomEventsMap.set(roomId, list);

  // Touch room lastActive
  const rIdx = roomsCache.findIndex((r) => r.id === roomId);
  if (rIdx >= 0) roomsCache[rIdx].lastActive = Date.now();

  return res.json({ success: true, event });
});

// API: Poll in-game events since timestamp
app.get('/api/rooms/events', (req: Request, res: Response) => {
  const roomId = req.query.roomId as string;
  const since = Number(req.query.since) || 0;

  if (!roomId) {
    return res.status(400).json({ success: false, error: 'Thiếu roomId' });
  }

  const list = roomEventsMap.get(roomId) || [];
  const events = list.filter((e) => e.timestamp > since);
  return res.json({ success: true, events });
});

// Mount Vite in dev or static files in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Full-Stack Game Hub Server] Running at http://0.0.0.0:${PORT} (isProd: ${isProd})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
