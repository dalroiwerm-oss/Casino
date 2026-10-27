/**
 * Authentication and User Role Management
 * Supports Player Name Quick-Registration, Profile Details, Stats, and Central Server API Sync.
 */

export interface UserProfile {
  id: string;
  name: string;
  chips: number;
  avatarColor: string;
  isAdmin: boolean;
  role: 'player' | 'admin';
  createdAt: string;
  lastDailyReward?: string;
  handsPlayed?: number;
  handsWon?: number;
  biggestPotWon?: number;
  bestHandNameVi?: string;
  tournamentTrophies?: number;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  lastActive?: number;
  isOnline?: boolean;
}

const STORAGE_KEY_USER = 'poker_hub_user_profile';
const STORAGE_KEY_SYSTEM_SETTINGS = 'poker_hub_system_settings';

export interface SystemSettings {
  defaultStartingChips: number;
  maintenanceMode: boolean;
  allowGuestRebuy: boolean;
  maxRaiseMultiplier: number;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  defaultStartingChips: 2500,
  maintenanceMode: false,
  allowGuestRebuy: true,
  maxRaiseMultiplier: 10,
};

export function detectCurrentDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua) || (width >= 640 && width <= 1024)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua) || width < 640) {
    return 'mobile';
  }
  return 'desktop';
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const id = parsed.id || 'usr_' + (parsed.name || 'player').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return {
      id,
      handsPlayed: 0,
      handsWon: 0,
      biggestPotWon: 0,
      bestHandNameVi: 'Chưa có',
      tournamentTrophies: 0,
      deviceType: detectCurrentDeviceType(),
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function saveUser(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// SERVER-SIDE MULTI-DEVICE PLAYERS API
// ---------------------------------------------------------------------------

export interface ServerPlayersResponse {
  success: boolean;
  players: UserProfile[];
  totalCount: number;
  onlineCount: number;
  totalChips: number;
  error?: string;
}

/**
 * Fetch all registered player accounts across all devices from central server
 */
export async function fetchServerPlayers(): Promise<ServerPlayersResponse> {
  try {
    const res = await fetch('/api/players');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Could not fetch server players, using local fallback:', err);
    const local = getStoredUser();
    const fallbackList = local ? [local] : [];
    return {
      success: false,
      players: fallbackList,
      totalCount: fallbackList.length,
      onlineCount: fallbackList.length,
      totalChips: fallbackList.reduce((s, p) => s + p.chips, 0),
      error: String(err),
    };
  }
}

/**
 * Register or sync current user with central server so Admin can see them
 */
export async function syncUserWithServer(profile: UserProfile): Promise<UserProfile> {
  saveUser(profile);
  try {
    const res = await fetch('/api/players/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...profile,
        deviceType: profile.deviceType || detectCurrentDeviceType(),
        stats: {
          handsPlayed: profile.handsPlayed,
          handsWon: profile.handsWon,
          biggestPotWon: profile.biggestPotWon,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.player) {
        const merged: UserProfile = {
          ...profile,
          ...data.player,
        };
        saveUser(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Server sync failed, retained local storage:', err);
  }
  return profile;
}

/**
 * Periodic heartbeat ping to tell server this device is currently online
 * Also receives any chips top-up granted by Admin!
 */
export async function pingPlayerHeartbeat(
  playerId: string,
  currentChips: number
): Promise<{ serverChips: number; updated: boolean } | null> {
  try {
    const res = await fetch('/api/players/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: playerId,
        chips: currentChips,
        deviceType: detectCurrentDeviceType(),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.player) {
        return {
          serverChips: data.player.chips,
          updated: data.player.chips !== currentChips,
        };
      }
    }
  } catch {
    // silent failure
  }
  return null;
}

/**
 * Admin action: give chips to a specific player on any device
 */
export async function adminGivePlayerChips(
  playerId: string,
  amount: number,
  mode: 'add' | 'set' = 'add'
): Promise<{ success: boolean; player?: UserProfile; message?: string }> {
  try {
    const res = await fetch('/api/admin/give-chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, amount, mode }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, message: 'Lỗi kết nối máy chủ: ' + String(err) };
  }
}

/**
 * Admin action: delete player account
 */
export async function adminDeletePlayer(playerId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/players/${encodeURIComponent(playerId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Admin action: add a simulated test player
 */
export async function adminAddTestPlayer(): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/admin/add-test-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.success) return data.player;
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// DAILY REWARD & SYSTEM SETTINGS
// ---------------------------------------------------------------------------

export function claimDailyReward(user: UserProfile): {
  success: boolean;
  reward: number;
  updatedUser: UserProfile;
  message: string;
} {
  const today = new Date().toDateString();
  if (user.lastDailyReward === today) {
    return {
      success: false,
      reward: 0,
      updatedUser: user,
      message: 'Bạn đã nhận quà điểm danh hôm nay rồi. Hãy quay lại vào ngày mai nhé!',
    };
  }

  const reward = 1000;
  const updatedUser: UserProfile = {
    ...user,
    chips: user.chips + reward,
    lastDailyReward: today,
  };

  saveUser(updatedUser);
  syncUserWithServer(updatedUser);

  return {
    success: true,
    reward,
    updatedUser,
    message: `Chúc mừng! Bạn đã nhận thành công +$${reward.toLocaleString()} chip điểm danh hàng ngày!`,
  };
}

export function getStoredSystemSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYSTEM_SETTINGS);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export function saveSystemSettings(settings: SystemSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SYSTEM_SETTINGS, JSON.stringify(settings));
    fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Checks Admin credentials
 * Admin username: admin, password: admin2112
 */
export function verifyAdminCredentials(user: string, pass: string): boolean {
  const trimmedUser = user.trim().toLowerCase();
  const trimmedPass = pass.trim();
  return trimmedUser === 'admin' && trimmedPass === 'admin2112';
}
