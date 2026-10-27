/**
 * Texas Hold'em AI Engine
 * Realistic bot personalities, hand strength calculations, pot odds, and bluffing logic.
 */

import { Card, evaluateBestHand, HandRank, Rank } from './poker';

export interface AIPersonality {
  id: string;
  name: string;
  nickname: string;
  styleVi: string;
  avatarSeed: string;
  color: string;
  aggression: number; // 0.1 (passive) to 1.0 (hyper-aggressive)
  tightness: number;  // 0.1 (loose/plays everything) to 0.9 (folds almost everything)
  bluffRate: number;  // 0.0 to 0.4
}

export const AI_BOTS: AIPersonality[] = [
  {
    id: 'bot_viktor',
    name: 'Viktor Blom',
    nickname: 'The Shark',
    styleVi: 'Tấn Công Mạo Hiểm (LAG)',
    avatarSeed: 'Viktor',
    color: '#ef4444',
    aggression: 0.85,
    tightness: 0.35,
    bluffRate: 0.25,
  },
  {
    id: 'bot_phil',
    name: 'Phil Hellmuth',
    nickname: 'The Strategist',
    styleVi: 'Kỷ Luật Chặt Chẽ (TAG)',
    avatarSeed: 'Phil',
    color: '#3b82f6',
    aggression: 0.7,
    tightness: 0.75,
    bluffRate: 0.08,
  },
  {
    id: 'bot_daniel',
    name: 'Daniel Negreanu',
    nickname: 'Kid Poker',
    styleVi: 'Linh Hoạt Đọc Bài (LAG)',
    avatarSeed: 'Daniel',
    color: '#10b981',
    aggression: 0.65,
    tightness: 0.45,
    bluffRate: 0.16,
  },
  {
    id: 'bot_doyle',
    name: 'Doyle Brunson',
    nickname: 'The Legend',
    styleVi: 'Cổ Điển Vững Vàng (TAG)',
    avatarSeed: 'Doyle',
    color: '#f59e0b',
    aggression: 0.6,
    tightness: 0.6,
    bluffRate: 0.12,
  },
  {
    id: 'bot_antonio',
    name: 'Antonio Esfandiari',
    nickname: 'The Magician',
    styleVi: 'Biến Hóa Khó Lường',
    avatarSeed: 'Antonio',
    color: '#8b5cf6',
    aggression: 0.75,
    tightness: 0.4,
    bluffRate: 0.22,
  },
];

/**
 * Rates preflop 2-card hand strength on a scale of 0 to 100
 */
export function evaluatePreflopStrength(holeCards: Card[]): number {
  if (holeCards.length !== 2) return 0;

  const [c1, c2] = holeCards;
  const highRank = Math.max(c1.rank, c2.rank) as Rank;
  const lowRank = Math.min(c1.rank, c2.rank) as Rank;
  const isPair = highRank === lowRank;
  const isSuited = c1.suit === c2.suit;
  const gap = highRank - lowRank;

  // Pocket pairs
  if (isPair) {
    if (highRank === 14) return 98; // AA
    if (highRank === 13) return 94; // KK
    if (highRank === 12) return 90; // QQ
    if (highRank === 11) return 85; // JJ
    if (highRank === 10) return 80; // TT
    return 65 + (highRank - 2) * 1.5; // 22 - 99
  }

  let score = 0;
  // High card value
  if (highRank === 14) score += 35;
  else if (highRank === 13) score += 28;
  else if (highRank === 12) score += 22;
  else if (highRank === 11) score += 18;
  else if (highRank === 10) score += 14;
  else score += highRank;

  // Second card value
  if (lowRank === 14) score += 35;
  else if (lowRank === 13) score += 25;
  else if (lowRank === 12) score += 18;
  else if (lowRank === 11) score += 14;
  else score += lowRank;

  // Suited bonus
  if (isSuited) score += 10;

  // Connected bonus
  if (gap === 1) score += 8;
  else if (gap === 2) score += 4;
  else if (gap === 3) score += 1;
  else score -= 5;

  return Math.min(Math.max(score, 10), 96);
}

export type DecisionType = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN';

export interface AIDecision {
  action: DecisionType;
  amount: number; // 0 for fold/check, call amount for call, total bet for raise
  reasoningVi: string;
}

/**
 * Determines bot action based on personality, game state, pot odds, and hand strength
 */
export function getAIDecision(params: {
  bot: AIPersonality;
  holeCards: Card[];
  communityCards: Card[];
  currentBet: number;
  playerBetThisRound: number;
  playerStack: number;
  potSize: number;
  bigBlind: number;
  minRaise: number;
  playersInHandCount: number;
}): AIDecision {
  const {
    bot,
    holeCards,
    communityCards,
    currentBet,
    playerBetThisRound,
    playerStack,
    potSize,
    bigBlind,
    minRaise,
  } = params;

  const toCall = currentBet - playerBetThisRound;
  const canCheck = toCall <= 0;
  const potAfterCall = potSize + toCall;
  const potOdds = toCall > 0 ? toCall / potAfterCall : 0; // % of pot required to call

  // If stack is 0, player has already committed all chips
  if (playerStack <= 0) {
    return { action: 'CHECK', amount: 0, reasoningVi: 'Đã tất tay' };
  }

  // PREFLOP DECISION
  if (communityCards.length === 0) {
    const rawStrength = evaluatePreflopStrength(holeCards);
    // Adjust by bot tightness
    // A tight bot (0.8) needs higher strength to play; loose bot (0.3) plays more
    const requiredThreshold = 25 + bot.tightness * 35;
    const isBluffing = Math.random() < bot.bluffRate;

    // Big raise faced
    const isHighBet = toCall > bigBlind * 3;

    if (rawStrength >= 88) {
      // Monster hand (AA, KK, QQ, AKs) -> Always raise / 3-bet
      const raiseAmount = Math.min(
        playerStack,
        Math.max(currentBet + minRaise, currentBet * 2.5, bigBlind * 3.5)
      );
      if (raiseAmount >= playerStack) {
        return { action: 'ALL_IN', amount: playerStack, reasoningVi: 'Tất tay bài tẩy siêu cấp' };
      }
      return {
        action: 'RAISE',
        amount: Math.round(raiseAmount),
        reasoningVi: 'Tố mạnh với bài tẩy khủng',
      };
    }

    if (rawStrength >= requiredThreshold || isBluffing) {
      // Good hand
      if (canCheck) {
        // Option to raise or check
        if (Math.random() < bot.aggression && rawStrength > 65) {
          const raiseAmount = Math.min(playerStack, Math.max(minRaise, bigBlind * 3));
          return {
            action: 'RAISE',
            amount: Math.round(raiseAmount),
            reasoningVi: 'Tố lấy quyền chủ động preflop',
          };
        }
        return { action: 'CHECK', amount: 0, reasoningVi: 'Xem bài miễn phí' };
      }

      // To call
      if (isHighBet && rawStrength < 75 && !isBluffing) {
        return { action: 'FOLD', amount: 0, reasoningVi: 'Bỏ bài trước mức cược lớn' };
      }

      // Small raise or call
      if (Math.random() < bot.aggression * 0.4 && rawStrength > 70 && !isHighBet) {
        const raiseAmount = Math.min(
          playerStack,
          Math.max(currentBet + minRaise, currentBet * 2.2)
        );
        return {
          action: 'RAISE',
          amount: Math.round(raiseAmount),
          reasoningVi: 'Nâng cược ép đối thủ',
        };
      }

      return {
        action: toCall >= playerStack ? 'ALL_IN' : 'CALL',
        amount: Math.min(toCall, playerStack),
        reasoningVi: 'Theo cược vào xem Flop',
      };
    }

    // Weak hand
    if (canCheck) {
      return { action: 'CHECK', amount: 0, reasoningVi: 'Xem bài miễn phí (Check)' };
    }
    return { action: 'FOLD', amount: 0, reasoningVi: 'Bỏ bài yếu preflop' };
  }

  // POSTFLOP (FLOP, TURN, RIVER)
  const bestHand = evaluateBestHand([...holeCards, ...communityCards]);
  const handRank = bestHand.rank;

  // Assess relative strength
  let postflopScore = 0;
  switch (handRank) {
    case HandRank.ROYAL_FLUSH:
    case HandRank.STRAIGHT_FLUSH:
    case HandRank.FOUR_OF_A_KIND:
      postflopScore = 99;
      break;
    case HandRank.FULL_HOUSE:
      postflopScore = 92;
      break;
    case HandRank.FLUSH:
      postflopScore = 85;
      break;
    case HandRank.STRAIGHT:
      postflopScore = 80;
      break;
    case HandRank.THREE_OF_A_KIND:
      postflopScore = 72;
      break;
    case HandRank.TWO_PAIR:
      postflopScore = 62;
      break;
    case HandRank.ONE_PAIR:
      // High pair vs low pair
      postflopScore = bestHand.tieBreakers[0] >= 11 ? 50 : 38;
      break;
    default:
      postflopScore = 18;
      break;
  }

  const isBluffingPostflop = Math.random() < bot.bluffRate;

  // Monster hands (Straight or better)
  if (postflopScore >= 80) {
    if (canCheck && Math.random() < 0.25) {
      // Slow play trap
      return { action: 'CHECK', amount: 0, reasoningVi: 'Bẫy đối thủ (Slowplay)' };
    }
    const betSize = Math.max(
      minRaise,
      Math.round(potSize * (0.6 + bot.aggression * 0.4))
    );
    const targetBet = currentBet + betSize;
    if (targetBet >= playerStack || postflopScore >= 92 && Math.random() < 0.4) {
      return { action: 'ALL_IN', amount: playerStack, reasoningVi: 'Tất tay bài cực mạnh!' };
    }
    return {
      action: 'RAISE',
      amount: Math.min(targetBet, playerStack),
      reasoningVi: `Tố giá trị (${bestHand.nameVi})`,
    };
  }

  // Strong Made Hands (Three of a Kind, Two Pair, Top Pair)
  if (postflopScore >= 50) {
    if (canCheck) {
      if (Math.random() < bot.aggression) {
        const bet = Math.max(minRaise, Math.round(potSize * 0.5));
        return {
          action: 'RAISE',
          amount: Math.min(currentBet + bet, playerStack),
          reasoningVi: 'Cược lấy giá trị với bài tốt',
        };
      }
      return { action: 'CHECK', amount: 0, reasoningVi: 'Xem bài giữ pot' };
    }

    // Facing a bet
    if (toCall <= potSize * 0.75 || toCall < playerStack * 0.3) {
      return {
        action: toCall >= playerStack ? 'ALL_IN' : 'CALL',
        amount: Math.min(toCall, playerStack),
        reasoningVi: 'Theo cược với bài sẵn có',
      };
    }

    // High bet faced
    if (postflopScore >= 62) {
      return {
        action: toCall >= playerStack ? 'ALL_IN' : 'CALL',
        amount: Math.min(toCall, playerStack),
        reasoningVi: 'Theo cược chấp nhận rủi ro',
      };
    }

    return { action: 'FOLD', amount: 0, reasoningVi: 'Bỏ bài trước mức cược quá đắt' };
  }

  // Mediocre / Weak hands (Low pair, High card)
  if (isBluffingPostflop && canCheck) {
    const bluffBet = Math.max(minRaise, Math.round(potSize * 0.5));
    return {
      action: 'RAISE',
      amount: Math.min(currentBet + bluffBet, playerStack),
      reasoningVi: 'Thử lừa đối thủ (Bluff cược)',
    };
  }

  if (canCheck) {
    return { action: 'CHECK', amount: 0, reasoningVi: 'Xem bài an toàn (Check)' };
  }

  // Facing a bet with weak hand
  // If tiny bet (pot odds attractive < 12%) and player has chips
  if (potOdds < 0.15 && toCall < bigBlind * 2 && toCall < playerStack * 0.08) {
    return {
      action: 'CALL',
      amount: toCall,
      reasoningVi: 'Theo giá rẻ thăm dò cơ hội',
    };
  }

  return { action: 'FOLD', amount: 0, reasoningVi: 'Bỏ bài không đủ mạnh' };
}
