import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Card,
  createDeck,
  evaluateBestHand,
  estimateEquity,
  calculatePots,
  PotSegment,
  compareHands,
} from '../logic/poker';
import { AI_BOTS, getAIDecision, DecisionType } from '../logic/ai';
import { sounds } from '../logic/audio';
import {
  GameMode,
  TableTheme,
  TableStage,
  PlayerState,
  LogEntry,
  WinnerPayout,
} from '../types/poker';
import { PlayerSeat } from './PlayerSeat';
import { CommunityBoard } from './CommunityBoard';
import { BettingControls } from './BettingControls';
import { EquityBar } from './EquityBar';
import { HandRankingModal } from './HandRankingModal';
import { HistoryLogModal } from './HistoryLogModal';
import { DeviceModeSelector } from './DeviceModeSelector';
import { useDeviceMode } from '../logic/device';
import { networkManager, NetworkPacket } from '../logic/network';
import { onlineHub } from '../logic/onlineHub';

interface PokerGameProps {
  mode: GameMode;
  theme: TableTheme;
  initialSmallBlind: number;
  initialBigBlind: number;
  initialBuyIn: number;
  onExitToTitle: () => void;
  heroName?: string;
  heroAvatarColor?: string;
  roomConfig?: {
    roomId: string;
    roomCode: string;
    roomName: string;
    isHost: boolean;
    turnTimeSeconds?: number;
    players: import('../logic/room').RoomPlayer[];
  };
  onStatsUpdate?: (newChips: number, isWin: boolean, potSize: number, isTournamentWin?: boolean) => void;
}

export const PokerGame: React.FC<PokerGameProps> = ({
  mode,
  theme: initialTheme,
  initialSmallBlind,
  initialBigBlind,
  initialBuyIn,
  onExitToTitle,
  heroName,
  heroAvatarColor,
  roomConfig,
  onStatsUpdate,
}) => {
  const { isMobile, isTablet, isDesktop } = useDeviceMode();
  // Config
  const [currentTheme, setCurrentTheme] = useState<TableTheme>(initialTheme);
  const [smallBlind, setSmallBlind] = useState<number>(initialSmallBlind);
  const [bigBlind, setBigBlind] = useState<number>(initialBigBlind);
  const [handCount, setHandCount] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(sounds.getMuted());
  const [roomToast, setRoomToast] = useState<string | null>(null);

  // Turn time limit in seconds
  const turnTimeLimit = roomConfig?.turnTimeSeconds || 15;
  const [heroTimeLeft, setHeroTimeLeft] = useState<number>(turnTimeLimit);

  // Modals
  const [isHandRankingsOpen, setIsHandRankingsOpen] = useState<boolean>(false);
  const [isHistoryLogOpen, setIsHistoryLogOpen] = useState<boolean>(false);
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);
  const [isRebuyModalOpen, setIsRebuyModalOpen] = useState<boolean>(false);

  // Table State
  const [stage, setStage] = useState<TableStage>('PREFLOP');
  const [dealerIdx, setDealerIdx] = useState<number>(0);
  const [activeTurnIdx, setActiveTurnIdx] = useState<number>(-1);
  const [currentBet, setCurrentBet] = useState<number>(0);
  const [minRaise, setMinRaise] = useState<number>(initialBigBlind);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [pots, setPots] = useState<PotSegment[]>([]);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [winningCardIds, setWinningCardIds] = useState<Set<string>>(new Set());
  const [payouts, setPayouts] = useState<WinnerPayout[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Pre-action for hero
  const [preAction, setPreAction] = useState<'none' | 'check_fold' | 'auto_fold' | 'call_any'>('none');

  // Stats
  const [stats, setStats] = useState({
    handsPlayed: 0,
    handsWon: 0,
    biggestPot: 0,
    netProfit: 0,
    initialChips: initialBuyIn,
  });

  // Players: if roomConfig is provided, seed from room players
  const [players, setPlayers] = useState<PlayerState[]>(() => {
    if (roomConfig && roomConfig.players && roomConfig.players.length > 0) {
      // Find hero in room
      const heroInRoom = roomConfig.players.find((p) => p.name === heroName || !p.isBot) || roomConfig.players[0];
      const otherPlayers = roomConfig.players.filter((p) => p.id !== heroInRoom.id);

      const hero: PlayerState = {
        id: heroInRoom.id,
        name: heroInRoom.name,
        nickname: heroInRoom.isHost ? 'Chủ phòng' : 'Người chơi',
        avatarSeed: heroInRoom.name,
        color: heroInRoom.avatarColor || heroAvatarColor || '#f59e0b',
        isHuman: true,
        chips: heroInRoom.chips || initialBuyIn,
        currentBet: 0,
        totalHandBet: 0,
        holeCards: [],
        isFolded: false,
        isAllIn: false,
        isThinking: false,
        lastAction: null,
      };

      const tablePlayers: PlayerState[] = [hero];

      // Add remaining room players
      otherPlayers.forEach((p, idx) => {
        const botTemplate = AI_BOTS[idx % AI_BOTS.length];
        tablePlayers.push({
          id: p.id,
          name: p.name,
          nickname: p.isHost ? 'Chủ phòng' : p.isBot ? 'Bot AI' : 'Khách mời',
          avatarSeed: p.name,
          color: p.avatarColor || botTemplate.color,
          isHuman: false,
          chips: p.chips || initialBuyIn,
          currentBet: 0,
          totalHandBet: 0,
          holeCards: [],
          isFolded: false,
          isAllIn: false,
          isThinking: false,
          lastAction: null,
          botProfile: botTemplate,
        });
      });

      return tablePlayers;
    }

    const hero: PlayerState = {
      id: 'player_hero',
      name: heroName || 'Bạn (Hero)',
      nickname: 'Người chơi',
      avatarSeed: heroName || 'Hero',
      color: heroAvatarColor || '#f59e0b',
      isHuman: true,
      chips: initialBuyIn,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      isFolded: false,
      isAllIn: false,
      isThinking: false,
      lastAction: null,
    };

    const bots: PlayerState[] = AI_BOTS.map((bot) => ({
      id: bot.id,
      name: bot.name,
      nickname: bot.nickname,
      avatarSeed: bot.avatarSeed,
      color: bot.color,
      isHuman: false,
      chips: initialBuyIn,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      isFolded: false,
      isAllIn: false,
      isThinking: false,
      lastAction: null,
      botProfile: bot,
    }));

    return [hero, ...bots];
  });

  // Track players who still need to act in current betting street
  const playersToActRef = useRef<Set<string>>(new Set());

  // Equity estimation
  const [equity, setEquity] = useState({ winRate: 50, tieRate: 0, handNameVi: 'Chưa chia bài' });

  // Add Log Entry
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'action') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      stage,
      message,
      type,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 99)]);
  }, [stage]);

  // Total pot calculation
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0) +
    players.reduce((sum, p) => sum + p.currentBet, 0);

  // Update Equity when cards or active opponents count change
  const heroCardKey = players[0]?.holeCards?.map((c) => c.id).join(',') || '';
  const communityCardKey = communityCards.map((c) => c.id).join(',');
  const activeOpponentsCount = players.filter((p, i) => i !== 0 && !p.isFolded && p.chips + p.currentBet > 0).length;

  useEffect(() => {
    const hero = players[0];
    if (hero && hero.holeCards && hero.holeCards.length === 2 && !hero.isFolded) {
      const eq = estimateEquity(hero.holeCards, communityCards, Math.max(1, activeOpponentsCount));
      setEquity((prev) => {
        if (prev.winRate === eq.winRate && prev.tieRate === eq.tieRate && prev.handNameVi === eq.handNameVi) {
          return prev;
        }
        return eq;
      });
    }
  }, [heroCardKey, communityCardKey, activeOpponentsCount]);

  // Deal a new hand
  const startNewHand = useCallback(() => {
    setWinningCardIds(new Set());
    setAnnouncement(null);
    setPayouts([]);
    setPreAction('none');

    // Check active players (with chips > 0)
    let updatedPlayers: PlayerState[] = players.map((p) => ({
      ...p,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [] as Card[],
      isFolded: p.chips <= 0,
      isAllIn: false,
      isThinking: false,
      lastAction: null,
      bestHand: undefined,
    }));

    // Check if hero has no chips
    if (updatedPlayers[0].chips <= 0) {
      if (mode === 'CASH') {
        setIsRebuyModalOpen(true);
        return;
      } else {
        // Tournament over for hero
        setStage('TOURNAMENT_OVER');
        return;
      }
    }

    // Check tournament remaining players
    const activeContenders = updatedPlayers.filter((p) => p.chips > 0);
    if (mode === 'TOURNAMENT' && activeContenders.length === 1) {
      if (activeContenders[0].isHuman) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        sounds.playWin();
      }
      setStage('TOURNAMENT_OVER');
      return;
    }

    // Tournament blind progression every 4 hands
    let currentSb = smallBlind;
    let currentBb = bigBlind;
    if (mode === 'TOURNAMENT' && (handCount + 1) % 4 === 0) {
      currentSb = Math.round(smallBlind * 1.5);
      currentBb = Math.round(bigBlind * 1.5);
      setSmallBlind(currentSb);
      setBigBlind(currentBb);
      addLog(`Giải đấu tăng mức Blind: SB $${currentSb} / BB $${currentBb}`, 'system');
    }

    // Move dealer button to next active player
    let nextDealer = (dealerIdx + 1) % updatedPlayers.length;
    while (updatedPlayers[nextDealer].chips <= 0) {
      nextDealer = (nextDealer + 1) % updatedPlayers.length;
    }
    setDealerIdx(nextDealer);

    // Create and shuffle fresh deck
    const newDeck = createDeck();
    sounds.playCardDeal();

    // Deal 2 hole cards to each active player
    let deckIdx = 0;
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < updatedPlayers.length; i++) {
        if (updatedPlayers[i].chips > 0) {
          updatedPlayers[i].holeCards.push(newDeck[deckIdx++]);
        }
      }
    }

    // Determine SB and BB positions
    let sbIdx = (nextDealer + 1) % updatedPlayers.length;
    while (updatedPlayers[sbIdx].chips <= 0) {
      sbIdx = (sbIdx + 1) % updatedPlayers.length;
    }

    let bbIdx = (sbIdx + 1) % updatedPlayers.length;
    while (updatedPlayers[bbIdx].chips <= 0) {
      bbIdx = (bbIdx + 1) % updatedPlayers.length;
    }

    // Deduct Small Blind
    const sbAmount = Math.min(updatedPlayers[sbIdx].chips, currentSb);
    updatedPlayers[sbIdx].chips -= sbAmount;
    updatedPlayers[sbIdx].currentBet = sbAmount;
    updatedPlayers[sbIdx].totalHandBet = sbAmount;
    if (updatedPlayers[sbIdx].chips === 0) updatedPlayers[sbIdx].isAllIn = true;
    updatedPlayers[sbIdx].lastAction = { type: 'SMALL_BLIND', amount: sbAmount, labelVi: 'Small Blind' };

    // Deduct Big Blind
    const bbAmount = Math.min(updatedPlayers[bbIdx].chips, currentBb);
    updatedPlayers[bbIdx].chips -= bbAmount;
    updatedPlayers[bbIdx].currentBet = bbAmount;
    updatedPlayers[bbIdx].totalHandBet = bbAmount;
    if (updatedPlayers[bbIdx].chips === 0) updatedPlayers[bbIdx].isAllIn = true;
    updatedPlayers[bbIdx].lastAction = { type: 'BIG_BLIND', amount: bbAmount, labelVi: 'Big Blind' };

    // First to act Preflop: UTG (Under The Gun - left of BB)
    let firstToAct = (bbIdx + 1) % updatedPlayers.length;
    while (updatedPlayers[firstToAct].chips <= 0 || updatedPlayers[firstToAct].isFolded) {
      firstToAct = (firstToAct + 1) % updatedPlayers.length;
    }

    // Build list of all active players who need to act this round
    const toAct = new Set<string>();
    updatedPlayers.forEach((p) => {
      if (!p.isFolded && !p.isAllIn && p.chips > 0) {
        toAct.add(p.id);
      }
    });
    playersToActRef.current = toAct;

    setDeck(newDeck.slice(deckIdx));
    setCommunityCards([]);
    setPots([]);
    setCurrentBet(currentBb);
    setMinRaise(currentBb);
    setPlayers(updatedPlayers);
    setStage('PREFLOP');
    setActiveTurnIdx(firstToAct);
    setHandCount((prev) => prev + 1);

    setStats((prev) => ({
      ...prev,
      handsPlayed: prev.handsPlayed + 1,
    }));

    addLog(`--- Bắt đầu Ván #${handCount + 1} (${mode === 'CASH' ? 'Cash' : 'Tournament'}) ---`, 'system');
    addLog(`${updatedPlayers[sbIdx].name} đặt Small Blind $${sbAmount}`, 'blind');
    addLog(`${updatedPlayers[bbIdx].name} đặt Big Blind $${bbAmount}`, 'blind');
  }, [players, dealerIdx, smallBlind, bigBlind, mode, handCount, addLog]);

  // Start initial hand on mount
  useEffect(() => {
    startNewHand();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to collect round bets into pots and advance street
  const advanceStreet = useCallback(() => {
    // Collect all bets from current street
    const contributions = players.map((p) => ({
      playerId: p.id,
      amount: p.totalHandBet,
      folded: p.isFolded,
    }));

    const calculatedPots = calculatePots(contributions);
    setPots(calculatedPots);

    // Clear currentBet on table and players
    const updatedPlayers = players.map((p) => ({
      ...p,
      currentBet: 0,
      lastAction: null,
      isThinking: false,
    }));

    // Find next street
    let nextStage: TableStage = 'FLOP';
    let cardsToDeal = 3;

    if (stage === 'PREFLOP') {
      nextStage = 'FLOP';
      cardsToDeal = 3;
    } else if (stage === 'FLOP') {
      nextStage = 'TURN';
      cardsToDeal = 1;
    } else if (stage === 'TURN') {
      nextStage = 'RIVER';
      cardsToDeal = 1;
    } else if (stage === 'RIVER') {
      nextStage = 'SHOWDOWN';
      cardsToDeal = 0;
    }

    if (cardsToDeal > 0) {
      sounds.playCardDeal();
      const newCommunity = [...communityCards, ...deck.slice(0, cardsToDeal)];
      setCommunityCards(newCommunity);
      setDeck((prev) => prev.slice(cardsToDeal));

      if (nextStage === 'FLOP') addLog('Chia 3 lá Flop', 'deal');
      else if (nextStage === 'TURN') addLog('Chia lá thứ 4 (Turn)', 'deal');
      else if (nextStage === 'RIVER') addLog('Chia lá thứ 5 (River)', 'deal');
    }

    setCurrentBet(0);
    setMinRaise(bigBlind);

    // Check if showdown or only all-ins left
    const nonFolded = updatedPlayers.filter((p) => !p.isFolded);
    const ableToBet = nonFolded.filter((p) => !p.isAllIn && p.chips > 0);

    if (nextStage === 'SHOWDOWN' || ableToBet.length <= 1) {
      // If ableToBet <= 1 and still cards left to deal, run out the remaining board!
      if (nextStage !== 'SHOWDOWN' && ableToBet.length <= 1) {
        // Run out board
        let fullCommunity = [...communityCards];
        let currentDeck = [...deck];
        while (fullCommunity.length < 5 && currentDeck.length > 0) {
          fullCommunity.push(currentDeck.shift()!);
        }
        setCommunityCards(fullCommunity);
        setDeck(currentDeck);
      }

      // Proceed to Showdown
      resolveShowdown(updatedPlayers, calculatedPots);
      return;
    }

    // Set stage and first player to act postflop (left of dealer)
    let nextToAct = (dealerIdx + 1) % updatedPlayers.length;
    while (updatedPlayers[nextToAct].isFolded || updatedPlayers[nextToAct].isAllIn || updatedPlayers[nextToAct].chips <= 0) {
      nextToAct = (nextToAct + 1) % updatedPlayers.length;
    }

    const toAct = new Set<string>();
    updatedPlayers.forEach((p) => {
      if (!p.isFolded && !p.isAllIn && p.chips > 0) {
        toAct.add(p.id);
      }
    });
    playersToActRef.current = toAct;

    setStage(nextStage);
    setPlayers(updatedPlayers);
    setActiveTurnIdx(nextToAct);
  }, [players, stage, communityCards, deck, dealerIdx, bigBlind, addLog]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve showdown and award pots
  const resolveShowdown = useCallback((currentPlayers: PlayerState[], currentPots: PotSegment[]) => {
    setStage('SHOWDOWN');
    setActiveTurnIdx(-1);

    // Evaluate best hands for all non-folded players
    const evaluatedPlayers = currentPlayers.map((p) => {
      if (p.isFolded) return p;
      const best = evaluateBestHand([...p.holeCards, ...communityCards]);
      return {
        ...p,
        bestHand: best,
      };
    });

    // Award each pot segment (main pot and side pots)
    const winningPayouts: WinnerPayout[] = [];
    const allWinningCardIds = new Set<string>();

    currentPots.forEach((pot, potIdx) => {
      const eligible = evaluatedPlayers.filter((p) =>
        pot.eligiblePlayerIds.includes(p.id) && !p.isFolded && p.bestHand
      );

      if (eligible.length === 0) return;

      // Find highest score among eligible
      eligible.sort((a, b) => compareHands(b.bestHand!, a.bestHand!));
      const topScore = eligible[0].bestHand!.score;
      const winners = eligible.filter((p) => p.bestHand!.score === topScore);

      const splitAmount = Math.floor(pot.amount / winners.length);

      winners.forEach((winner) => {
        winner.chips += splitAmount;
        winner.lastAction = { type: 'WIN', amount: splitAmount, labelVi: 'Thắng' };

        // Collect best 5 cards
        winner.bestHand!.bestFive.forEach((c) => allWinningCardIds.add(c.id));

        winningPayouts.push({
          playerId: winner.id,
          playerName: winner.name,
          amount: splitAmount,
          handNameVi: winner.bestHand!.nameVi,
          handDescriptionVi: winner.bestHand!.descriptionVi,
          bestFiveCards: winner.bestHand!.bestFive,
          potNameVi: potIdx === 0 ? 'Pot Chính' : `Side Pot ${potIdx}`,
        });

        addLog(
          `${winner.name} thắng ${potIdx === 0 ? 'Pot Chính' : `Side Pot ${potIdx}`} ($${splitAmount.toLocaleString()}) với ${winner.bestHand!.nameVi}!`,
          'win'
        );
      });
    });

    setWinningCardIds(allWinningCardIds);
    setPayouts(winningPayouts);
    setPlayers(evaluatedPlayers);

    // Check if Hero won
    const heroWon = winningPayouts.some((p) => p.playerId === 'player_hero');
    if (heroWon) {
      sounds.playWin();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      setAnnouncement('Chúc mừng! Bạn đã thắng ván bài!');
      const potTotal = currentPots.reduce((s, p) => s + p.amount, 0);
      setStats((prev) => ({
        ...prev,
        handsWon: prev.handsWon + 1,
        biggestPot: Math.max(prev.biggestPot, potTotal),
        netProfit: evaluatedPlayers[0].chips - prev.initialChips,
      }));
      onStatsUpdate?.(evaluatedPlayers[0].chips, true, potTotal);
    } else {
      const primaryWinner = winningPayouts[0];
      setAnnouncement(
        primaryWinner
          ? `${primaryWinner.playerName} thắng với ${primaryWinner.handNameVi}`
          : 'Ván bài kết thúc'
      );
      setStats((prev) => ({
        ...prev,
        netProfit: evaluatedPlayers[0].chips - prev.initialChips,
      }));
      onStatsUpdate?.(evaluatedPlayers[0].chips, false, 0);
    }

    setStage('HAND_SUMMARY');
  }, [communityCards, addLog, onStatsUpdate]);

  // When all opponents fold, the remaining player wins immediately
  const handleWalkoverWin = useCallback((winner: PlayerState) => {
    setActiveTurnIdx(-1);
    setStage('HAND_SUMMARY');

    // Total pot
    const wonPot = totalPot;
    winner.chips += wonPot;
    winner.lastAction = { type: 'WIN', amount: wonPot, labelVi: 'Thắng' };

    setAnnouncement(`${winner.name} thắng ván bài (tất cả đối thủ đã bỏ bài)!`);
    addLog(`${winner.name} thắng pot $${wonPot.toLocaleString()} do mọi đối thủ đã bỏ bài!`, 'win');

    if (winner.isHuman) {
      sounds.playWin();
      setStats((prev) => ({
        ...prev,
        handsWon: prev.handsWon + 1,
        biggestPot: Math.max(prev.biggestPot, wonPot),
        netProfit: winner.chips - prev.initialChips,
      }));
      onStatsUpdate?.(winner.chips, true, wonPot);
    } else {
      onStatsUpdate?.(players[0].chips, false, 0);
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === winner.id ? { ...p, chips: winner.chips, lastAction: winner.lastAction } : p))
    );
  }, [totalPot, addLog, onStatsUpdate, players]);

  // Move action to next active player or advance street
  const advanceTurn = useCallback((updatedPlayers: PlayerState[], newCurrentBet: number, newMinRaise: number) => {
    // Check if only 1 non-folded player remains
    const nonFolded = updatedPlayers.filter((p) => !p.isFolded);
    if (nonFolded.length === 1) {
      handleWalkoverWin(nonFolded[0]);
      return;
    }

    // Check if betting round is complete:
    // Round is complete when everyone in playersToAct has acted and all non-folded players have matching bets (or all-in)
    const activeContenders = updatedPlayers.filter((p) => !p.isFolded && !p.isAllIn && p.chips > 0);
    const allBetsMatched = activeContenders.every((p) => p.currentBet === newCurrentBet);

    if (playersToActRef.current.size === 0 && allBetsMatched) {
      // Betting round complete -> advance to next street!
      advanceStreet();
      return;
    }

    // If activeContenders <= 1 and everyone has matched or is all in, advance
    if (activeContenders.length <= 1 && allBetsMatched) {
      advanceStreet();
      return;
    }

    // Move to next player in rotation who is not folded, not all in, and has chips
    let nextIdx = (activeTurnIdx + 1) % updatedPlayers.length;
    let loopCount = 0;
    while (
      (updatedPlayers[nextIdx].isFolded ||
        updatedPlayers[nextIdx].isAllIn ||
        updatedPlayers[nextIdx].chips <= 0) &&
      loopCount < updatedPlayers.length * 2
    ) {
      nextIdx = (nextIdx + 1) % updatedPlayers.length;
      loopCount++;
    }

    setActiveTurnIdx(nextIdx);
  }, [activeTurnIdx, advanceStreet, handleWalkoverWin]);

  // Handle Action execution for any player
  const executeAction = useCallback((
    playerId: string,
    action: DecisionType,
    amount: number = 0,
    labelVi: string = ''
  ) => {
    setPlayers((currentPlayers) => {
      const playerIdx = currentPlayers.findIndex((p) => p.id === playerId);
      if (playerIdx === -1) return currentPlayers;

      const player = currentPlayers[playerIdx];
      let newCurrentBet = currentBet;
      let newMinRaise = minRaise;
      const updated = [...currentPlayers];

      // Remove player from toAct set
      playersToActRef.current.delete(playerId);

      if (action === 'FOLD') {
        updated[playerIdx] = {
          ...player,
          isFolded: true,
          isThinking: false,
          lastAction: { type: 'FOLD', labelVi: 'Bỏ bài' },
        };
        addLog(`${player.name} bỏ bài (Fold)`, 'action');
      } else if (action === 'CHECK') {
        updated[playerIdx] = {
          ...player,
          isThinking: false,
          lastAction: { type: 'CHECK', labelVi: 'Xem bài' },
        };
        addLog(`${player.name} xem bài (Check)`, 'action');
      } else if (action === 'CALL') {
        const toCall = Math.min(amount, player.chips);
        const actualCall = Math.max(0, toCall);
        const newStack = player.chips - actualCall;
        const newCurrentPlayerBet = player.currentBet + actualCall;
        const isAllIn = newStack === 0;

        updated[playerIdx] = {
          ...player,
          chips: newStack,
          currentBet: newCurrentPlayerBet,
          totalHandBet: player.totalHandBet + actualCall,
          isAllIn,
          isThinking: false,
          lastAction: { type: isAllIn ? 'ALL_IN' : 'CALL', amount: actualCall, labelVi: isAllIn ? 'Tất tay theo' : 'Theo' },
        };
        addLog(`${player.name} theo $${actualCall.toLocaleString()}`, 'action');
      } else if (action === 'RAISE' || action === 'ALL_IN') {
        // Total target bet
        const targetBet = amount;
        const additionalChips = targetBet - player.currentBet;
        const actualAddition = Math.min(additionalChips, player.chips);
        const newStack = player.chips - actualAddition;
        const finalBet = player.currentBet + actualAddition;
        const isAllIn = newStack === 0 || action === 'ALL_IN';

        const raiseDifference = finalBet - currentBet;
        if (raiseDifference > minRaise) {
          newMinRaise = raiseDifference;
        }

        newCurrentBet = finalBet;

        // Since there is a raise, all other active contenders must act again!
        const reAct = new Set<string>();
        currentPlayers.forEach((p) => {
          if (p.id !== playerId && !p.isFolded && !p.isAllIn && p.chips > 0) {
            reAct.add(p.id);
          }
        });
        playersToActRef.current = reAct;

        updated[playerIdx] = {
          ...player,
          chips: newStack,
          currentBet: finalBet,
          totalHandBet: player.totalHandBet + actualAddition,
          isAllIn,
          isThinking: false,
          lastAction: {
            type: isAllIn ? 'ALL_IN' : 'RAISE',
            amount: finalBet,
            labelVi: isAllIn ? 'Tất tay' : `Tố $${finalBet}`,
          },
        };

        setCurrentBet(newCurrentBet);
        setMinRaise(newMinRaise);

        addLog(
          `${player.name} ${isAllIn ? 'Tất tay (All-in)' : 'Tố (Raise)'} lên $${finalBet.toLocaleString()}`,
          'action'
        );
      }

      // Broadcast action if inside a room
      if (roomConfig && playerId === currentPlayers[0].id) {
        networkManager.broadcast('PK_REMOTE_ACTION', { id: playerId, name: player.name }, {
          action,
          amount,
          labelVi,
        });
        onlineHub.sendGameEvent(roomConfig.roomId, 'PK_REMOTE_ACTION', { id: playerId, name: player.name }, {
          action,
          amount,
          labelVi,
        });
      }

      // Schedule advance turn
      setTimeout(() => {
        advanceTurn(updated, newCurrentBet, newMinRaise);
      }, 400);

      return updated;
    });
  }, [currentBet, minRaise, advanceTurn, addLog, roomConfig]);

  // Listen to remote P2P WebRTC actions in Poker room + Dual Channel Central Server
  const lastPokerEventTimeRef = useRef<number>(Date.now() - 10000);
  const processedPokerEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!roomConfig) return;
    const unsub = networkManager.onPacket((packet: NetworkPacket) => {
      if (packet.type === 'PK_REMOTE_ACTION' && packet.senderId !== players[0]?.id) {
        const { action, amount, labelVi } = packet.payload;
        executeActionRef.current(packet.senderId, action, amount, labelVi);
      }
    });

    const pollInterval = setInterval(async () => {
      try {
        const events = await onlineHub.getGameEvents(roomConfig.roomId, lastPokerEventTimeRef.current);
        if (!events || events.length === 0) return;
        for (const ev of events) {
          if (processedPokerEventIdsRef.current.has(ev.id)) continue;
          processedPokerEventIdsRef.current.add(ev.id);
          if (ev.timestamp > lastPokerEventTimeRef.current) {
            lastPokerEventTimeRef.current = ev.timestamp;
          }
          if (ev.type === 'PK_REMOTE_ACTION' && ev.senderId !== players[0]?.id) {
            const { action, amount, labelVi } = ev.payload;
            executeActionRef.current(ev.senderId, action, amount, labelVi);
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1200);

    return () => {
      unsub();
      clearInterval(pollInterval);
    };
  }, [roomConfig, players]);

  // Keep stable refs to latest values to prevent effect re-trigger loops
  const stateRef = useRef({
    players,
    currentBet,
    minRaise,
    bigBlind,
    totalPot,
    communityCards,
    preAction,
  });

  useEffect(() => {
    stateRef.current = {
      players,
      currentBet,
      minRaise,
      bigBlind,
      totalPot,
      communityCards,
      preAction,
    };
  });

  const executeActionRef = useRef(executeAction);
  useEffect(() => {
    executeActionRef.current = executeAction;
  });

  // Hero Turn Countdown Timer: Enforces turnTimeSeconds with auto-fold/check on expiry
  useEffect(() => {
    if (activeTurnIdx !== 0 || stage === 'SHOWDOWN' || stage === 'HAND_SUMMARY' || stage === 'TOURNAMENT_OVER') {
      setHeroTimeLeft(turnTimeLimit);
      return;
    }

    setHeroTimeLeft(turnTimeLimit);
    const interval = setInterval(() => {
      setHeroTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Timeout auto action
          const current = stateRef.current;
          const hero = current.players[0];
          if (hero && !hero.isFolded) {
            const toCall = current.currentBet - hero.currentBet;
            if (toCall <= 0) {
              sounds.playCheck();
              executeActionRef.current(hero.id, 'CHECK');
            } else {
              sounds.playFold();
              executeActionRef.current(hero.id, 'FOLD');
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTurnIdx, stage, turnTimeLimit]);

  // Turn management & AI Bot runner
  useEffect(() => {
    if (activeTurnIdx === -1 || stage === 'SHOWDOWN' || stage === 'HAND_SUMMARY' || stage === 'TOURNAMENT_OVER') {
      return;
    }

    const currentPlayer = players[activeTurnIdx];
    if (!currentPlayer || currentPlayer.isFolded || currentPlayer.isAllIn || currentPlayer.chips <= 0) {
      return;
    }

    // HERO TURN: Check pre-action
    if (currentPlayer.isHuman) {
      const toCall = currentBet - currentPlayer.currentBet;

      if (preAction === 'auto_fold') {
        setPreAction('none');
        sounds.playFold();
        executeActionRef.current(currentPlayer.id, 'FOLD');
        return;
      }

      if (preAction === 'check_fold') {
        setPreAction('none');
        if (toCall <= 0) {
          sounds.playCheck();
          executeActionRef.current(currentPlayer.id, 'CHECK');
        } else {
          sounds.playFold();
          executeActionRef.current(currentPlayer.id, 'FOLD');
        }
        return;
      }

      if (preAction === 'call_any') {
        setPreAction('none');
        if (toCall <= 0) {
          sounds.playCheck();
          executeActionRef.current(currentPlayer.id, 'CHECK');
        } else {
          sounds.playChips();
          executeActionRef.current(currentPlayer.id, 'CALL', toCall);
        }
        return;
      }

      // Otherwise wait for user manual click/keypress
      return;
    }

    // BOT TURN: Artificial thinking delay with animated indicator
    // Only update isThinking if it is not already true to prevent infinite render loops
    if (!currentPlayer.isThinking) {
      setPlayers((prev) =>
        prev.map((p, idx) => (idx === activeTurnIdx ? { ...p, isThinking: true } : p))
      );
    }

    const thinkingTime = 700 + Math.random() * 800; // 0.7s - 1.5s delay
    const timer = setTimeout(() => {
      const current = stateRef.current;
      const currentBotPlayer = current.players[activeTurnIdx];
      if (!currentBotPlayer || !currentBotPlayer.botProfile) return;

      const decision = getAIDecision({
        bot: currentBotPlayer.botProfile,
        holeCards: currentBotPlayer.holeCards,
        communityCards: current.communityCards,
        currentBet: current.currentBet,
        playerBetThisRound: currentBotPlayer.currentBet,
        playerStack: currentBotPlayer.chips,
        potSize: current.totalPot,
        bigBlind: current.bigBlind,
        minRaise: current.minRaise,
        playersInHandCount: current.players.filter((p) => !p.isFolded).length,
      });

      // Play corresponding sound
      if (decision.action === 'FOLD') sounds.playFold();
      else if (decision.action === 'CHECK') sounds.playCheck();
      else if (decision.action === 'CALL') sounds.playChips();
      else if (decision.action === 'ALL_IN') sounds.playAllIn();
      else if (decision.action === 'RAISE') sounds.playChips();

      executeActionRef.current(currentBotPlayer.id, decision.action, decision.amount, decision.reasoningVi);
    }, thinkingTime);

    return () => clearTimeout(timer);
  }, [activeTurnIdx, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // User Action Handlers
  const handleHeroFold = () => {
    executeAction(players[0].id, 'FOLD');
  };

  const handleHeroCheck = () => {
    executeAction(players[0].id, 'CHECK');
  };

  const handleHeroCall = (amount: number) => {
    executeAction(players[0].id, 'CALL', amount);
  };

  const handleHeroRaise = (amount: number) => {
    executeAction(players[0].id, 'RAISE', amount);
  };

  const handleHeroAllIn = () => {
    executeAction(players[0].id, 'ALL_IN', players[0].chips + players[0].currentBet);
  };

  // Rebuy handler for Cash Game
  const handleRebuy = (rebuyChips: number) => {
    sounds.playChips();
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === 0 ? { ...p, chips: rebuyChips, isFolded: false } : p))
    );
    setIsRebuyModalOpen(false);
    startNewHand();
  };

  // Felt color theme styles
  const getFeltThemeClass = () => {
    switch (currentTheme) {
      case 'EMERALD':
        return 'from-emerald-950 via-emerald-800 to-emerald-950 border-emerald-900';
      case 'MIDNIGHT':
        return 'from-blue-950 via-indigo-950 to-slate-950 border-indigo-950';
      case 'BURGUNDY':
        return 'from-rose-950 via-red-950 to-stone-950 border-rose-900';
      case 'CARBON':
        return 'from-zinc-900 via-neutral-900 to-black border-zinc-800';
    }
  };

  const hero = players[0];
  const isHeroTurn = activeTurnIdx === 0;
  const isShowdown = stage === 'SHOWDOWN' || stage === 'HAND_SUMMARY';

  return (
    <div className="relative w-full min-h-[100dvh] max-w-full bg-slate-950 text-white flex flex-col justify-between overflow-x-hidden overflow-y-auto select-none">
      {/* Top Bar HUD */}
      <header className="relative z-30 flex items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-slate-950/90 border-b border-slate-800 backdrop-blur-md">
        {/* Brand Zone */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onExitToTitle}
            className="text-xs sm:text-sm font-bold text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1.5 min-h-[40px] rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <span>←</span>
            <span className="hidden sm:inline">Rời Bàn</span>
          </button>
          <span className="text-xs sm:text-sm font-black font-serif tracking-wider text-amber-400 whitespace-nowrap">
            ♠ TEXAS HOLD'EM
          </span>
          <span className="hidden xs:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
            {mode === 'ROOM' ? 'PHÒNG CHƠI' : mode === 'CASH' ? 'CASH' : 'SIT & GO'}
          </span>
          {roomConfig && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(roomConfig.roomCode);
                  setRoomToast(`Đã sao chép mã phòng: ${roomConfig.roomCode}`);
                  setTimeout(() => setRoomToast(null), 3000);
                }
              }}
              title="Nhấn để sao chép mã phòng gửi bạn bè"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs transition-colors active:scale-95 whitespace-nowrap"
            >
              <span>🏠</span>
              <span>#{roomConfig.roomCode}</span>
              <span className="text-[10px] text-amber-400/80 underline hidden sm:inline">Sao chép</span>
            </button>
          )}
        </div>

        {/* Center Game Status & Device Mode Switcher (Tablet / Desktop) */}
        <div className="flex items-center gap-2 sm:gap-4">
          <DeviceModeSelector compact={true} />
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-mono">
            <div>
              <span>Blinds: </span>
              <span className="text-emerald-400 font-bold tabular-nums">
                ${smallBlind} / ${bigBlind}
              </span>
            </div>
            <div>
              <span>Ván: </span>
              <span className="text-slate-200 font-bold tabular-nums">#{handCount}</span>
            </div>
            <div>
              <span>Còn lại: </span>
              <span className="text-amber-300 font-bold tabular-nums">
                {players.filter((p) => p.chips > 0 || p.currentBet > 0).length}/6 Người
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mute button */}
          <button
            onClick={() => {
              const nextMute = !isMuted;
              sounds.setMuted(nextMute);
              setIsMuted(nextMute);
            }}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-bold"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          {/* Theme switcher */}
          <button
            onClick={() => {
              const themes: TableTheme[] = ['EMERALD', 'MIDNIGHT', 'BURGUNDY', 'CARBON'];
              const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
              setCurrentTheme(themes[nextIdx]);
            }}
            title="Đổi màu bàn nỉ"
            className="hidden sm:inline-block px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors whitespace-nowrap min-h-[36px]"
          >
            Màu Nỉ
          </button>

          {/* Log History */}
          <button
            onClick={() => setIsHistoryLogOpen(true)}
            className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors whitespace-nowrap min-h-[36px]"
          >
            Nhật Ký
          </button>

          {/* Hand Rankings */}
          <button
            onClick={() => setIsHandRankingsOpen(true)}
            className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors whitespace-nowrap min-h-[36px]"
          >
            Hạng Bài
          </button>
        </div>
      </header>

      {/* Room Toast Notification */}
      {roomToast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 border border-yellow-300">
          <span>✓</span>
          <span>{roomToast}</span>
        </div>
      )}

      {/* Main Poker Room / Table Area */}
      <main className="relative flex-1 flex items-center justify-center p-1 sm:p-6 overflow-hidden">
        {/* Realistic Oval Casino Poker Table with Dedicated Desktop, Tablet, and Mobile Formats */}
        <div
          className={`relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex items-center justify-center border-[#271810] ring-2 sm:ring-4 ring-black/80 transition-all duration-300 ${
            isMobile
              ? 'w-full max-w-sm aspect-[4/5] min-h-[430px] max-h-[560px] rounded-[55px] p-1.5 border-[6px]'
              : isTablet
              ? 'w-full max-w-3xl aspect-[16/10] min-h-[480px] max-h-[590px] rounded-[160px] p-4 border-[12px]'
              : 'w-full max-w-5xl aspect-[16/9] max-h-[640px] rounded-[220px] p-6 border-[18px]'
          }`}
        >
          {/* Leather Armrest Racetrack Shadow & Stitching */}
          <div
            className={`absolute inset-0 pointer-events-none shadow-inner border-2 border-amber-950/40 ${
              isMobile ? 'rounded-[46px]' : isTablet ? 'rounded-[145px]' : 'rounded-[200px]'
            }`}
          />

          {/* Velvet/Felt Table Surface with Radial Depth */}
          <div
            className={`relative w-full h-full bg-gradient-to-b ${getFeltThemeClass()} shadow-[inset_0_10px_40px_rgba(0,0,0,0.85)] border border-white/10 flex items-center justify-center overflow-hidden ${
              isMobile ? 'rounded-[42px]' : isTablet ? 'rounded-[140px]' : 'rounded-[190px]'
            }`}
          >
            {/* Felt Texture Grain Simulation Filter */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Elliptical Gold Inlay Betting Line */}
            <div
              className={`absolute border border-amber-400/20 pointer-events-none ${
                isMobile
                  ? 'w-[90%] h-[84%] rounded-[38px]'
                  : isTablet
                  ? 'w-[84%] h-[78%] rounded-[130px]'
                  : 'w-[80%] h-[74%] rounded-[160px]'
              }`}
            />

            {/* Central Community Cards & Pot */}
            <CommunityBoard
              communityCards={communityCards}
              totalPot={totalPot}
              pots={pots}
              stage={stage}
              winningCardIds={winningCardIds}
              announcement={announcement}
            />

            {/* 6 PLAYER SEATS AROUND THE OVAL TABLE */}
            {/* Seat 3: Top Center (Opponent 3) */}
            <div className="absolute top-1 sm:top-4 left-1/2 -translate-x-1/2 z-20">
              <PlayerSeat
                player={players[3]}
                isCurrentTurn={activeTurnIdx === 3}
                isDealer={dealerIdx === 3}
                isSmallBlind={(dealerIdx + 1) % 6 === 3}
                isBigBlind={(dealerIdx + 2) % 6 === 3}
                showCardsFaceUp={isShowdown}
                winningCardIds={winningCardIds}
                seatPosition="top"
              />
            </div>

            {/* Seat 2: Top Left (Opponent 2) */}
            <div className="absolute top-10 sm:top-12 left-0.5 sm:left-14 z-20">
              <PlayerSeat
                player={players[2]}
                isCurrentTurn={activeTurnIdx === 2}
                isDealer={dealerIdx === 2}
                isSmallBlind={(dealerIdx + 1) % 6 === 2}
                isBigBlind={(dealerIdx + 2) % 6 === 2}
                showCardsFaceUp={isShowdown}
                winningCardIds={winningCardIds}
                seatPosition="left-top"
              />
            </div>

            {/* Seat 4: Top Right (Opponent 4) */}
            <div className="absolute top-10 sm:top-12 right-0.5 sm:right-14 z-20">
              <PlayerSeat
                player={players[4]}
                isCurrentTurn={activeTurnIdx === 4}
                isDealer={dealerIdx === 4}
                isSmallBlind={(dealerIdx + 1) % 6 === 4}
                isBigBlind={(dealerIdx + 2) % 6 === 4}
                showCardsFaceUp={isShowdown}
                winningCardIds={winningCardIds}
                seatPosition="right-top"
              />
            </div>

            {/* Seat 1: Bottom Left (Opponent 1) */}
            <div className="absolute bottom-16 sm:bottom-14 left-0.5 sm:left-14 z-20">
              <PlayerSeat
                player={players[1]}
                isCurrentTurn={activeTurnIdx === 1}
                isDealer={dealerIdx === 1}
                isSmallBlind={(dealerIdx + 1) % 6 === 1}
                isBigBlind={(dealerIdx + 2) % 6 === 1}
                showCardsFaceUp={isShowdown}
                winningCardIds={winningCardIds}
                seatPosition="left-bottom"
              />
            </div>

            {/* Seat 5: Bottom Right (Opponent 5) */}
            <div className="absolute bottom-16 sm:bottom-14 right-0.5 sm:right-14 z-20">
              <PlayerSeat
                player={players[5]}
                isCurrentTurn={activeTurnIdx === 5}
                isDealer={dealerIdx === 5}
                isSmallBlind={(dealerIdx + 1) % 6 === 5}
                isBigBlind={(dealerIdx + 2) % 6 === 5}
                showCardsFaceUp={isShowdown}
                winningCardIds={winningCardIds}
                seatPosition="right-bottom"
              />
            </div>

            {/* Seat 0: Hero (Bottom Center) */}
            <div className="absolute bottom-0.5 sm:bottom-2 left-1/2 -translate-x-1/2 z-20">
              <PlayerSeat
                player={hero}
                isCurrentTurn={isHeroTurn}
                isDealer={dealerIdx === 0}
                isSmallBlind={(dealerIdx + 1) % 6 === 0}
                isBigBlind={(dealerIdx + 2) % 6 === 0}
                showCardsFaceUp={true}
                winningCardIds={winningCardIds}
                seatPosition="hero"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Area: Equity Bar & Hero Controls or Hand Over summary */}
      <footer className="relative z-30 p-2 sm:p-4 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-md flex flex-col gap-2">
        {/* Equity & Hand Strength Bar (shown during active play) */}
        {!isShowdown && hero.holeCards.length === 2 && !hero.isFolded && (
          <EquityBar
            winRate={equity.winRate}
            tieRate={equity.tieRate}
            handNameVi={equity.handNameVi}
            stageNameVi={stage}
          />
        )}

        {/* Hand Summary: Next Hand Button */}
        {stage === 'HAND_SUMMARY' && (
          <div className="w-full max-w-md mx-auto p-3 bg-slate-900 border border-amber-500/60 rounded-xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in">
            <div className="text-xs">
              <div className="font-bold text-amber-300">
                {announcement || 'Ván bài đã xong'}
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Nhấn bắt đầu để chia ván tiếp theo
              </div>
            </div>
            <button
              onClick={startNewHand}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm uppercase shadow-lg shadow-amber-500/30 transition-all whitespace-nowrap"
            >
              Ván Mới [Space]
            </button>
          </div>
        )}

        {/* Active Betting Controls for Hero */}
        {stage !== 'HAND_SUMMARY' && stage !== 'TOURNAMENT_OVER' && !hero.isFolded && (
          <>
            {isHeroTurn && (
              <div className="w-full max-w-lg mx-auto mb-1.5 px-3 py-1.5 bg-slate-900/95 border border-amber-500/50 rounded-xl backdrop-blur-md flex items-center justify-between gap-3 shadow-lg shadow-amber-500/10 animate-in fade-in">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-300">⏱ Thời Gian Lượt:</span>
                  <span
                    className={`font-mono text-sm font-black px-1.5 py-0.5 rounded ${
                      heroTimeLeft <= 5
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                        : heroTimeLeft <= 10
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {heroTimeLeft}s
                  </span>
                </div>
                <div className="flex-1 max-w-[200px] h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                  <div
                    className={`h-full transition-all duration-1000 rounded-full ${
                      heroTimeLeft <= 5
                        ? 'bg-rose-500 animate-pulse'
                        : heroTimeLeft <= 10
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, (heroTimeLeft / turnTimeLimit) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  Tự động khi hết giờ
                </span>
              </div>
            )}
            <BettingControls
            isHeroTurn={isHeroTurn}
            heroChips={hero.chips}
            currentBet={currentBet}
            heroBetThisRound={hero.currentBet}
            potSize={totalPot}
            bigBlind={bigBlind}
            minRaise={minRaise}
            preAction={preAction}
            setPreAction={setPreAction}
            onFold={handleHeroFold}
            onCheck={handleHeroCheck}
            onCall={handleHeroCall}
            onRaise={handleHeroRaise}
            onAllIn={handleHeroAllIn}
          />
          </>
        )}
      </footer>

      {/* Tournament Over Modal */}
      {stage === 'TOURNAMENT_OVER' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border-2 border-amber-500 rounded-2xl text-center shadow-2xl">
            <div className="text-4xl mb-2">🏆</div>
            <h2 className="text-2xl font-black text-amber-400 font-serif mb-2">
              {hero.chips > 0 ? 'QUÁN QUÂN GIẢI ĐẤU!' : 'KẾT THÚC GIẢI ĐẤU'}
            </h2>
            <p className="text-sm text-slate-300 mb-6">
              {hero.chips > 0
                ? 'Xuất sắc! Bạn đã đánh bại tất cả 5 đối thủ và giành chức vô địch Texas Hold\'em!'
                : 'Bạn đã hết chip trong giải đấu. Hãy luyện tập thêm để chinh phục chiếc cúp vô địch!'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onExitToTitle}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors"
              >
                Về Màn Hình Chính
              </button>
              <button
                onClick={() => {
                  setPlayers((prev) =>
                    prev.map((p) => ({ ...p, chips: initialBuyIn, isFolded: false }))
                  );
                  setHandCount(0);
                  startNewHand();
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-colors shadow-lg"
              >
                Đấu Giải Mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Game Rebuy Modal */}
      {isRebuyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-amber-500/70 rounded-2xl text-center shadow-2xl">
            <div className="text-3xl mb-2">💸</div>
            <h2 className="text-xl font-bold text-white mb-2">Bạn Đã Hết Chip!</h2>
            <p className="text-xs text-slate-300 mb-6">
              Trong bàn chơi Cash Game, bạn có thể nạp thêm chip để tiếp tục cuộc so tài với các cao thủ.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[initialBuyIn, initialBuyIn * 2, initialBuyIn * 5].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleRebuy(amount)}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-sm border border-slate-700 transition-all"
                >
                  +${amount.toLocaleString()}
                </button>
              ))}
            </div>
            <button
              onClick={onExitToTitle}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Rời bàn về màn hình chính
            </button>
          </div>
        </div>
      )}

      {/* Hand Ranking Cheat Sheet Modal */}
      <HandRankingModal
        isOpen={isHandRankingsOpen}
        onClose={() => setIsHandRankingsOpen(false)}
      />

      {/* History Log Modal */}
      <HistoryLogModal
        isOpen={isHistoryLogOpen}
        onClose={() => setIsHistoryLogOpen(false)}
        logs={logs}
      />
    </div>
  );
};
