import { Card, HandEvaluation, PotSegment } from '../logic/poker';
import { AIPersonality, DecisionType } from '../logic/ai';

export type GameMode = 'CASH' | 'TOURNAMENT' | 'ROOM';

export type TableTheme = 'EMERALD' | 'MIDNIGHT' | 'BURGUNDY' | 'CARBON';

export type TableStage =
  | 'TITLE_MENU'
  | 'PREFLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'HAND_SUMMARY'
  | 'TOURNAMENT_OVER';

export interface PlayerAction {
  type: DecisionType | 'SMALL_BLIND' | 'BIG_BLIND' | 'WIN';
  amount?: number;
  labelVi: string;
}

export interface PlayerState {
  id: string;
  name: string;
  nickname?: string;
  avatarSeed: string;
  color: string;
  isHuman: boolean;
  chips: number;
  currentBet: number; // in current street
  totalHandBet: number; // accumulated across all streets
  holeCards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  isThinking: boolean;
  lastAction: PlayerAction | null;
  botProfile?: AIPersonality;
  bestHand?: HandEvaluation;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  stage: TableStage;
  message: string;
  type: 'action' | 'deal' | 'win' | 'blind' | 'system';
}

export interface TableConfig {
  mode: GameMode;
  theme: TableTheme;
  smallBlind: number;
  bigBlind: number;
  initialChips: number;
  handCount: number;
  tournamentBlindLevel: number;
}

export interface WinnerPayout {
  playerId: string;
  playerName: string;
  amount: number;
  handNameVi: string;
  handDescriptionVi: string;
  bestFiveCards: Card[];
  potNameVi: string;
}
