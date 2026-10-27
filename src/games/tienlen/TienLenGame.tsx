import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../../logic/audio';
import { Card, Suit, Rank, RANK_LABELS } from '../../logic/poker';
import { CardView } from '../../components/CardView';
import { UserProfile } from '../../logic/auth';
import { TienLenRoom } from '../../components/TienLenRoomModal';
import { useDeviceMode } from '../../logic/device';
import { DeviceModeSelector } from '../../components/DeviceModeSelector';
import { networkManager, NetworkPacket } from '../../logic/network';
import { onlineHub } from '../../logic/onlineHub';

interface TienLenGameProps {
  currentUser: UserProfile | null;
  onUpdateChips: (newChips: number, wonAmount: number) => void;
  onExit: () => void;
  onRequireRegister: () => void;
  roomConfig?: TienLenRoom | null;
}

// Tien Len Rank Value: 3 is lowest (3), 2 is highest (15)
export function getTienLenRankValue(rank: Rank): number {
  if (rank === 2) return 15;
  return rank;
}

// Tien Len Suit Value: Spades (1) < Clubs (2) < Diamonds (3) < Hearts (4)
export function getTienLenSuitValue(suit: Suit): number {
  switch (suit) {
    case 'spades': return 1;
    case 'clubs': return 2;
    case 'diamonds': return 3;
    case 'hearts': return 4;
  }
}

// Compare two single cards in Tien Len
export function compareTienLenCards(a: Card, b: Card): number {
  const rankDiff = getTienLenRankValue(a.rank) - getTienLenRankValue(b.rank);
  if (rankDiff !== 0) return rankDiff;
  return getTienLenSuitValue(a.suit) - getTienLenSuitValue(b.suit);
}

// Combination Types
export type ComboType =
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'STRAIGHT'
  | 'FOUR_OF_A_KIND'
  | 'THREE_PAIRS_SEQ'
  | 'FOUR_PAIRS_SEQ'
  | 'INVALID';

export interface EvaluatedPlay {
  type: ComboType;
  cards: Card[];
  highestCard: Card;
  length: number;
}

export function getTienLenPlayNameVi(play: EvaluatedPlay): string {
  if (play.type === 'SINGLE') {
    const isHeo = play.highestCard.rank === 2;
    return isHeo ? 'Lá Heo (2)' : `Lá ${RANK_LABELS[play.highestCard.rank]}`;
  }
  if (play.type === 'PAIR') {
    const isHeo = play.highestCard.rank === 2;
    return isHeo ? 'Đôi Heo (2)' : `Đôi ${RANK_LABELS[play.highestCard.rank]}`;
  }
  if (play.type === 'TRIPLE') {
    return `Sám ${RANK_LABELS[play.highestCard.rank]}`;
  }
  if (play.type === 'FOUR_OF_A_KIND') {
    return `TỨ QUÝ ${RANK_LABELS[play.highestCard.rank]}!`;
  }
  if (play.type === 'STRAIGHT') {
    return `Sảnh ${play.length} lá (tới ${RANK_LABELS[play.highestCard.rank]})`;
  }
  if (play.type === 'THREE_PAIRS_SEQ') {
    return `3 ĐÔI THÔNG!`;
  }
  if (play.type === 'FOUR_PAIRS_SEQ') {
    return `4 ĐÔI THÔNG!`;
  }
  return 'Bài không hợp lệ';
}

// Evaluate a set of selected cards
export function evaluateTienLenPlay(cards: Card[]): EvaluatedPlay {
  if (cards.length === 0) {
    return { type: 'INVALID', cards: [], highestCard: cards[0], length: 0 };
  }

  const sorted = [...cards].sort(compareTienLenCards);
  const highest = sorted[sorted.length - 1];
  const count = sorted.length;

  // Single
  if (count === 1) {
    return { type: 'SINGLE', cards: sorted, highestCard: highest, length: 1 };
  }

  // Pair
  if (count === 2 && sorted[0].rank === sorted[1].rank) {
    return { type: 'PAIR', cards: sorted, highestCard: highest, length: 2 };
  }

  // Triple
  if (count === 3 && sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
    return { type: 'TRIPLE', cards: sorted, highestCard: highest, length: 3 };
  }

  // Four of a kind (Tứ quý)
  if (count === 4 && sorted.every((c) => c.rank === sorted[0].rank)) {
    return { type: 'FOUR_OF_A_KIND', cards: sorted, highestCard: highest, length: 4 };
  }

  // Check Straight (Sảnh: >= 3 cards, consecutive ranks, NO 2 allowed)
  if (count >= 3 && sorted.every((c) => c.rank !== 2)) {
    let isStraight = true;
    for (let i = 0; i < count - 1; i++) {
      if (getTienLenRankValue(sorted[i + 1].rank) - getTienLenRankValue(sorted[i].rank) !== 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) {
      return { type: 'STRAIGHT', cards: sorted, highestCard: highest, length: count };
    }
  }

  // Check 3 consecutive pairs (3 đôi thông: 6 cards)
  if (count === 6 && sorted.every((c) => c.rank !== 2)) {
    if (
      sorted[0].rank === sorted[1].rank &&
      sorted[2].rank === sorted[3].rank &&
      sorted[4].rank === sorted[5].rank &&
      getTienLenRankValue(sorted[2].rank) - getTienLenRankValue(sorted[0].rank) === 1 &&
      getTienLenRankValue(sorted[4].rank) - getTienLenRankValue(sorted[2].rank) === 1
    ) {
      return { type: 'THREE_PAIRS_SEQ', cards: sorted, highestCard: highest, length: 6 };
    }
  }

  // Check 4 consecutive pairs (4 đôi thông: 8 cards)
  if (count === 8 && sorted.every((c) => c.rank !== 2)) {
    if (
      sorted[0].rank === sorted[1].rank &&
      sorted[2].rank === sorted[3].rank &&
      sorted[4].rank === sorted[5].rank &&
      sorted[6].rank === sorted[7].rank &&
      getTienLenRankValue(sorted[2].rank) - getTienLenRankValue(sorted[0].rank) === 1 &&
      getTienLenRankValue(sorted[4].rank) - getTienLenRankValue(sorted[2].rank) === 1 &&
      getTienLenRankValue(sorted[6].rank) - getTienLenRankValue(sorted[4].rank) === 1
    ) {
      return { type: 'FOUR_PAIRS_SEQ', cards: sorted, highestCard: highest, length: 8 };
    }
  }

  return { type: 'INVALID', cards: sorted, highestCard: highest, length: count };
}

// Check if Play A can beat Play B
export function canBeatTienLen(prevPlay: EvaluatedPlay | null, newPlay: EvaluatedPlay): boolean {
  if (newPlay.type === 'INVALID') return false;
  if (!prevPlay) return true; // Leading trick can play any valid combo

  // Chặt Heo logic
  const isTargetHeo = prevPlay.type === 'SINGLE' && prevPlay.highestCard.rank === 2;
  const isTargetPairHeo = prevPlay.type === 'PAIR' && prevPlay.highestCard.rank === 2;

  // 3 đôi thông chặt được 1 Heo hoặc 3 đôi thông nhỏ hơn
  if (newPlay.type === 'THREE_PAIRS_SEQ') {
    if (isTargetHeo) return true;
    if (prevPlay.type === 'THREE_PAIRS_SEQ') {
      return compareTienLenCards(newPlay.highestCard, prevPlay.highestCard) > 0;
    }
  }

  // Tứ quý chặt được 1 Heo, đôi Heo, 3 đôi thông, hoặc tứ quý nhỏ hơn
  if (newPlay.type === 'FOUR_OF_A_KIND') {
    if (isTargetHeo || isTargetPairHeo || prevPlay.type === 'THREE_PAIRS_SEQ') return true;
    if (prevPlay.type === 'FOUR_OF_A_KIND') {
      return compareTienLenCards(newPlay.highestCard, prevPlay.highestCard) > 0;
    }
  }

  // 4 đôi thông chặt được 1 Heo, đôi Heo, 3 Heo, Tứ quý, 3 đôi thông, hoặc 4 đôi thông nhỏ hơn
  if (newPlay.type === 'FOUR_PAIRS_SEQ') {
    if (isTargetHeo || isTargetPairHeo || prevPlay.type === 'FOUR_OF_A_KIND' || prevPlay.type === 'THREE_PAIRS_SEQ') {
      return true;
    }
    if (prevPlay.type === 'FOUR_PAIRS_SEQ') {
      return compareTienLenCards(newPlay.highestCard, prevPlay.highestCard) > 0;
    }
  }

  // Standard same-type matching
  if (prevPlay.type === newPlay.type) {
    if (prevPlay.type === 'STRAIGHT') {
      if (prevPlay.length !== newPlay.length) return false;
    }
    return compareTienLenCards(newPlay.highestCard, prevPlay.highestCard) > 0;
  }

  return false;
}

// Find smart suggestion combo for player
export function findSmartHintPlay(handCards: Card[], prevPlay: EvaluatedPlay | null): Card[] | null {
  const sorted = [...handCards].sort(compareTienLenCards);

  if (!prevPlay) {
    const threeSpades = sorted.find((c) => c.rank === 3 && c.suit === 'spades');
    if (threeSpades) return [threeSpades];
    if (sorted.length >= 2 && sorted[0].rank === sorted[1].rank) {
      return [sorted[0], sorted[1]];
    }
    return [sorted[0]];
  }

  // Beat Single
  if (prevPlay.type === 'SINGLE') {
    for (const c of sorted) {
      const play = evaluateTienLenPlay([c]);
      if (canBeatTienLen(prevPlay, play)) return [c];
    }
    if (prevPlay.highestCard.rank === 2) {
      for (let i = 0; i <= sorted.length - 4; i++) {
        if (sorted[i].rank === sorted[i + 3].rank) {
          return [sorted[i], sorted[i + 1], sorted[i + 2], sorted[i + 3]];
        }
      }
    }
  }

  // Beat Pair
  if (prevPlay.type === 'PAIR') {
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].rank === sorted[i + 1].rank) {
        const play = evaluateTienLenPlay([sorted[i], sorted[i + 1]]);
        if (canBeatTienLen(prevPlay, play)) return [sorted[i], sorted[i + 1]];
      }
    }
    if (prevPlay.highestCard.rank === 2) {
      for (let i = 0; i <= sorted.length - 4; i++) {
        if (sorted[i].rank === sorted[i + 3].rank) {
          return [sorted[i], sorted[i + 1], sorted[i + 2], sorted[i + 3]];
        }
      }
    }
  }

  // Beat Triple
  if (prevPlay.type === 'TRIPLE') {
    for (let i = 0; i < sorted.length - 2; i++) {
      if (sorted[i].rank === sorted[i + 1].rank && sorted[i + 1].rank === sorted[i + 2].rank) {
        const play = evaluateTienLenPlay([sorted[i], sorted[i + 1], sorted[i + 2]]);
        if (canBeatTienLen(prevPlay, play)) return [sorted[i], sorted[i + 1], sorted[i + 2]];
      }
    }
  }

  // Beat Straight (Sảnh)
  if (prevPlay.type === 'STRAIGHT') {
    const targetLen = prevPlay.length;
    const nonHeo = sorted.filter((c) => c.rank !== 2);
    const rankMap: { [key: number]: Card[] } = {};
    for (const c of nonHeo) {
      if (!rankMap[c.rank]) rankMap[c.rank] = [];
      rankMap[c.rank].push(c);
    }
    const uniqueRanks = Object.keys(rankMap).map(Number).sort((a, b) => getTienLenRankValue(a as Rank) - getTienLenRankValue(b as Rank));

    for (let i = 0; i <= uniqueRanks.length - targetLen; i++) {
      let isConsecutive = true;
      for (let j = 0; j < targetLen - 1; j++) {
        if (getTienLenRankValue(uniqueRanks[i + j + 1] as Rank) - getTienLenRankValue(uniqueRanks[i + j] as Rank) !== 1) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) {
        const candidateCards: Card[] = [];
        for (let j = 0; j < targetLen; j++) {
          const r = uniqueRanks[i + j];
          const cardsOfRank = rankMap[r];
          candidateCards.push(cardsOfRank[cardsOfRank.length - 1]);
        }
        const candidatePlay = evaluateTienLenPlay(candidateCards);
        if (canBeatTienLen(prevPlay, candidatePlay)) {
          return candidateCards;
        }
      }
    }
  }

  return null;
}

export interface PlayerSeat {
  id: string;
  name: string;
  avatarColor: string;
  isHuman: boolean;
  isBot?: boolean;
  cards: Card[];
  passed: boolean;
  rankFinished?: number;
}

export const TienLenGame: React.FC<TienLenGameProps> = ({
  currentUser,
  onUpdateChips,
  onExit,
  onRequireRegister,
  roomConfig,
}) => {
  const { isMobile, isTablet, isDesktop } = useDeviceMode();
  const [chips, setChips] = useState<number>(currentUser?.chips || 2500);
  const [stake, setStake] = useState<number>(roomConfig ? roomConfig.stake : 100);
  const [gameState, setGameState] = useState<'IDLE' | 'DEALING' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [lastPlay, setLastPlay] = useState<{ playerIdx: number; play: EvaluatedPlay; angle: number } | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [specialEffectText, setSpecialEffectText] = useState<string | null>(null);
  const turnTimeLimit = roomConfig?.turnTimeSeconds || 20;
  const [timerSeconds, setTimerSeconds] = useState<number>(turnTimeLimit);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Mobile Hand Arrangement Mode: 'auto_fan' (1 hàng tự co giãn) vs 'two_rows' (2 tầng xếp chồng)
  const [mobileLayoutMode, setMobileLayoutMode] = useState<'auto_fan' | 'two_rows'>('auto_fan');

  // Initialize players dynamically (Solo practice = 4 players with bots; Room mode = ONLY players who joined room!)
  const [players, setPlayers] = useState<PlayerSeat[]>(() => {
    if (roomConfig && roomConfig.players && roomConfig.players.length > 0) {
      const heroInRoom =
        roomConfig.players.find((p) => p.id === currentUser?.id || p.name === currentUser?.name) ||
        roomConfig.players[0];
      const otherPlayers = roomConfig.players.filter((p) => p.id !== heroInRoom.id);
      const seat0: PlayerSeat = {
        id: heroInRoom.id,
        name: heroInRoom.name,
        avatarColor: heroInRoom.avatarColor || currentUser?.avatarColor || '#f43f5e',
        isHuman: true,
        isBot: false,
        cards: [],
        passed: false,
      };
      const result: PlayerSeat[] = [seat0];
      // Only include players who actually joined this room — NO auto-fill bots for 2-player rooms!
      otherPlayers.forEach((p) => {
        result.push({
          id: p.id,
          name: p.name,
          avatarColor: p.avatarColor || '#3b82f6',
          isHuman: false,
          isBot: Boolean(p.isBot),
          cards: [],
          passed: false,
        });
      });
      return result;
    }
    return [
      { id: 'hero', name: currentUser?.name || 'Bạn', avatarColor: currentUser?.avatarColor || '#f43f5e', isHuman: true, isBot: false, cards: [], passed: false },
      { id: 'bot1', name: 'Đông Hải (AI)', avatarColor: '#10b981', isHuman: false, isBot: true, cards: [], passed: false },
      { id: 'bot2', name: 'Nam Phong (AI)', avatarColor: '#3b82f6', isHuman: false, isBot: true, cards: [], passed: false },
      { id: 'bot3', name: 'Tây Sơn (AI)', avatarColor: '#8b5cf6', isHuman: false, isBot: true, cards: [], passed: false },
    ];
  });

  const [gameAnnouncement, setGameAnnouncement] = useState<string>('');

  // Sync user chips
  useEffect(() => {
    if (currentUser?.chips !== undefined) {
      setChips(currentUser.chips);
    }
  }, [currentUser?.chips]);

  // Trigger special popup effect
  const triggerSpecialBanner = (text: string) => {
    setSpecialEffectText(text);
    sounds.playAllIn();
    setTimeout(() => {
      setSpecialEffectText(null);
    }, 2400);
  };

  // Start new game
  const startNewTienLen = () => {
    if (!currentUser) {
      onRequireRegister();
      return;
    }
    if (chips < stake * 2) {
      alert('Không đủ chip để tham gia ván đấu!');
      return;
    }

    setGameState('DEALING');
    setGameAnnouncement('Đang xáo và chia bài...');

    // Create 52-card deck
    const suits: Suit[] = ['spades', 'clubs', 'diamonds', 'hearts'];
    const ranks: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2];
    const deck: Card[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: `${rank}_${suit}`, rank, suit });
      }
    }

    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const numPlayers = players.length;
    const hands: Card[][] = [];
    for (let i = 0; i < numPlayers; i++) {
      hands.push(deck.slice(i * 13, (i + 1) * 13).sort(compareTienLenCards));
    }

    // Find starting player: whoever holds 3 Bích (3 Spades)
    let startingPlayer = 0;
    let found3Bich = false;
    for (let i = 0; i < numPlayers; i++) {
      if (hands[i].some((c) => c.rank === 3 && c.suit === 'spades')) {
        startingPlayer = i;
        found3Bich = true;
        break;
      }
    }

    // In 2-player or 3-player game, 3 Bích might be in the unused cards.
    // If not found, player with lowest card in hand goes first!
    if (!found3Bich) {
      let lowestCard: Card | null = null;
      for (let i = 0; i < numPlayers; i++) {
        const firstCard = hands[i][0];
        if (!lowestCard || compareTienLenCards(firstCard, lowestCard) < 0) {
          lowestCard = firstCard;
          startingPlayer = i;
        }
      }
    }

    sounds.playCardDeal();

    setTimeout(() => {
      setPlayers((prev) =>
        prev.map((p, idx) => ({
          ...p,
          cards: hands[idx] || [],
          passed: false,
        }))
      );
      setLastPlay(null);
      setSelectedCardIds(new Set());
      setCurrentTurnIdx(startingPlayer);
      setGameState('PLAYING');
      sounds.playChips();
      setGameAnnouncement(
        startingPlayer === 0
          ? 'Lượt của bạn! Bạn đánh trước'
          : `Lượt của ${players[startingPlayer]?.name || 'Đối thủ'} đánh đầu tiên`
      );

      if (roomConfig && currentUser && roomConfig.hostId === currentUser.id) {
        networkManager.broadcast('TL_REMOTE_DEAL', currentUser, {
          hands,
          startingPlayer,
          playerCount: numPlayers,
        });
        onlineHub.sendGameEvent(roomConfig.id, 'TL_REMOTE_DEAL', currentUser, {
          hands,
          startingPlayer,
          playerCount: numPlayers,
        });
      }
    }, 800);
  };

  // Auto-start deal if host enters room game, or notify host if member enters
  useEffect(() => {
    if (roomConfig) {
      if (currentUser?.id === roomConfig.hostId) {
        startNewTienLen();
      } else {
        // Announce to host that member is ready in game
        networkManager.broadcast('TL_MEMBER_READY_IN_GAME', currentUser || { id: 'member', name: 'Khách' }, {});
      }
    }
  }, []);

  // Listen to remote P2P WebRTC actions
  useEffect(() => {
    if (!roomConfig) return;
    const unsub = networkManager.onPacket((packet: NetworkPacket) => {
      if (packet.type === 'TL_MEMBER_READY_IN_GAME') {
        if (currentUser?.id === roomConfig.hostId) {
          // Re-send deal packet so joined member syncs immediately without getting stuck in IDLE
          if (players[0].cards.length > 0) {
            networkManager.broadcast('TL_REMOTE_DEAL', currentUser, {
              hands: players.map((p) => p.cards),
              startingPlayer: currentTurnIdx,
              playerCount: players.length,
            });
          }
        }
      } else if (packet.type === 'TL_REMOTE_DEAL') {
        if (currentUser?.id !== roomConfig.hostId) {
          const { hands, startingPlayer } = packet.payload;
          sounds.playCardDeal();
          const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
          const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 1;
          const numP = players.length;

          const mappedHands: Card[][] = [];
          for (let i = 0; i < numP; i++) {
            const originalSeat = (effectiveMySeat + i) % numP;
            mappedHands.push(hands[originalSeat] || []);
          }

          setPlayers((prev) =>
            prev.map((p, idx) => ({
              ...p,
              cards: mappedHands[idx] || [],
              passed: false,
            }))
          );
          setLastPlay(null);
          setSelectedCardIds(new Set());
          const relativeStarting = (startingPlayer - effectiveMySeat + numP) % numP;
          setCurrentTurnIdx(relativeStarting);
          setGameState('PLAYING');
          sounds.playChips();
        }
      } else if (packet.type === 'TL_REMOTE_PLAY') {
        if (packet.senderId !== currentUser?.id) {
          const senderInRoom = roomConfig.players.find((p) => p.id === packet.senderId);
          const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
          const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 0;
          const senderIdx = senderInRoom ? roomConfig.players.findIndex((p) => p.id === senderInRoom.id) : 1;
          const numP = players.length;
          const relativeSeat = (senderIdx - effectiveMySeat + numP) % numP;
          executePlayerPlay(relativeSeat, packet.payload.play);
        }
      } else if (packet.type === 'TL_REMOTE_PASS') {
        if (packet.senderId !== currentUser?.id) {
          const senderInRoom = roomConfig.players.find((p) => p.id === packet.senderId);
          const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
          const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 0;
          const senderIdx = senderInRoom ? roomConfig.players.findIndex((p) => p.id === senderInRoom.id) : 1;
          const numP = players.length;
          const relativeSeat = (senderIdx - effectiveMySeat + numP) % numP;
          executePlayerPass(relativeSeat);
        }
      }
    });

    return () => unsub();
  }, [roomConfig, currentUser, players, currentTurnIdx]);

  // Dual-channel server event polling for Tien Len
  const lastTlEventTimeRef = useRef<number>(Date.now() - 10000);
  const processedTlEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!roomConfig) return;
    const interval = setInterval(async () => {
      try {
        const events = await onlineHub.getGameEvents(roomConfig.id, lastTlEventTimeRef.current);
        if (!events || events.length === 0) return;

        for (const ev of events) {
          if (processedTlEventIdsRef.current.has(ev.id)) continue;
          processedTlEventIdsRef.current.add(ev.id);
          if (ev.timestamp > lastTlEventTimeRef.current) {
            lastTlEventTimeRef.current = ev.timestamp;
          }

          if (ev.type === 'TL_REMOTE_DEAL' && currentUser?.id !== roomConfig.hostId) {
            const { hands, startingPlayer } = ev.payload;
            sounds.playCardDeal();
            const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
            const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 1;
            const numP = players.length;

            const mappedHands: Card[][] = [];
            for (let i = 0; i < numP; i++) {
              const originalSeat = (effectiveMySeat + i) % numP;
              mappedHands.push(hands[originalSeat] || []);
            }

            setPlayers((prev) =>
              prev.map((p, idx) => ({
                ...p,
                cards: mappedHands[idx] || [],
                passed: false,
              }))
            );
            setLastPlay(null);
            setSelectedCardIds(new Set());
            const relativeStarting = (startingPlayer - effectiveMySeat + numP) % numP;
            setCurrentTurnIdx(relativeStarting);
            setGameState('PLAYING');
            sounds.playChips();
          } else if (ev.type === 'TL_REMOTE_PLAY' && ev.senderId !== currentUser?.id) {
            const senderInRoom = roomConfig.players.find((p) => p.id === ev.senderId);
            const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
            const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 0;
            const senderIdx = senderInRoom ? roomConfig.players.findIndex((p) => p.id === senderInRoom.id) : 1;
            const numP = players.length;
            const relativeSeat = (senderIdx - effectiveMySeat + numP) % numP;
            executePlayerPlay(relativeSeat, ev.payload.play);
          } else if (ev.type === 'TL_REMOTE_PASS' && ev.senderId !== currentUser?.id) {
            const senderInRoom = roomConfig.players.find((p) => p.id === ev.senderId);
            const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
            const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 0;
            const senderIdx = senderInRoom ? roomConfig.players.findIndex((p) => p.id === senderInRoom.id) : 1;
            const numP = players.length;
            const relativeSeat = (senderIdx - effectiveMySeat + numP) % numP;
            executePlayerPass(relativeSeat);
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [roomConfig, currentUser, players]);

  // Smooth Card Gesture & Drag-Select State
  const isPointerDownRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragModeRef = useRef<'add' | 'remove'>('add');
  const lastToggledCardIdRef = useRef<string | null>(null);
  const lastTapRef = useRef<{ cardId: string; time: number }>({ cardId: '', time: 0 });
  const [isSwipingUp, setIsSwipingUp] = useState<boolean>(false);
  const [swipeOffsetUp, setSwipeOffsetUp] = useState<number>(0);
  const [sortMode, setSortMode] = useState<'rank' | 'suit'>('rank');

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isPointerDownRef.current = false;
      lastToggledCardIdRef.current = null;
      setIsSwipingUp(false);
      setSwipeOffsetUp(0);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  const handlePointerDownCard = (card: Card, e: React.PointerEvent) => {
    e.stopPropagation();
    isPointerDownRef.current = true;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    lastToggledCardIdRef.current = card.id;

    // Double-tap / fast double-click detection (desktop and touch)
    const now = Date.now();
    const isDouble = now - lastTapRef.current.time < 320 && lastTapRef.current.cardId === card.id;
    lastTapRef.current = { cardId: card.id, time: now };

    if (isDouble) {
      handleDoubleClickCard(card);
      isPointerDownRef.current = false;
      return;
    }

    // Toggle card selection
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(card.id)) {
        next.delete(card.id);
        dragModeRef.current = 'remove';
      } else {
        next.add(card.id);
        dragModeRef.current = 'add';
      }
      return next;
    });
    sounds.playCardLift();
  };

  const handlePointerMoveContainer = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;

    const deltaY = pointerStartPosRef.current.y - e.clientY;
    const deltaX = Math.abs(pointerStartPosRef.current.x - e.clientX);

    // Upward Swipe gesture (Vuốt lên để Đánh bài)
    if (deltaY > 22 && deltaY > deltaX * 0.7) {
      setIsSwipingUp(true);
      setSwipeOffsetUp(Math.min(deltaY, 50));
      return;
    } else {
      if (isSwipingUp) {
        setIsSwipingUp(false);
        setSwipeOffsetUp(0);
      }
    }

    // Horizontal multi-card swipe selection (Works on both touch and mouse)
    const elem = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-card-id]') as HTMLElement | null;
    if (elem) {
      const cardId = elem.getAttribute('data-card-id');
      if (cardId && cardId !== lastToggledCardIdRef.current) {
        lastToggledCardIdRef.current = cardId;
        sounds.playCardLift();
        setSelectedCardIds((prev) => {
          const next = new Set(prev);
          if (dragModeRef.current === 'add') {
            next.add(cardId);
          } else {
            next.delete(cardId);
          }
          return next;
        });
      }
    }
  };

  const handlePointerUpContainer = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const deltaY = pointerStartPosRef.current.y - e.clientY;
    isPointerDownRef.current = false;
    lastToggledCardIdRef.current = null;
    setIsSwipingUp(false);
    setSwipeOffsetUp(0);

    // If swiped up and selection is valid to beat, play cards immediately!
    if (deltaY > 40 && canPlaySelected) {
      handleHeroPlayCards();
    }
  };

  const handleDoubleClickCard = (card: Card) => {
    sounds.playChips();
    const matchingCards = players[0].cards.filter((c) => c.rank === card.rank);
    if (matchingCards.length > 1) {
      // If full set already selected, deselect; otherwise select all cards of this rank
      const allSelected = matchingCards.every((c) => selectedCardIds.has(c.id));
      if (allSelected) {
        setSelectedCardIds((prev) => {
          const next = new Set(prev);
          matchingCards.forEach((c) => next.delete(c.id));
          return next;
        });
      } else {
        setSelectedCardIds((prev) => {
          const next = new Set(prev);
          matchingCards.forEach((c) => next.add(c.id));
          return next;
        });
      }
    } else {
      setSelectedCardIds(new Set([card.id]));
    }
  };

  // Quick helper: select next pair in hand
  const handleSelectNextPair = () => {
    sounds.playChips();
    const cards = players[0].cards;
    const rankMap: { [key: number]: Card[] } = {};
    for (const c of cards) {
      if (!rankMap[c.rank]) rankMap[c.rank] = [];
      rankMap[c.rank].push(c);
    }
    const pairs = Object.values(rankMap).filter((list) => list.length >= 2);
    if (pairs.length === 0) {
      setGameAnnouncement('Bài của bạn hiện không có đôi nào!');
      return;
    }

    const selectedRanks = new Set(
      cards.filter((c) => selectedCardIds.has(c.id)).map((c) => c.rank)
    );
    let nextPair = pairs[0];
    if (selectedRanks.size === 1) {
      const currentRank = Array.from(selectedRanks)[0];
      const curIdx = pairs.findIndex((p) => p[0].rank === currentRank);
      if (curIdx >= 0 && curIdx < pairs.length - 1) {
        nextPair = pairs[curIdx + 1];
      } else {
        nextPair = pairs[0];
      }
    }
    setSelectedCardIds(new Set([nextPair[0].id, nextPair[1].id]));
  };

  // Quick helper: select longest consecutive straight in hand
  const handleSelectNextStraight = () => {
    sounds.playChips();
    const sorted = [...players[0].cards].filter((c) => c.rank !== 2).sort(compareTienLenCards);
    const rankMap: { [key: number]: Card } = {};
    for (const c of sorted) {
      if (!rankMap[c.rank]) rankMap[c.rank] = c;
    }
    const uniqueRanks = Object.keys(rankMap).map(Number).sort((a, b) => getTienLenRankValue(a as Rank) - getTienLenRankValue(b as Rank));

    let longestRun: number[] = [];
    let currentRun: number[] = [];

    for (let i = 0; i < uniqueRanks.length; i++) {
      if (currentRun.length === 0) {
        currentRun.push(uniqueRanks[i]);
      } else {
        const prevRankVal = getTienLenRankValue(currentRun[currentRun.length - 1] as Rank);
        const thisRankVal = getTienLenRankValue(uniqueRanks[i] as Rank);
        if (thisRankVal - prevRankVal === 1) {
          currentRun.push(uniqueRanks[i]);
        } else {
          if (currentRun.length >= 3 && currentRun.length > longestRun.length) {
            longestRun = [...currentRun];
          }
          currentRun = [uniqueRanks[i]];
        }
      }
    }
    if (currentRun.length >= 3 && currentRun.length > longestRun.length) {
      longestRun = [...currentRun];
    }

    if (longestRun.length >= 3) {
      const straightCards = longestRun.map((r) => rankMap[r].id);
      setSelectedCardIds(new Set(straightCards));
    } else {
      setGameAnnouncement('Bài của bạn chưa có sảnh 3 lá liên tiếp!');
    }
  };

  const handleSmartHint = () => {
    if (currentTurnIdx !== 0) return;
    const hintCards = findSmartHintPlay(players[0].cards, lastPlay?.play || null);
    if (hintCards && hintCards.length > 0) {
      sounds.playCardLift();
      setSelectedCardIds(new Set(hintCards.map((c) => c.id)));
    } else {
      sounds.playFold();
      setGameAnnouncement('Không có bài đè! Bạn có thể Bỏ lượt.');
    }
  };

  const handleSortHand = () => {
    sounds.playChips();
    const nextMode = sortMode === 'rank' ? 'suit' : 'rank';
    setSortMode(nextMode);
    setPlayers((prev) => [
      {
        ...prev[0],
        cards: [...prev[0].cards].sort((a, b) => {
          if (nextMode === 'suit') {
            const suitDiff = getTienLenSuitValue(a.suit) - getTienLenSuitValue(b.suit);
            if (suitDiff !== 0) return suitDiff;
            return getTienLenRankValue(a.rank) - getTienLenRankValue(b.rank);
          }
          return compareTienLenCards(a, b);
        }),
      },
      ...prev.slice(1),
    ]);
  };

  const handleDeselectAll = () => {
    sounds.playClick();
    setSelectedCardIds(new Set());
  };

  const selectedCardsList = players[0].cards.filter((c) => selectedCardIds.has(c.id));
  const currentSelectedPlay = evaluateTienLenPlay(selectedCardsList);
  const canPlaySelected =
    currentTurnIdx === 0 &&
    currentSelectedPlay.type !== 'INVALID' &&
    canBeatTienLen(lastPlay?.play || null, currentSelectedPlay);

  const handleHeroPlayCards = () => {
    if (!canPlaySelected) return;
    if (roomConfig) {
      const sender = currentUser || { id: 'hero', name: 'Bạn' };
      networkManager.broadcast('TL_REMOTE_PLAY', sender, {
        play: currentSelectedPlay,
      });
      onlineHub.sendGameEvent(roomConfig.id, 'TL_REMOTE_PLAY', sender, {
        play: currentSelectedPlay,
      });
    }
    executePlayerPlay(0, currentSelectedPlay);
  };

  const handleHeroPass = () => {
    if (currentTurnIdx !== 0 || !lastPlay) return;
    sounds.playFold();
    if (roomConfig) {
      const sender = currentUser || { id: 'hero', name: 'Bạn' };
      networkManager.broadcast('TL_REMOTE_PASS', sender, {});
      onlineHub.sendGameEvent(roomConfig.id, 'TL_REMOTE_PASS', sender, {});
    }
    executePlayerPass(0);
  };

  const executePlayerPlay = (playerIdx: number, play: EvaluatedPlay) => {
    const isTargetHeo = lastPlay && lastPlay.play.highestCard.rank === 2;
    const isChop = isTargetHeo || play.type === 'FOUR_OF_A_KIND' || play.type === 'THREE_PAIRS_SEQ';

    if (isChop) {
      sounds.playChop();
      if (isTargetHeo) {
        if (play.type === 'FOUR_OF_A_KIND') {
          triggerSpecialBanner(`💥 ${players[playerIdx].name.toUpperCase()} TỨ QUÝ CHẶT HEO! 💥`);
        } else if (play.type === 'THREE_PAIRS_SEQ' || play.type === 'FOUR_PAIRS_SEQ') {
          triggerSpecialBanner(`⚡ ${players[playerIdx].name.toUpperCase()} ĐÔI THÔNG CHẶT HEO! ⚡`);
        } else if (play.highestCard.rank === 2) {
          triggerSpecialBanner(`🔥 ${players[playerIdx].name.toUpperCase()} CHẶT HEO ĐÈ! 🔥`);
        }
      } else if (play.type === 'FOUR_OF_A_KIND') {
        triggerSpecialBanner(`💥 TỨ QUÝ XUẤT TRẬN! 💥`);
      }
    } else {
      sounds.playCardSlap();
      if (play.highestCard.rank === 2) {
        triggerSpecialBanner(`🔥 HEO RA TRẬN! 🔥`);
      }
    }

    const updatedPlayers = [...players];
    const player = updatedPlayers[playerIdx];
    player.cards = player.cards.filter((c) => !play.cards.some((pc) => pc.id === c.id));
    const randomAngle = (Math.random() - 0.5) * 8;
    setLastPlay({ playerIdx, play, angle: randomAngle });
    setSelectedCardIds(new Set());

    if (player.cards.length === 0) {
      setGameState('GAME_OVER');
      if (player.isHuman) {
        sounds.playWin();
        confetti({ particleCount: 200, spread: 90 });
        const wonReward = stake * 4;
        const newTotal = chips + wonReward;
        setChips(newTotal);
        onUpdateChips(newTotal, wonReward);
        triggerSpecialBanner(`👑 BẠN ĐÃ TỚI NHẤT! (+${wonReward.toLocaleString()}) 👑`);
        setGameAnnouncement(`XUẤT SẮC! BẠN ĐÃ TỚI NHẤT VÀ THẮNG +$${wonReward.toLocaleString()}!`);
      } else {
        sounds.playFold();
        const lost = stake * 2;
        const newTotal = Math.max(0, chips - lost);
        setChips(newTotal);
        onUpdateChips(newTotal, -lost);
        setGameAnnouncement(`${player.name} đã Tới Nhất! Bạn về sau.`);
      }
      return;
    }

    advanceTurn(updatedPlayers, playerIdx);
  };

  const executePlayerPass = (playerIdx: number) => {
    const updatedPlayers = [...players];
    updatedPlayers[playerIdx].passed = true;
    advanceTurn(updatedPlayers, playerIdx);
  };

  const advanceTurn = (currentPlayers: PlayerSeat[], justActedIdx: number) => {
    const activeContenders = currentPlayers.filter((p) => !p.passed && p.cards.length > 0);

    if (activeContenders.length <= 1) {
      const trickWinner = activeContenders[0] || currentPlayers[justActedIdx];
      const winnerIdx = currentPlayers.findIndex((p) => p.id === trickWinner.id);

      const resetPlayers = currentPlayers.map((p) => ({ ...p, passed: false }));
      setPlayers(resetPlayers);
      setLastPlay(null);
      setCurrentTurnIdx(winnerIdx);
      setGameAnnouncement(`Tròn vòng! ${resetPlayers[winnerIdx].name} bắt đầu vòng mới.`);
      return;
    }

    const totalP = currentPlayers.length;
    let nextIdx = (justActedIdx + 1) % totalP;
    while (currentPlayers[nextIdx].passed || currentPlayers[nextIdx].cards.length === 0) {
      nextIdx = (nextIdx + 1) % totalP;
    }

    setPlayers(currentPlayers);
    setCurrentTurnIdx(nextIdx);
  };

  // Turn Countdown Timer
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    setTimerSeconds(turnTimeLimit);
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          if (currentTurnIdx === 0) {
            if (lastPlay) {
              sounds.playFold();
              executePlayerPass(0);
            } else {
              const heroCards = [...players[0].cards].sort(compareTienLenCards);
              if (heroCards.length > 0) {
                executePlayerPlay(0, evaluateTienLenPlay([heroCards[0]]));
              }
            }
          }
          return turnTimeLimit;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTurnIdx, gameState, turnTimeLimit, lastPlay, players]);

  // AI Bot Runner (ONLY runs for seats marked as AI Bot!)
  useEffect(() => {
    if (gameState !== 'PLAYING' || currentTurnIdx === 0) return;

    const bot = players[currentTurnIdx];
    // DO NOT run AI for remote human friends! Only run if bot.isBot === true!
    if (!bot || bot.isHuman || !bot.isBot || bot.passed || bot.cards.length === 0) return;

    const thinkTime = 700 + Math.random() * 500;
    const timer = setTimeout(() => {
      const botCards = [...bot.cards].sort(compareTienLenCards);
      const targetPlay = lastPlay?.play || null;
      let chosenPlay: EvaluatedPlay | null = null;

      if (!targetPlay) {
        if (botCards.length >= 2 && botCards[0].rank === botCards[1].rank) {
          chosenPlay = evaluateTienLenPlay([botCards[0], botCards[1]]);
        } else {
          chosenPlay = evaluateTienLenPlay([botCards[0]]);
        }
      } else if (targetPlay.type === 'SINGLE') {
        for (const c of botCards) {
          const singlePlay = evaluateTienLenPlay([c]);
          if (canBeatTienLen(targetPlay, singlePlay)) {
            chosenPlay = singlePlay;
            break;
          }
        }
      } else if (targetPlay.type === 'PAIR') {
        for (let i = 0; i < botCards.length - 1; i++) {
          if (botCards[i].rank === botCards[i + 1].rank) {
            const pairPlay = evaluateTienLenPlay([botCards[i], botCards[i + 1]]);
            if (canBeatTienLen(targetPlay, pairPlay)) {
              chosenPlay = pairPlay;
              break;
            }
          }
        }
      }

      if (chosenPlay) {
        executePlayerPlay(currentTurnIdx, chosenPlay);
      } else {
        sounds.playFold();
        executePlayerPass(currentTurnIdx);
      }
    }, thinkTime);

    return () => clearTimeout(timer);
  }, [currentTurnIdx, gameState, lastPlay]);

  // Hero Cards count & dynamic overlap calculation for 100% visible mobile portrait
  const heroCards = players[0].cards;
  const heroCardCount = heroCards.length;

  // Render Hero Hand on Mobile and Desktop with Unified Gesture Support
  const renderHeroCards = () => {
    if (heroCardCount === 0) return null;

    // Mobile 2-Row Mode: 6-7 cards per row for large touch targets
    if (isMobile && mobileLayoutMode === 'two_rows' && heroCardCount > 6) {
      const splitIdx = Math.ceil(heroCardCount / 2);
      const topRow = heroCards.slice(0, splitIdx);
      const bottomRow = heroCards.slice(splitIdx);

      return (
        <div
          onPointerMove={handlePointerMoveContainer}
          onPointerUp={handlePointerUpContainer}
          onPointerLeave={handlePointerUpContainer}
          className="relative flex flex-col items-center gap-1.5 w-full max-w-full px-1 py-1 touch-none select-none"
        >
          {/* Top Row */}
          <div className="flex items-end justify-center -space-x-3 xs:-space-x-3.5 max-w-full overflow-visible">
            {topRow.map((card, idx) => {
              const isSelected = selectedCardIds.has(card.id);
              const liftY = isSelected ? -20 - (isSwipingUp ? swipeOffsetUp : 0) : 0;
              const scaleVal = isSelected ? 1.14 : 1;

              return (
                <div
                  key={card.id}
                  data-card-id={card.id}
                  onPointerDown={(e) => handlePointerDownCard(card, e)}
                  style={{
                    transform: `translate3d(0, ${liftY}px, 0) scale(${scaleVal})`,
                    zIndex: isSelected ? 50 : 10 + idx,
                    touchAction: 'none',
                  }}
                  className={`cursor-pointer transition-transform duration-150 select-none shrink-0 py-1 ${
                    isSelected ? 'drop-shadow-[0_12px_24px_rgba(251,191,36,0.9)]' : ''
                  }`}
                >
                  <CardView
                    card={card}
                    highlight={isSelected}
                    size="sm"
                    twoColor={true}
                    showHeoBadge={true}
                  />
                </div>
              );
            })}
          </div>

          {/* Bottom Row */}
          <div className="flex items-end justify-center -space-x-3 xs:-space-x-3.5 max-w-full overflow-visible">
            {bottomRow.map((card, idx) => {
              const isSelected = selectedCardIds.has(card.id);
              const liftY = isSelected ? -20 - (isSwipingUp ? swipeOffsetUp : 0) : 0;
              const scaleVal = isSelected ? 1.14 : 1;

              return (
                <div
                  key={card.id}
                  data-card-id={card.id}
                  onPointerDown={(e) => handlePointerDownCard(card, e)}
                  style={{
                    transform: `translate3d(0, ${liftY}px, 0) scale(${scaleVal})`,
                    zIndex: isSelected ? 50 : 30 + idx,
                    touchAction: 'none',
                  }}
                  className={`cursor-pointer transition-transform duration-150 select-none shrink-0 py-1 ${
                    isSelected ? 'drop-shadow-[0_12px_24px_rgba(251,191,36,0.9)]' : ''
                  }`}
                >
                  <CardView
                    card={card}
                    highlight={isSelected}
                    size="sm"
                    twoColor={true}
                    showHeoBadge={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Adaptive 1-Row Fan Mode
    // Automatically use 'sm' cards when card count drops below 9 for easier touch
    const cardSize = isMobile
      ? heroCardCount <= 8
        ? 'sm'
        : 'xs'
      : isTablet
      ? 'md'
      : 'lg';

    const overlapClass =
      isMobile
        ? heroCardCount > 10
          ? '-space-x-4.5 xs:-space-x-4'
          : heroCardCount > 6
          ? '-space-x-3.5 xs:-space-x-3'
          : '-space-x-2'
        : isTablet
        ? '-space-x-3 sm:-space-x-4'
        : '-space-x-4 lg:-space-x-5';

    return (
      <div
        onPointerMove={handlePointerMoveContainer}
        onPointerUp={handlePointerUpContainer}
        onPointerLeave={handlePointerUpContainer}
        className={`relative flex items-end justify-center ${overlapClass} max-w-full px-0.5 sm:px-4 pt-5 sm:pt-8 pb-2 overflow-visible select-none touch-none`}
      >
        {heroCards.map((card, idx) => {
          const isSelected = selectedCardIds.has(card.id);
          const centerIdx = (heroCardCount - 1) / 2;
          const offset = idx - centerIdx;

          // Organic fanning angle
          const rotationAngle = isSelected
            ? 0
            : isMobile
            ? Math.max(-10, Math.min(10, offset * 1.5))
            : Math.max(-14, Math.min(14, offset * 2.2));

          const arcBase = isMobile ? Math.abs(offset) * 0.7 : Math.abs(offset) * 1.2;
          const liftY = isSelected
            ? (isMobile ? -26 : -36) - (isSwipingUp ? swipeOffsetUp : 0)
            : arcBase;
          const scaleVal = isSelected ? (isMobile ? 1.15 : 1.12) : 1;

          return (
            <div
              key={card.id}
              data-card-id={card.id}
              onPointerDown={(e) => handlePointerDownCard(card, e)}
              style={{
                transform: `translate3d(0, ${liftY}px, 0) rotate(${rotationAngle}deg) scale(${scaleVal})`,
                zIndex: isSelected ? 50 : 10 + idx,
                touchAction: 'none',
              }}
              className={`cursor-pointer transition-transform duration-150 select-none shrink-0 py-1.5 px-0.5 ${
                isSelected ? 'drop-shadow-[0_16px_28px_rgba(251,191,36,0.9)]' : ''
              }`}
              title="Chạm để chọn · Nhấp đúp chọn đôi/bộ · Vuốt ngang để chọn nhiều lá"
            >
              <CardView
                card={card}
                highlight={isSelected}
                size={cardSize}
                twoColor={true}
                showHeoBadge={true}
                className="shadow-xl"
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-950 text-white flex flex-col justify-between select-none overflow-x-hidden font-sans">
      {/* Top Header with Responsive Device Controls */}
      <header className="px-2.5 sm:px-6 py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-rose-950/80 flex items-center justify-between backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1.5 min-h-[40px] rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors active:scale-95"
          >
            ← Sảnh
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-lg text-rose-500">♥</span>
            <span className="font-serif font-black text-rose-400 tracking-wider text-xs sm:text-base uppercase whitespace-nowrap">
              TIẾN LÊN MIỀN NAM
            </span>
          </div>

          {roomConfig && (
            <button
              onClick={() => {
                sounds.playClick();
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(roomConfig.code);
                  setCopyToast(`Đã sao chép mã: ${roomConfig.code}`);
                  setTimeout(() => setCopyToast(null), 2500);
                }
              }}
              className="px-2 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-mono font-bold text-xs flex items-center gap-1 active:scale-95"
            >
              <span>#{roomConfig.code}</span>
              <span className="text-[10px] underline hidden xs:inline">Chép</span>
            </button>
          )}
        </div>

        {/* Center / Right: Device Mode Switcher & Wallet */}
        <div className="flex items-center gap-1.5 sm:gap-3 font-mono text-xs">
          <DeviceModeSelector compact={true} />

          <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 hidden xs:flex items-center gap-1">
            <span className="text-slate-400">Cược:</span>
            <span className="text-amber-300 font-bold">${stake}</span>
          </div>

          <div className="px-2.5 sm:px-3.5 py-1 min-h-[38px] rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-400">Ví:</span>
            <span className="text-emerald-400 font-bold text-xs sm:text-sm tabular-nums">
              ${chips.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {/* Copy Toast */}
      {copyToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-2xl animate-bounce">
          {copyToast}
        </div>
      )}

      {/* Special Dramatic Pop-Up Banner */}
      {specialEffectText && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center animate-in zoom-in-50 duration-300">
          <div className="px-6 sm:px-10 py-4 sm:py-5 rounded-3xl bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 border-4 border-yellow-300 text-white font-black text-xl sm:text-4xl tracking-wider uppercase shadow-[0_0_80px_rgba(244,63,94,0.9)] animate-pulse text-center mx-4">
            {specialEffectText}
          </div>
        </div>
      )}

      {/* Main Table Arena (Tailored for Mobile Portrait, Tablet, and Desktop) */}
      <main className="max-w-5xl w-full mx-auto p-1 sm:p-4 flex flex-col items-center justify-between flex-1 overflow-hidden relative">
        {gameState === 'IDLE' ? (
          /* Lobby Start Screen */
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/95 border-2 border-rose-500/60 text-center max-w-md shadow-2xl backdrop-blur-md my-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-950 border border-rose-500/50 text-rose-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg">
              ♥
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-serif text-white mb-2">
              Sới Bạc Tiến Lên Miền Nam
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Đồ họa sắc nét chuẩn Casino, tối ưu hiển thị trọn vẹn 13 lá bài trên điện thoại màn dọc, hỗ trợ gợi ý nước đi và chặt Heo.
            </p>

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-xs text-slate-400 font-semibold uppercase">Mức Cược:</span>
              {[25, 50, 100, 200].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setStake(amt)}
                  className={`px-3 py-1.5 min-h-[44px] rounded-xl text-xs font-mono font-bold border transition-all ${
                    stake === amt
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md scale-105'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <button
              onClick={startNewTienLen}
              className="w-full py-3.5 min-h-[48px] rounded-2xl bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:from-rose-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-rose-600/30 active:scale-95 transition-all"
            >
              VÀO BÀN CHƠI NGAY (${stake})
            </button>
          </div>
        ) : (
          /* Active Game Table */
          <div className="relative w-full flex-1 flex flex-col justify-between items-center rounded-[32px] sm:rounded-[80px] md:rounded-[120px] bg-gradient-to-b from-[#2e0912] via-[#120306] to-[#2e0912] border-4 sm:border-[12px] md:border-[16px] border-[#20090e] shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-1 sm:ring-4 ring-black/90 p-2 sm:p-5 overflow-hidden">
            {/* Table Laser Ring */}
            <div className="absolute inset-2 sm:inset-4 rounded-[28px] sm:rounded-[70px] border border-rose-500/20 pointer-events-none" />

            {/* TOP SEAT: In 2-player match, Seat 1 (Opponent) sits across! In 4-player match, Seat 2 sits on top */}
            {players.length === 2 ? (
              <div className="relative z-10 flex flex-col items-center shrink-0 pt-0.5">
                {players[1] && (
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`relative px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 transition-all ${
                        currentTurnIdx === 1
                          ? 'bg-amber-500 text-slate-950 border-yellow-200 ring-2 sm:ring-4 ring-amber-400/80 shadow-xl scale-105'
                          : 'bg-slate-950/90 text-slate-200 border-slate-700'
                      }`}
                    >
                      <div
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow shrink-0"
                        style={{ backgroundColor: players[1].avatarColor }}
                      >
                        {players[1].name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold">{players[1].name}</span>
                      <span className="font-mono text-[10px] text-amber-200 font-bold">
                        ({players[1].cards.length} lá)
                      </span>
                      {currentTurnIdx === 1 && (
                        <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {timerSeconds}
                        </span>
                      )}
                      {players[1].cards.length === 1 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[8px] font-black animate-pulse">
                          1 LÁ
                        </span>
                      )}
                      {players[1].passed && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[8px]">
                          BỎ LƯỢT
                        </span>
                      )}
                    </div>
                    <div className="flex -space-x-3 sm:-space-x-3.5 mt-1">
                      {players[1].cards.slice(0, 8).map((_, i) => (
                        <CardView key={i} faceDown size="xs" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : players.length >= 4 && players[2] ? (
              <div className="relative z-10 flex flex-col items-center shrink-0 pt-0.5">
                <div
                  className={`relative px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 transition-all ${
                    currentTurnIdx === 2
                      ? 'bg-amber-500 text-slate-950 border-yellow-200 ring-2 sm:ring-4 ring-amber-400/80 shadow-xl scale-105'
                      : 'bg-slate-950/90 text-slate-200 border-slate-700'
                  }`}
                >
                  <div
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow shrink-0"
                    style={{ backgroundColor: players[2].avatarColor }}
                  >
                    {players[2].name.charAt(0).toUpperCase()}
                  </div>
                  <span>{players[2].name}</span>
                  <span className="font-mono text-[10px] text-amber-200 font-bold">({players[2].cards.length} lá)</span>
                  {currentTurnIdx === 2 && (
                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">
                      {timerSeconds}
                    </span>
                  )}
                  {players[2].cards.length === 1 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[8px] font-black animate-pulse">
                      1 LÁ
                    </span>
                  )}
                  {players[2].passed && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[8px]">
                      BỎ LƯỢT
                    </span>
                  )}
                </div>

                <div className="flex -space-x-3.5 mt-1">
                  {players[2].cards.slice(0, 6).map((_, i) => (
                    <CardView key={i} faceDown size="xs" />
                  ))}
                </div>
              </div>
            ) : null}

            {/* MIDDLE ROW: SEAT 1 (Left), TABLE CENTER (Trick), SEAT 3 (Right) */}
            <div className="w-full flex items-center justify-between px-1 sm:px-4 z-10 flex-1 my-1">
              {/* Left Seat: only in 3 or 4-player games */}
              {players.length > 2 && players[1] ? (
                <div className="flex flex-col items-center max-w-[70px] sm:max-w-none shrink-0">
                  <div
                    className={`relative px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold border backdrop-blur-md flex items-center gap-1 transition-all ${
                      currentTurnIdx === 1
                        ? 'bg-amber-500 text-slate-950 border-yellow-200 ring-2 ring-amber-400/80 shadow-xl scale-105'
                        : 'bg-slate-950/90 text-slate-200 border-slate-700'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow shrink-0"
                      style={{ backgroundColor: players[1].avatarColor }}
                    >
                      {players[1].name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[42px] sm:max-w-none">{players[1].name}</span>
                    <span className="font-mono text-[9px] text-amber-200">({players[1].cards.length})</span>
                    {currentTurnIdx === 1 && (
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-950 text-amber-300 font-mono text-[9px] flex items-center justify-center font-bold">
                        {timerSeconds}
                      </span>
                    )}
                  </div>
                  {players[1].cards.length === 1 && (
                    <span className="px-1 py-0.2 rounded-full bg-rose-600 text-white text-[8px] font-black animate-pulse mt-0.5">
                      1 LÁ
                    </span>
                  )}
                  {players[1].passed && (
                    <span className="text-[9px] text-slate-400 italic mt-0.5">Bỏ lượt</span>
                  )}
                  <div className="flex -space-x-3 mt-0.5">
                    {players[1].cards.slice(0, 4).map((_, i) => (
                      <CardView key={i} faceDown size="xs" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-8 shrink-0" />
              )}

              {/* TABLE CENTER: Played Cards Drop Zone */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-4 rounded-2xl sm:rounded-3xl bg-black/75 border-2 border-rose-500/40 shadow-[0_0_40px_rgba(0,0,0,0.85)] min-w-[140px] sm:min-w-[220px] min-h-[90px] sm:min-h-[130px] backdrop-blur-md mx-1">
                {lastPlay ? (
                  <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap justify-center">
                      <span className="text-[9px] sm:text-xs font-black uppercase text-amber-300 tracking-wider">
                        {players[lastPlay.playerIdx]?.name || 'Người chơi'}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-950/80 text-rose-300 border border-rose-600/60 shadow">
                        {getTienLenPlayNameVi(lastPlay.play)}
                      </span>
                    </div>
                    <div
                      className="flex items-center -space-x-2.5 sm:-space-x-3.5 transition-transform duration-300 drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)]"
                      style={{ transform: `rotate(${lastPlay.angle}deg)` }}
                    >
                      {lastPlay.play.cards.map((c) => (
                        <div key={c.id} className="shadow-xl">
                          <CardView
                            card={c}
                            size={isMobile ? 'sm' : 'md'}
                            twoColor={true}
                            showHeoBadge={true}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center text-rose-300/50">
                    <span className="text-xl sm:text-2xl text-rose-400/60">♠ ♥ ♦ ♣</span>
                    <span className="text-[9px] sm:text-xs font-serif italic mt-0.5 font-bold text-amber-300/80">
                      VÒNG MỚI · ĐÁNH TỰ DO
                    </span>
                  </div>
                )}
              </div>

              {/* Right Seat: players[2] in 3-player game, or players[3] in 4-player game */}
              {players.length === 3 && players[2] ? (
                <div className="flex flex-col items-center max-w-[70px] sm:max-w-none shrink-0">
                  <div
                    className={`relative px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold border backdrop-blur-md flex items-center gap-1 transition-all ${
                      currentTurnIdx === 2
                        ? 'bg-amber-500 text-slate-950 border-yellow-200 ring-2 ring-amber-400/80 shadow-xl scale-105'
                        : 'bg-slate-950/90 text-slate-200 border-slate-700'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow shrink-0"
                      style={{ backgroundColor: players[2].avatarColor }}
                    >
                      {players[2].name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[42px] sm:max-w-none">{players[2].name}</span>
                    <span className="font-mono text-[9px] text-amber-200">({players[2].cards.length})</span>
                    {currentTurnIdx === 2 && (
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-950 text-amber-300 font-mono text-[9px] flex items-center justify-center font-bold">
                        {timerSeconds}
                      </span>
                    )}
                  </div>
                  {players[2].cards.length === 1 && (
                    <span className="px-1 py-0.2 rounded-full bg-rose-600 text-white text-[8px] font-black animate-pulse mt-0.5">
                      1 LÁ
                    </span>
                  )}
                  {players[2].passed && (
                    <span className="text-[9px] text-slate-400 italic mt-0.5">Bỏ lượt</span>
                  )}
                  <div className="flex -space-x-3 mt-0.5">
                    {players[2].cards.slice(0, 4).map((_, i) => (
                      <CardView key={i} faceDown size="xs" />
                    ))}
                  </div>
                </div>
              ) : players.length >= 4 && players[3] ? (
                <div className="flex flex-col items-center max-w-[70px] sm:max-w-none shrink-0">
                  <div
                    className={`relative px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold border backdrop-blur-md flex items-center gap-1 transition-all ${
                      currentTurnIdx === 3
                        ? 'bg-amber-500 text-slate-950 border-yellow-200 ring-2 ring-amber-400/80 shadow-xl scale-105'
                        : 'bg-slate-950/90 text-slate-200 border-slate-700'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow shrink-0"
                      style={{ backgroundColor: players[3].avatarColor }}
                    >
                      {players[3].name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[42px] sm:max-w-none">{players[3].name}</span>
                    <span className="font-mono text-[9px] text-amber-200">({players[3].cards.length})</span>
                    {currentTurnIdx === 3 && (
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-950 text-amber-300 font-mono text-[9px] flex items-center justify-center font-bold">
                        {timerSeconds}
                      </span>
                    )}
                  </div>
                  {players[3].cards.length === 1 && (
                    <span className="px-1 py-0.2 rounded-full bg-rose-600 text-white text-[8px] font-black animate-pulse mt-0.5">
                      1 LÁ
                    </span>
                  )}
                  {players[3].passed && (
                    <span className="text-[9px] text-slate-400 italic mt-0.5">Bỏ lượt</span>
                  )}
                  <div className="flex -space-x-3 mt-0.5">
                    {players[3].cards.slice(0, 4).map((_, i) => (
                      <CardView key={i} faceDown size="xs" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-8 shrink-0" />
              )}
            </div>

            {/* SEAT 0: HERO (Bottom Hand with Dedicated Mobile View Toggle & 100% Fit) */}
            <div className="relative z-20 flex flex-col items-center w-full shrink-0">
              {/* Turn Status Alert & Mobile Row Toggle */}
              <div className="flex items-center justify-between w-full max-w-xl px-2 mb-1">
                <div
                  className={`px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border shadow-md flex items-center gap-1.5 ${
                    currentTurnIdx === 0
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-yellow-200 ring-2 ring-amber-400 animate-pulse'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700'
                  }`}
                >
                  <span>{currentTurnIdx === 0 ? '★ LƯỢT BẠN ĐÁNH ★' : `Lượt: ${players[currentTurnIdx].name}`}</span>
                  {currentTurnIdx === 0 && (
                    <span className="font-mono font-black bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded-full text-[10px]">
                      {timerSeconds}s
                    </span>
                  )}
                </div>

                {/* Mobile Specific: Toggle between 1-Row Adaptive and 2-Row Stacked for Easy Viewing */}
                {isMobile && heroCardCount > 6 && (
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setMobileLayoutMode((prev) => (prev === 'auto_fan' ? 'two_rows' : 'auto_fan'));
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 text-[10px] font-semibold flex items-center gap-1 active:scale-95 shadow-sm"
                    title="Đổi kiểu xếp bài trên điện thoại"
                  >
                    <span>{mobileLayoutMode === 'auto_fan' ? '📚 Xếp 2 Tầng' : '⚡ Co 1 Hàng'}</span>
                  </button>
                )}

                {players[0].cards.length === 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] animate-bounce shadow">
                    BÁO 1 LÁ!
                  </span>
                )}
              </div>

              {/* Dynamic Combo Feedback Badge & Quick Helper Pills */}
              <div className="flex items-center justify-center gap-1.5 w-full max-w-xl px-2 my-1 min-h-[28px]">
                {selectedCardIds.size > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/95 border border-amber-500/60 shadow-lg animate-in fade-in zoom-in-95 backdrop-blur-md">
                    <span className={`text-[11px] sm:text-xs font-bold ${currentSelectedPlay.type === 'INVALID' ? 'text-rose-400' : 'text-amber-300'}`}>
                      {currentSelectedPlay.type === 'INVALID' ? '⚠️ Chưa thành bộ hợp lệ' : `✨ ${getTienLenPlayNameVi(currentSelectedPlay)}`}
                    </span>
                    {canPlaySelected && (
                      <span className="text-[10px] text-emerald-400 font-bold hidden xs:inline">
                        · Đủ điều kiện đè!
                      </span>
                    )}
                    <button
                      onClick={handleDeselectAll}
                      className="w-4 h-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-[10px] ml-1 active:scale-90"
                      title="Hạ bài"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                    <button
                      onClick={handleSelectNextPair}
                      className="px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[10px] font-semibold transition-all active:scale-95 shadow-xs whitespace-nowrap"
                      title="Tự động chọn đôi bài tiếp theo"
                    >
                      👥 Chọn Đôi
                    </button>
                    <button
                      onClick={handleSelectNextStraight}
                      className="px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[10px] font-semibold transition-all active:scale-95 shadow-xs whitespace-nowrap"
                      title="Tự động chọn sảnh bài dài nhất"
                    >
                      🔗 Chọn Sảnh
                    </button>
                    <span className="text-[10px] text-slate-500 hidden sm:inline italic">
                      (Mẹo: Vuốt ngang chọn nhiều lá · Vuốt lên để đánh)
                    </span>
                  </div>
                )}
              </div>

              {/* Swipe Up Visual Indicator */}
              {isSwipingUp && (
                <div className="absolute top-12 z-50 px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-2xl animate-bounce border-2 border-emerald-300 flex items-center gap-1.5 pointer-events-none">
                  <span className="text-sm">🚀</span>
                  <span>{canPlaySelected ? 'Thả tay để ĐÁNH BÀI!' : 'Bộ bài chưa hợp lệ để đè'}</span>
                </div>
              )}

              {/* RENDER ALL HERO CARDS: 100% visible, no horizontal cut-off */}
              <div className="w-full flex justify-center">
                {renderHeroCards()}
              </div>
            </div>
          </div>
        )}

        {/* Action Controls Toolbar (Thumb-friendly on Mobile) */}
        {gameState === 'PLAYING' && (
          <div className="w-full max-w-xl mt-1.5 sm:mt-3 flex items-center justify-between gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md shrink-0">
            {/* Quick Tools */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-initial">
              <button
                onClick={handleSortHand}
                className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-2 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1 active:scale-95"
                title={`Đang xếp theo ${sortMode === 'rank' ? 'Điểm (3-2)' : 'Chất (♠-♥)'}. Bấm để đổi.`}
              >
                <span>Xếp ({sortMode === 'rank' ? 'Điểm' : 'Chất'})</span>
                <span className="hidden xs:inline">🔀</span>
              </button>

              <button
                onClick={handleSmartHint}
                disabled={currentTurnIdx !== 0}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-2 min-h-[44px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95 ${
                  currentTurnIdx === 0 && selectedCardIds.size === 0
                    ? 'ring-2 ring-amber-400/80 animate-pulse bg-amber-500/30 text-amber-200'
                    : ''
                }`}
                title="Tự động tìm bài đè tối ưu"
              >
                <span>Gợi Ý</span>
                <span className="hidden xs:inline">💡</span>
              </button>

              {selectedCardIds.size > 0 && (
                <button
                  onClick={handleDeselectAll}
                  className="px-2.5 py-2 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap active:scale-95"
                  title="Bỏ chọn tất cả các lá bài đang chọn"
                >
                  Hạ Bài
                </button>
              )}
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-end">
              <button
                onClick={handleHeroPass}
                disabled={currentTurnIdx !== 0 || !lastPlay}
                className="px-3 sm:px-5 py-2 min-h-[44px] rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 disabled:opacity-40 text-slate-300 font-bold text-xs uppercase border border-slate-700 transition-colors whitespace-nowrap active:scale-95"
              >
                BỎ LƯỢT
              </button>

              <button
                onClick={handleHeroPlayCards}
                disabled={!canPlaySelected}
                className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 min-h-[44px] rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1 whitespace-nowrap ${
                  canPlaySelected
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 shadow-amber-500/40 ring-2 ring-yellow-200 animate-pulse'
                    : 'bg-slate-800 text-slate-600 disabled:opacity-50 cursor-not-allowed'
                }`}
              >
                <span>ĐÁNH BÀI</span>
                {selectedCardIds.size > 0 && <span>({selectedCardIds.size})</span>}
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAME_OVER' && (
          <div className="my-2">
            <button
              onClick={startNewTienLen}
              className="px-8 py-3 min-h-[48px] rounded-2xl bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:from-rose-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-rose-600/30 active:scale-95 transition-all"
            >
              CHƠI TIẾP VÁN MỚI
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-2 bg-slate-950 border-t border-slate-900 text-center text-[11px] text-slate-500 shrink-0">
        Tiến Lên Miền Nam · Tối ưu hiển thị cho Điện thoại, Tablet và Máy tính
      </footer>
    </div>
  );
};
