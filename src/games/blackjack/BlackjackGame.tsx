import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../../logic/audio';
import { Card, Suit, Rank, createDeck } from '../../logic/poker';
import { CardView } from '../../components/CardView';
import { UserProfile } from '../../logic/auth';
import { DeviceModeSelector } from '../../components/DeviceModeSelector';
import { useDeviceMode } from '../../logic/device';

interface BlackjackGameProps {
  currentUser: UserProfile | null;
  onUpdateChips: (newChips: number, wonAmount: number) => void;
  onExit: () => void;
  onRequireRegister: () => void;
}

export type HandStatus = 'PLAYING' | 'STOOD' | 'BUST' | 'BLACKJACK' | 'WIN' | 'LOSE' | 'PUSH';

export interface BlackjackHand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  score: number;
  isSoft: boolean;
}

// Calculate blackjack hand score
export function calculateBlackjackScore(cards: Card[]): { score: number; isSoft: boolean; isBlackjack: boolean } {
  let score = 0;
  let aces = 0;

  for (const c of cards) {
    if (c.rank >= 10 && c.rank <= 13) {
      score += 10;
    } else if (c.rank === 14) {
      score += 11;
      aces++;
    } else {
      score += c.rank;
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  const isSoft = aces > 0;
  const isBlackjack = cards.length === 2 && score === 21;

  return { score, isSoft, isBlackjack };
}

const CHIP_DENOMS = [10, 25, 50, 100, 250, 500, 1000];

export const BlackjackGame: React.FC<BlackjackGameProps> = ({
  currentUser,
  onUpdateChips,
  onExit,
  onRequireRegister,
}) => {
  const [chips, setChips] = useState<number>(currentUser?.chips || 2500);
  const [deck, setDeck] = useState<Card[]>(() => createDeck());
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [dealerRevealed, setDealerRevealed] = useState<boolean>(false);
  const [playerHands, setPlayerHands] = useState<BlackjackHand[]>([]);
  const [activeHandIdx, setActiveHandIdx] = useState<number>(0);
  const [gameStage, setGameStage] = useState<'BETTING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'ROUND_OVER'>('BETTING');
  const [currentBet, setCurrentBet] = useState<number>(50);
  const [roundMessage, setRoundMessage] = useState<string>('');
  const [dealingIndex, setDealingIndex] = useState<number>(0);

  // Sync user chips
  useEffect(() => {
    if (currentUser?.chips !== undefined) {
      setChips(currentUser.chips);
    }
  }, [currentUser?.chips]);

  // Deal fresh round
  const dealNewRound = () => {
    if (!currentUser) {
      onRequireRegister();
      return;
    }

    if (chips < currentBet) {
      sounds.playFold();
      alert('Không đủ chip để đặt cược!');
      return;
    }

    sounds.playChips();

    // Rebuild deck if low
    let activeDeck = [...deck];
    if (activeDeck.length < 15) {
      activeDeck = createDeck();
    }

    const updatedChips = chips - currentBet;
    setChips(updatedChips);
    onUpdateChips(updatedChips, -currentBet);

    // Deal cards with staggered animation
    const pCard1 = activeDeck.shift()!;
    const dCard1 = activeDeck.shift()!;
    const pCard2 = activeDeck.shift()!;
    const dCard2 = activeDeck.shift()!;

    const pEval = calculateBlackjackScore([pCard1, pCard2]);
    const dEval = calculateBlackjackScore([dCard1, dCard2]);

    const initialPlayerHand: BlackjackHand = {
      cards: [pCard1, pCard2],
      bet: currentBet,
      status: pEval.isBlackjack ? 'BLACKJACK' : 'PLAYING',
      score: pEval.score,
      isSoft: pEval.isSoft,
    };

    setDeck(activeDeck);
    setDealerCards([dCard1, dCard2]);
    setDealerRevealed(false);
    setPlayerHands([initialPlayerHand]);
    setActiveHandIdx(0);
    setRoundMessage('');
    sounds.playCardDeal();

    if (pEval.isBlackjack) {
      // Natural Blackjack!
      setTimeout(() => {
        setDealerRevealed(true);
        if (dEval.isBlackjack) {
          initialPlayerHand.status = 'PUSH';
          setGameStage('ROUND_OVER');
          setRoundMessage('HÒA! CẢ HAI BÊN ĐỀU CÓ XÌ DÁCH (BLACKJACK PUSH)!');
          const refund = updatedChips + currentBet;
          setChips(refund);
          onUpdateChips(refund, 0);
        } else {
          sounds.playWin();
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          initialPlayerHand.status = 'WIN';
          setGameStage('ROUND_OVER');
          const winAmt = Math.round(currentBet * 1.5);
          setRoundMessage(`🔥 XÌ DÁCH (BLACKJACK)! THẮNG 3:2 (+ $${winAmt.toLocaleString()})! 🔥`);
          const payout = updatedChips + currentBet + winAmt;
          setChips(payout);
          onUpdateChips(payout, winAmt);
        }
      }, 600);
    } else {
      setGameStage('PLAYER_TURN');
    }
  };

  // Player Action: Hit
  const handleHit = () => {
    if (gameStage !== 'PLAYER_TURN') return;
    sounds.playCardDeal();

    const activeDeck = [...deck];
    const newCard = activeDeck.shift()!;

    setPlayerHands((prev) => {
      const hands = [...prev];
      const cur = hands[activeHandIdx];
      const newCards = [...cur.cards, newCard];
      const evalRes = calculateBlackjackScore(newCards);

      cur.cards = newCards;
      cur.score = evalRes.score;
      cur.isSoft = evalRes.isSoft;

      if (evalRes.score > 21) {
        cur.status = 'BUST';
        sounds.playFold();
        moveToNextHandOrDealer(hands, activeHandIdx);
      } else if (evalRes.score === 21) {
        cur.status = 'STOOD';
        moveToNextHandOrDealer(hands, activeHandIdx);
      }

      return hands;
    });

    setDeck(activeDeck);
  };

  // Player Action: Stand
  const handleStand = () => {
    if (gameStage !== 'PLAYER_TURN') return;
    sounds.playCheck();

    setPlayerHands((prev) => {
      const hands = [...prev];
      hands[activeHandIdx].status = 'STOOD';
      moveToNextHandOrDealer(hands, activeHandIdx);
      return hands;
    });
  };

  // Player Action: Double Down
  const handleDouble = () => {
    if (gameStage !== 'PLAYER_TURN') return;
    const curHand = playerHands[activeHandIdx];

    if (chips < curHand.bet) {
      alert('Không đủ chip để Gấp đôi cược!');
      return;
    }

    sounds.playChips();
    const updatedChips = chips - curHand.bet;
    setChips(updatedChips);
    onUpdateChips(updatedChips, -curHand.bet);

    const activeDeck = [...deck];
    const newCard = activeDeck.shift()!;

    setPlayerHands((prev) => {
      const hands = [...prev];
      const cur = hands[activeHandIdx];
      cur.bet *= 2;
      cur.cards = [...cur.cards, newCard];
      const evalRes = calculateBlackjackScore(cur.cards);
      cur.score = evalRes.score;
      cur.isSoft = evalRes.isSoft;
      cur.status = evalRes.score > 21 ? 'BUST' : 'STOOD';

      moveToNextHandOrDealer(hands, activeHandIdx);
      return hands;
    });

    setDeck(activeDeck);
  };

  // Move to next hand or dealer turn
  const moveToNextHandOrDealer = (hands: BlackjackHand[], currentIdx: number) => {
    if (currentIdx + 1 < hands.length) {
      setActiveHandIdx(currentIdx + 1);
    } else {
      const allBusted = hands.every((h) => h.status === 'BUST');
      if (allBusted) {
        setDealerRevealed(true);
        setGameStage('ROUND_OVER');
        setRoundMessage('BẠN ĐÃ BỊ QUẮC (BUST)! NHÀ CÁI THẮNG.');
      } else {
        runDealerTurn(hands);
      }
    }
  };

  // Dealer play loop: draw cards until 17 or higher
  const runDealerTurn = (playerHandsToEvaluate: BlackjackHand[]) => {
    setGameStage('DEALER_TURN');
    setDealerRevealed(true);
    sounds.playCardLift();

    let curDealer = [...dealerCards];
    let curDeck = [...deck];
    let evalRes = calculateBlackjackScore(curDealer);

    const dealerStep = () => {
      if (evalRes.score < 17) {
        sounds.playCardDeal();
        const nextCard = curDeck.shift()!;
        curDealer.push(nextCard);
        evalRes = calculateBlackjackScore(curDealer);

        setDealerCards([...curDealer]);
        setDeck([...curDeck]);

        setTimeout(dealerStep, 900);
      } else {
        // Dealer stops, evaluate payouts
        finalizeRound(curDealer, playerHandsToEvaluate);
      }
    };

    setTimeout(dealerStep, 700);
  };

  // Finalize round & payouts
  const finalizeRound = (finalDealerCards: Card[], finalPlayerHands: BlackjackHand[]) => {
    const dEval = calculateBlackjackScore(finalDealerCards);
    const dealerBust = dEval.score > 21;
    let netWinnings = 0;
    let returnAmount = 0;

    const updatedHands = finalPlayerHands.map((hand) => {
      if (hand.status === 'BUST') {
        return { ...hand, status: 'LOSE' as HandStatus };
      }

      if (dealerBust) {
        // Dealer busts -> player wins 1:1
        returnAmount += hand.bet * 2;
        netWinnings += hand.bet;
        return { ...hand, status: 'WIN' as HandStatus };
      }

      if (hand.score > dEval.score) {
        // Player has higher score
        returnAmount += hand.bet * 2;
        netWinnings += hand.bet;
        return { ...hand, status: 'WIN' as HandStatus };
      } else if (hand.score === dEval.score) {
        // Push
        returnAmount += hand.bet;
        return { ...hand, status: 'PUSH' as HandStatus };
      } else {
        // Dealer has higher score
        return { ...hand, status: 'LOSE' as HandStatus };
      }
    });

    setPlayerHands(updatedHands);
    setGameStage('ROUND_OVER');

    if (netWinnings > 0) {
      sounds.playWin();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.65 } });
      setRoundMessage(
        dealerBust
          ? `NHÀ CÁI BỊ QUẮC (${dEval.score} ĐIỂM)! BẠN THẮNG +$${netWinnings.toLocaleString()}!`
          : `BẠN THẮNG NHÀ CÁI (${updatedHands[0].score} vs ${dEval.score})! +$${netWinnings.toLocaleString()}!`
      );
      const updatedChips = chips + returnAmount;
      setChips(updatedChips);
      onUpdateChips(updatedChips, netWinnings);
    } else if (returnAmount > 0 && netWinnings === 0) {
      sounds.playCheck();
      setRoundMessage(`HÒA ĐIỂM (${updatedHands[0].score} vs ${dEval.score})! HOÀN TIỀN CƯỢC.`);
      const updatedChips = chips + returnAmount;
      setChips(updatedChips);
      onUpdateChips(updatedChips, 0);
    } else {
      sounds.playFold();
      setRoundMessage(`NHÀ CÁI THẮNG (${dEval.score} vs ${updatedHands[0].score}). CHÚC BẠN MAY MẮN VÁN SAU!`);
    }
  };

  const dealerEval = calculateBlackjackScore(dealerCards);

  return (
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-950 text-white flex flex-col justify-between select-none overflow-x-hidden">
      {/* Header */}
      <header className="px-4 sm:px-8 py-3 bg-slate-900/90 border-b border-amber-950/80 flex items-center justify-between backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            ← Sảnh Game
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">♠️</span>
            <span className="font-serif font-black text-amber-400 tracking-wider text-sm sm:text-base">
              BLACKJACK VIP LAS VEGAS (XÌ DÁCH 21)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <DeviceModeSelector compact={true} />
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 font-mono text-xs shadow-inner">
            <span className="text-slate-400">Ví:</span>
            <span className="text-emerald-400 font-bold text-xs sm:text-sm tabular-nums">${chips.toLocaleString()}</span>
          </div>
        </div>
      </header>

      {/* Casino Table Felt */}
      <main className="max-w-4xl w-full mx-auto p-2 sm:p-5 flex flex-col items-center justify-center flex-1">
        <div className="relative w-full min-h-[440px] sm:min-h-0 aspect-[4/5] sm:aspect-[16/10] max-h-[580px] rounded-[60px] sm:rounded-[200px] bg-gradient-to-b from-[#0b3323] via-[#062418] to-[#0b3323] border-[8px] sm:border-[18px] border-[#2c1a0e] shadow-[0_30px_70px_rgba(0,0,0,0.95)] ring-2 sm:ring-4 ring-amber-900/60 p-2.5 sm:p-8 flex flex-col justify-between items-center overflow-hidden">
          {/* Table Inner Felt Gold Ring */}
          <div className="absolute inset-2 sm:inset-5 rounded-[50px] sm:rounded-[180px] border border-amber-400/25 pointer-events-none shadow-inner" />

          {/* Dealer Shoe Device on Top Right */}
          <div className="absolute top-4 right-8 sm:right-16 z-20 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-amber-500/40 rounded-xl shadow-lg">
            <div className="w-5 h-7 bg-red-800 rounded border border-white/40 shadow-sm" />
            <div className="text-[10px] font-mono font-bold text-amber-300">
              SHOE: {deck.length} LÁ
            </div>
          </div>

          {/* Dealer Area */}
          <div className="relative z-10 flex flex-col items-center mt-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              <span className="text-amber-400 font-serif font-black">DEALER (NHÀ CÁI)</span>
              {dealerCards.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-black/80 font-mono text-amber-300 border border-amber-500/40">
                  {dealerRevealed
                    ? dealerEval.score
                    : `${dealerCards[0]?.rank === 14 ? '11' : dealerCards[0]?.rank >= 10 ? '10' : dealerCards[0]?.rank} + ?`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 min-h-[70px] sm:min-h-[110px]">
              {dealerCards.map((card, idx) => (
                <div
                  key={card.id || idx}
                  className="transition-transform duration-300 animate-in fade-in zoom-in-75"
                >
                  <CardView
                    card={card}
                    faceDown={idx === 1 && !dealerRevealed}
                    size="sm"
                    className="sm:hidden"
                  />
                  <CardView
                    card={card}
                    faceDown={idx === 1 && !dealerRevealed}
                    size="md"
                    className="hidden sm:block"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Table Announcement & Felt Rules Watermark */}
          <div className="relative z-10 text-center my-auto px-2">
            {roundMessage ? (
              <div className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-2xl border-2 border-yellow-200 animate-bounce">
                {roundMessage}
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-40 hover:opacity-75 transition-opacity">
                <span className="text-[11px] sm:text-sm font-serif font-black uppercase tracking-[0.25em] text-amber-200">
                  BLACKJACK PAYS 3 TO 2
                </span>
                <span className="text-[9px] sm:text-[10px] font-sans text-emerald-200 uppercase tracking-wider mt-0.5">
                  Dealer stands on 17 · Insurance 2:1
                </span>
              </div>
            )}
          </div>

          {/* Player Hand Area & 3D Bet Chip Placement */}
          <div className="relative z-10 flex flex-col items-center mb-1">
            {playerHands.map((hand, idx) => (
              <div key={idx} className="flex flex-col items-center">
                {/* Placed Bet Chip Stack on Table */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-black/80 border border-amber-400/50 flex items-center gap-1.5 sm:gap-2 shadow-lg">
                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black font-mono text-[9px] sm:text-[10px] flex items-center justify-center border border-white">
                      $
                    </span>
                    <span className="font-mono font-bold text-[11px] sm:text-xs text-amber-300">
                      CƯỢC: ${hand.bet}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 min-h-[70px] sm:min-h-[110px] mb-1.5">
                  {hand.cards.map((card, cIdx) => (
                    <div
                      key={card.id || cIdx}
                      className="transition-transform duration-300 animate-in fade-in zoom-in-75"
                    >
                      <CardView card={card} size="sm" className="sm:hidden" />
                      <CardView card={card} size="md" className="hidden sm:block" />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-3 py-1 rounded-full bg-black/80 text-amber-300 font-mono text-sm border border-amber-500/40">
                    {hand.score} {hand.isSoft && hand.score < 21 ? '(Mềm)' : ''}
                  </span>

                  {hand.status === 'BUST' && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-black uppercase text-[10px] shadow-lg animate-pulse">
                      QUẮC (BUST)
                    </span>
                  )}
                  {hand.status === 'BLACKJACK' && (
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 uppercase font-black text-[11px] shadow-lg animate-bounce">
                      ★ BLACKJACK 21 ★
                    </span>
                  )}
                  {hand.status === 'WIN' && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-black uppercase text-[10px] shadow-lg">
                      THẮNG
                    </span>
                  )}
                  {hand.status === 'PUSH' && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-700 text-slate-200 font-bold uppercase text-[10px]">
                      HÒA
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls & Chips Tray */}
        <div className="w-full max-w-2xl mt-4 p-3.5 sm:p-4 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          {gameStage === 'BETTING' || gameStage === 'ROUND_OVER' ? (
            <>
              {/* Chip Selectors */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {CHIP_DENOMS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      sounds.playClick();
                      setCurrentBet(amt);
                    }}
                    className={`px-3 py-2 rounded-2xl font-mono text-xs font-black border transition-all active:scale-95 ${
                      currentBet === amt
                        ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 border-white shadow-lg shadow-amber-500/30 scale-105'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Deal Button */}
              <button
                onClick={dealNewRound}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 active:scale-95 transition-all"
              >
                CHIA BÀI (${currentBet}) ▶
              </button>
            </>
          ) : (
            <div className="w-full grid grid-cols-3 gap-3">
              <button
                onClick={handleHit}
                disabled={gameStage !== 'PLAYER_TURN'}
                className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                RÚT (HIT)
              </button>

              <button
                onClick={handleStand}
                disabled={gameStage !== 'PLAYER_TURN'}
                className="py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 text-white font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                DẰN (STAND)
              </button>

              <button
                disabled={playerHands[activeHandIdx]?.cards.length !== 2 || chips < (playerHands[activeHandIdx]?.bet || 0) || gameStage !== 'PLAYER_TURN'}
                onClick={handleDouble}
                className="py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                GẤP ĐÔI (2X)
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-3 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500">
        Luật sòng bạc Châu Âu & Las Vegas · Điểm 21 tối thượng · Rút thêm đến khi hài lòng
      </footer>
    </div>
  );
};
