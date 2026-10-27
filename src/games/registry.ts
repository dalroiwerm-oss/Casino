/**
 * Game Registry for Multi-Game Portal
 * Easily extensible for adding new card and casino games.
 * Supports Admin dynamic status updates, title changes, and additions.
 */

export interface GameDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: 'cards' | 'casino' | 'lottery';
  categoryLabelVi: string;
  descriptionVi: string;
  playersCount: string;
  difficulty: 'Dễ' | 'Trung bình' | 'Cao';
  status: 'available' | 'coming_soon' | 'maintenance';
  badge?: string;
  icon: string;
  gradient: string;
  borderHover: string;
  accentColor: string;
  tags: string[];
}

export const INITIAL_GAMES_REGISTRY: GameDefinition[] = [
  {
    id: 'poker',
    title: 'Poker',
    subtitle: 'Texas Hold\'em Pro',
    category: 'cards',
    categoryLabelVi: 'Game Bài Chiến Thuật',
    descriptionVi: 'Đấu trí đỉnh cao cùng 5 đối thủ AI chuyên nghiệp với các vòng cược Preflop, Flop, Turn, River chuẩn casino quốc tế.',
    playersCount: '6 Người (1 Hero + 5 AI)',
    difficulty: 'Cao',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '♠',
    gradient: 'from-amber-950/60 via-slate-900 to-slate-950',
    borderHover: 'hover:border-amber-400 hover:shadow-amber-500/20',
    accentColor: '#f59e0b',
    tags: ['Texas Hold\'em', 'AI Đa Phong Cách', 'Live Equity', 'Cash & Tournament'],
  },
  {
    id: 'quayhu',
    title: 'Quay Hũ',
    subtitle: 'Nổ Hũ Thần Tài Jackpot',
    category: 'casino',
    categoryLabelVi: 'Quay Hũ Slots',
    descriptionVi: 'Trò chơi nổ hũ slots may mắn với các dòng cược thắng lớn, biểu tượng Wild/Scatter và giải độc đắc Jackpot tiền tỷ.',
    playersCount: 'Chơi Đơn',
    difficulty: 'Dễ',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '🎰',
    gradient: 'from-yellow-950/60 via-slate-900 to-slate-950',
    borderHover: 'hover:border-yellow-400 hover:shadow-yellow-500/20',
    accentColor: '#eab308',
    tags: ['Slots 777', 'Nổ Hũ', 'Mega Jackpot', 'Vòng Quay May Mắn'],
  },
  {
    id: 'caoveso',
    title: 'Cào Vé Số',
    subtitle: 'Thẻ Cào May Mắn',
    category: 'lottery',
    categoryLabelVi: 'Vé Số & Thẻ Cào',
    descriptionVi: 'Trải nghiệm cảm giác hồi hộp khi tự tay cào từng ô số trên tấm vé vàng để săn giải thưởng tức thì với tỉ lệ trúng hấp dẫn.',
    playersCount: 'Chơi Đơn',
    difficulty: 'Dễ',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '🎟️',
    gradient: 'from-orange-950/60 via-slate-900 to-slate-950',
    borderHover: 'hover:border-orange-400 hover:shadow-orange-500/20',
    accentColor: '#f97316',
    tags: ['Cào Tức Thì', 'Vé Vàng', 'Giải Thưởng Lớn', 'Dễ Chơi'],
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    subtitle: 'Xì Dách 21 Điểm',
    category: 'cards',
    categoryLabelVi: 'Casino Kinh Điển',
    descriptionVi: 'Trò chơi 21 điểm huyền thoại đối đầu trực tiếp cùng Dealer nhà cái với các lựa chọn Rút (Hit), Dằn (Stand), Tách (Split), Gấp đôi (Double).',
    playersCount: '1 vs Dealer',
    difficulty: 'Trung bình',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '♦',
    gradient: 'from-blue-950/60 via-slate-900 to-slate-950',
    borderHover: 'hover:border-blue-400 hover:shadow-blue-500/20',
    accentColor: '#3b82f6',
    tags: ['Xì Dách', '21 Điểm', 'Double Down', 'Bảo hiểm'],
  },
  {
    id: 'tienlen',
    title: 'Tiến Lên',
    subtitle: 'Tiến Lên Miền Nam',
    category: 'cards',
    categoryLabelVi: 'Truyền Thống Dân Gian',
    descriptionVi: 'Game bài quốc dân Việt Nam với luật chặt Heo, 3 đôi thông, 4 đôi thông, Tứ quý chặn đôi 2 kịch tính.',
    playersCount: '4 Người Chơi',
    difficulty: 'Trung bình',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '♥',
    gradient: 'from-rose-950/60 via-slate-900 to-slate-950',
    borderHover: 'hover:border-rose-400 hover:shadow-rose-500/20',
    accentColor: '#f43f5e',
    tags: ['Tiến Lên', 'Chặt Heo', 'Tứ Quý', '3 Đôi Thông'],
  },
  {
    id: 'roulette',
    title: 'Roulette',
    subtitle: 'Vòng Quay May Mắn',
    category: 'casino',
    categoryLabelVi: 'Vòng Quay Casino',
    descriptionVi: 'Vòng quay Châu Âu 37 số (0-36) với đa dạng kiểu cược: Đỏ/Đen, Chẵn/Lẻ, Cột, Hàng, Đơn số.',
    playersCount: 'Nhiều Cược',
    difficulty: 'Dễ',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '🎡',
    gradient: 'from-amber-900/40 via-slate-900 to-slate-950',
    borderHover: 'hover:border-amber-400 hover:shadow-amber-500/20',
    accentColor: '#eab308',
    tags: ['37 Số', 'Cược Đỏ Đen', 'Chẵn Lẻ', 'Tỉ lệ 1:35'],
  },
  {
    id: 'loto',
    title: 'Lô Tô',
    subtitle: 'Chế Độ Phòng - Giải Thưởng Cộng Dồn',
    category: 'lottery',
    categoryLabelVi: 'Phòng Nhiều Người',
    descriptionVi: 'Trò chơi Lô Tô 90 số chế độ phòng nhiều người. Giải thưởng tích lũy bằng toàn bộ số tiền người chơi mua vé, tối thiểu 2 người không giới hạn số lượng tham gia. Animation quay số hiện đại chuyên nghiệp.',
    playersCount: 'Tối thiểu 2 người (Không giới hạn)',
    difficulty: 'Dễ',
    status: 'available',
    badge: 'ĐANG MỞ',
    icon: '🎯',
    gradient: 'from-fuchsia-950/60 via-slate-900 to-slate-950',
    borderHover: 'hover:border-fuchsia-400 hover:shadow-fuchsia-500/20',
    accentColor: '#d946ef',
    tags: ['Lô Tô 90 Số', 'Chế Độ Phòng', 'Giải Thưởng Cộng Dồn', 'Báo Kinh'],
  },
];

export const GAMES_REGISTRY = INITIAL_GAMES_REGISTRY;

const STORAGE_CUSTOM_GAMES = 'poker_hub_custom_games_list';

export function loadCurrentGames(): GameDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_GAMES);
    if (!raw) return INITIAL_GAMES_REGISTRY;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingIds = new Set(parsed.map((g: GameDefinition) => g.id));
      const mapped = parsed.map((g: GameDefinition) => {
        const initial = INITIAL_GAMES_REGISTRY.find((ig) => ig.id === g.id);
        if (initial && g.status === 'coming_soon') {
          return { ...g, status: 'available' as const, badge: 'ĐANG MỞ' };
        }
        return g;
      });

      // Append any new built-in games that are not in localStorage
      for (const initGame of INITIAL_GAMES_REGISTRY) {
        if (!existingIds.has(initGame.id)) {
          mapped.push(initGame);
        }
      }
      return mapped;
    }
    return INITIAL_GAMES_REGISTRY;
  } catch {
    return INITIAL_GAMES_REGISTRY;
  }
}

export function saveCurrentGames(games: GameDefinition[]): void {
  try {
    localStorage.setItem(STORAGE_CUSTOM_GAMES, JSON.stringify(games));
  } catch {
    // ignore
  }
}

export function resetDefaultGames(): GameDefinition[] {
  try {
    localStorage.removeItem(STORAGE_CUSTOM_GAMES);
  } catch {
    // ignore
  }
  return INITIAL_GAMES_REGISTRY;
}
