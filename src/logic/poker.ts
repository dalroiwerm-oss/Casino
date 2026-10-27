/**
 * Texas Hold'em Poker Core Engine
 * Standard 52-card deck, Hand evaluation (7-card), Pot & Side-pot calculations
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export enum HandRank {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10,
}

export interface HandEvaluation {
  rank: HandRank;
  score: number; // Single comparable number for tie breaking
  nameEn: string;
  nameVi: string;
  descriptionVi: string;
  bestFive: Card[];
  tieBreakers: number[];
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<Suit, string> = {
  spades: 'text-slate-900',
  hearts: 'text-rose-600',
  diamonds: 'text-blue-600', // 4-color deck support for pro clarity (Spades: Black, Hearts: Red, Diamonds: Blue, Clubs: Green)
  clubs: 'text-emerald-700',
};

export const SUIT_NAMES_VI: Record<Suit, string> = {
  spades: 'Bích',
  hearts: 'Cơ',
  diamonds: 'Rô',
  clubs: 'Tép',
};

export const RANK_LABELS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const RANK_NAMES_VI: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J (Bồi)',
  12: 'Q (Đầm)',
  13: 'K (Già)',
  14: 'Át (A)',
};

/**
 * Creates and returns a freshly shuffled standard 52-card deck
 */
export function createDeck(): Card[] {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${rank}_${suit}`,
        suit,
        rank,
      });
    }
  }

  // Fisher-Yates Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Generate all combinations of k elements from array
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const head = arr[0];
  const tail = arr.slice(1);
  const withHead = combinations(tail, k - 1).map((comb) => [head, ...comb]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

/**
 * Evaluates exactly 5 cards
 */
export function evaluate5Cards(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error('Must provide exactly 5 cards to evaluate5Cards');
  }

  // Sort descending by rank
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Standard straight check: consecutive 5
  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHigh = ranks[0];
  } else if (
    ranks[0] === 14 &&
    ranks[1] === 5 &&
    ranks[2] === 4 &&
    ranks[3] === 3 &&
    ranks[4] === 2
  ) {
    // Wheel straight: A-2-3-4-5, Ace acts as 1, high card is 5
    isStraight = true;
    straightHigh = 5;
  }

  // Rank counts
  const countMap = new Map<Rank, number>();
  for (const r of ranks) {
    countMap.set(r, (countMap.get(r) || 0) + 1);
  }

  const counts = Array.from(countMap.entries()).sort((a, b) => {
    // sort by count descending, then by rank descending
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  // Calculate hand rank and score
  let rank = HandRank.HIGH_CARD;
  let nameEn = '';
  let nameVi = '';
  let descriptionVi = '';
  const tieBreakers: number[] = [];

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      rank = HandRank.ROYAL_FLUSH;
      nameEn = 'Royal Flush';
      nameVi = 'Thùng Phá Sảnh Thượng';
      descriptionVi = `Sảnh rồng đồng chất cao nhất (${SUIT_NAMES_VI[suits[0]]})`;
      tieBreakers.push(14);
    } else {
      rank = HandRank.STRAIGHT_FLUSH;
      nameEn = `Straight Flush, ${RANK_LABELS[straightHigh as Rank]} High`;
      nameVi = `Thùng Phá Sảnh, ${RANK_LABELS[straightHigh as Rank]} Cao`;
      descriptionVi = `Sảnh đồng chất tới ${RANK_NAMES_VI[straightHigh as Rank]}`;
      tieBreakers.push(straightHigh);
    }
  } else if (counts[0][1] === 4) {
    rank = HandRank.FOUR_OF_A_KIND;
    const fourRank = counts[0][0];
    const kicker = counts[1][0];
    nameEn = `Four of a Kind, ${RANK_LABELS[fourRank]}s`;
    nameVi = `Tứ Quý ${RANK_LABELS[fourRank]}`;
    descriptionVi = `4 lá ${RANK_NAMES_VI[fourRank]}, Kicker ${RANK_NAMES_VI[kicker]}`;
    tieBreakers.push(fourRank, kicker);
  } else if (counts[0][1] === 3 && counts[1][1] === 2) {
    rank = HandRank.FULL_HOUSE;
    const threeRank = counts[0][0];
    const pairRank = counts[1][0];
    nameEn = `Full House, ${RANK_LABELS[threeRank]}s full of ${RANK_LABELS[pairRank]}s`;
    nameVi = `Cù Lũ (${RANK_LABELS[threeRank]} và ${RANK_LABELS[pairRank]})`;
    descriptionVi = `Ba lá ${RANK_NAMES_VI[threeRank]} và đôi ${RANK_NAMES_VI[pairRank]}`;
    tieBreakers.push(threeRank, pairRank);
  } else if (isFlush) {
    rank = HandRank.FLUSH;
    nameEn = `Flush, ${RANK_LABELS[ranks[0]]} High`;
    nameVi = `Thùng (${SUIT_NAMES_VI[suits[0]]}), ${RANK_LABELS[ranks[0]]} Cao`;
    descriptionVi = `5 lá đồng chất ${SUIT_NAMES_VI[suits[0]]}, lá cao nhất là ${RANK_NAMES_VI[ranks[0]]}`;
    tieBreakers.push(...ranks);
  } else if (isStraight) {
    rank = HandRank.STRAIGHT;
    nameEn = `Straight, ${RANK_LABELS[straightHigh as Rank]} High`;
    nameVi = `Sảnh, ${RANK_LABELS[straightHigh as Rank]} Cao`;
    descriptionVi = `5 lá liên tiếp tới ${RANK_NAMES_VI[straightHigh as Rank]}`;
    tieBreakers.push(straightHigh);
  } else if (counts[0][1] === 3) {
    rank = HandRank.THREE_OF_A_KIND;
    const threeRank = counts[0][0];
    const kickers = [counts[1][0], counts[2][0]];
    nameEn = `Three of a Kind, ${RANK_LABELS[threeRank]}s`;
    nameVi = `Sám Cô ${RANK_LABELS[threeRank]}`;
    descriptionVi = `3 lá ${RANK_NAMES_VI[threeRank]}`;
    tieBreakers.push(threeRank, ...kickers);
  } else if (counts[0][1] === 2 && counts[1][1] === 2) {
    rank = HandRank.TWO_PAIR;
    const highPair = counts[0][0];
    const lowPair = counts[1][0];
    const kicker = counts[2][0];
    nameEn = `Two Pair, ${RANK_LABELS[highPair]}s and ${RANK_LABELS[lowPair]}s`;
    nameVi = `Hai Đôi (${RANK_LABELS[highPair]} & ${RANK_LABELS[lowPair]})`;
    descriptionVi = `Đôi ${RANK_NAMES_VI[highPair]} và đôi ${RANK_NAMES_VI[lowPair]}`;
    tieBreakers.push(highPair, lowPair, kicker);
  } else if (counts[0][1] === 2) {
    rank = HandRank.ONE_PAIR;
    const pairRank = counts[0][0];
    const kickers = [counts[1][0], counts[2][0], counts[3][0]];
    nameEn = `One Pair of ${RANK_LABELS[pairRank]}s`;
    nameVi = `Một Đôi ${RANK_LABELS[pairRank]}`;
    descriptionVi = `Đôi ${RANK_NAMES_VI[pairRank]}, Kicker ${RANK_NAMES_VI[kickers[0]]}`;
    tieBreakers.push(pairRank, ...kickers);
  } else {
    rank = HandRank.HIGH_CARD;
    nameEn = `High Card, ${RANK_LABELS[ranks[0]]}`;
    nameVi = `Bài Cao (Mậu Thầu) ${RANK_LABELS[ranks[0]]}`;
    descriptionVi = `Lá cao nhất ${RANK_NAMES_VI[ranks[0]]}`;
    tieBreakers.push(...ranks);
  }

  // Base score calculation for easy numeric sorting
  // Each tiebreaker is weighted by 15^(4 - index)
  let score = rank * 100000000;
  for (let i = 0; i < tieBreakers.length; i++) {
    score += tieBreakers[i] * Math.pow(15, 5 - i);
  }

  return {
    rank,
    score,
    nameEn,
    nameVi,
    descriptionVi,
    bestFive: sorted,
    tieBreakers,
  };
}

/**
 * Evaluates best 5-card hand from 5, 6, or 7 cards (standard Texas Hold'em)
 */
export function evaluateBestHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    // If only hole cards (2) or flop (2+3=5), fallback for less than 5
    if (cards.length === 2) {
      const sorted = [...cards].sort((a, b) => b.rank - a.rank);
      const isPair = sorted[0].rank === sorted[1].rank;
      return {
        rank: isPair ? HandRank.ONE_PAIR : HandRank.HIGH_CARD,
        score: isPair ? 200000000 + sorted[0].rank * 1000 : sorted[0].rank * 100 + sorted[1].rank,
        nameEn: isPair ? `Pocket Pair of ${RANK_LABELS[sorted[0].rank]}s` : `High Card ${RANK_LABELS[sorted[0].rank]}`,
        nameVi: isPair ? `Đôi Tẩy ${RANK_LABELS[sorted[0].rank]}` : `Bài Tẩy ${RANK_LABELS[sorted[0].rank]} - ${RANK_LABELS[sorted[1].rank]}`,
        descriptionVi: isPair ? `Đôi ${RANK_NAMES_VI[sorted[0].rank]} trên tay` : `Lá cao ${RANK_NAMES_VI[sorted[0].rank]} và ${RANK_NAMES_VI[sorted[1].rank]}`,
        bestFive: sorted,
        tieBreakers: sorted.map((c) => c.rank),
      };
    }
    // Partial board fallback
    return {
      rank: HandRank.HIGH_CARD,
      score: 0,
      nameEn: 'Incomplete Hand',
      nameVi: 'Chưa đủ bài',
      descriptionVi: 'Đang chờ các lá chung tiếp theo',
      bestFive: cards,
      tieBreakers: [],
    };
  }

  // All 5-card subsets
  const allCombos = combinations(cards, 5);
  let bestHand: HandEvaluation | null = null;

  for (const combo of allCombos) {
    const evalResult = evaluate5Cards(combo);
    if (!bestHand || evalResult.score > bestHand.score) {
      bestHand = evalResult;
    }
  }

  return bestHand!;
}

/**
 * Compares two hands. Returns positive if a > b, negative if b > a, 0 if tie
 */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  return a.score - b.score;
}

/**
 * Simulates Hand Equity (Win % estimate) using quick Monte Carlo sampling
 * against active opponent counts with unknown random cards.
 */
export function estimateEquity(
  holeCards: Card[],
  communityCards: Card[],
  activeOpponentsCount: number,
  samplesCount: number = 250
): { winRate: number; tieRate: number; handNameVi: string } {
  if (holeCards.length !== 2 || activeOpponentsCount <= 0) {
    return { winRate: 50, tieRate: 0, handNameVi: 'Chờ chia bài' };
  }

  const currentEval = evaluateBestHand([...holeCards, ...communityCards]);

  // Build remaining deck
  const usedCardIds = new Set([
    ...holeCards.map((c) => c.id),
    ...communityCards.map((c) => c.id),
  ]);

  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const remainingDeck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      const id = `${rank}_${suit}`;
      if (!usedCardIds.has(id)) {
        remainingDeck.push({ id, suit, rank });
      }
    }
  }

  let wins = 0;
  let ties = 0;
  const cardsNeededForBoard = 5 - communityCards.length;

  for (let s = 0; s < samplesCount; s++) {
    // Shuffle copy of remaining deck
    const deck = [...remainingDeck];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    let deckIndex = 0;

    // Complete board if needed
    const simBoard = [...communityCards];
    for (let b = 0; b < cardsNeededForBoard; b++) {
      simBoard.push(deck[deckIndex++]);
    }

    const myBest = evaluateBestHand([...holeCards, ...simBoard]);

    // Deal random hands to opponents
    let myResult = 1; // 1 = win, 0 = tie, -1 = loss
    for (let opp = 0; opp < activeOpponentsCount; opp++) {
      const oppHole = [deck[deckIndex++], deck[deckIndex++]];
      const oppBest = evaluateBestHand([...oppHole, ...simBoard]);
      const cmp = compareHands(myBest, oppBest);

      if (cmp < 0) {
        myResult = -1;
        break;
      } else if (cmp === 0 && myResult !== -1) {
        myResult = 0;
      }
    }

    if (myResult === 1) wins++;
    else if (myResult === 0) ties++;
  }

  const winRate = Math.round((wins / samplesCount) * 100);
  const tieRate = Math.round((ties / samplesCount) * 100);

  return {
    winRate,
    tieRate,
    handNameVi: currentEval.nameVi,
  };
}

/**
 * Side-pot resolution helper:
 * Calculates main pot and side pots based on player investments
 */
export interface PotSegment {
  amount: number;
  eligiblePlayerIds: string[];
}

export function calculatePots(
  contributions: { playerId: string; amount: number; folded: boolean }[]
): PotSegment[] {
  // Filter active or folded players with > 0 contributions
  const nonZero = contributions
    .filter((c) => c.amount > 0)
    .sort((a, b) => a.amount - b.amount);

  if (nonZero.length === 0) return [];

  const pots: PotSegment[] = [];
  let previousLevel = 0;

  for (let i = 0; i < nonZero.length; i++) {
    const currentLevel = nonZero[i].amount;
    const diff = currentLevel - previousLevel;

    if (diff > 0) {
      // Every player with contribution >= currentLevel adds diff to this pot segment
      let segmentAmount = 0;
      const eligible: string[] = [];

      for (const p of contributions) {
        if (p.amount > previousLevel) {
          const contributedToSegment = Math.min(p.amount - previousLevel, diff);
          segmentAmount += contributedToSegment;
          if (!p.folded) {
            eligible.push(p.playerId);
          }
        }
      }

      if (segmentAmount > 0 && eligible.length > 0) {
        pots.push({
          amount: segmentAmount,
          eligiblePlayerIds: eligible,
        });
      }
      previousLevel = currentLevel;
    }
  }

  // Merge segments with identical eligible player sets
  const mergedPots: PotSegment[] = [];
  for (const pot of pots) {
    const last = mergedPots[mergedPots.length - 1];
    if (
      last &&
      last.eligiblePlayerIds.length === pot.eligiblePlayerIds.length &&
      last.eligiblePlayerIds.every((id) => pot.eligiblePlayerIds.includes(id))
    ) {
      last.amount += pot.amount;
    } else {
      mergedPots.push({ ...pot });
    }
  }

  return mergedPots;
}
