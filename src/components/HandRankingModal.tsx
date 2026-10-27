import React from 'react';
import { CardView } from './CardView';
import { Card } from '../logic/poker';

interface HandRankingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HandRankExample {
  rankNum: number;
  nameVi: string;
  nameEn: string;
  descVi: string;
  probability: string;
  cards: Card[];
}

const HAND_RANK_LIST: HandRankExample[] = [
  {
    rankNum: 1,
    nameVi: 'Thùng Phá Sảnh Thượng',
    nameEn: 'Royal Flush',
    descVi: 'Bộ 5 lá cao nhất 10, J, Q, K, A cùng một chất. Không thể bị đánh bại.',
    probability: '0.00015%',
    cards: [
      { id: '10_s', rank: 10, suit: 'spades' },
      { id: '11_s', rank: 11, suit: 'spades' },
      { id: '12_s', rank: 12, suit: 'spades' },
      { id: '13_s', rank: 13, suit: 'spades' },
      { id: '14_s', rank: 14, suit: 'spades' },
    ],
  },
  {
    rankNum: 2,
    nameVi: 'Thùng Phá Sảnh',
    nameEn: 'Straight Flush',
    descVi: '5 lá bài có thứ tự liên tiếp nhau và cùng một chất.',
    probability: '0.00139%',
    cards: [
      { id: '6_h', rank: 6, suit: 'hearts' },
      { id: '7_h', rank: 7, suit: 'hearts' },
      { id: '8_h', rank: 8, suit: 'hearts' },
      { id: '9_h', rank: 9, suit: 'hearts' },
      { id: '10_h', rank: 10, suit: 'hearts' },
    ],
  },
  {
    rankNum: 3,
    nameVi: 'Tứ Quý',
    nameEn: 'Four of a Kind',
    descVi: '4 lá bài có cùng điểm số kết hợp với 1 lá Kicker.',
    probability: '0.024%',
    cards: [
      { id: '14_s', rank: 14, suit: 'spades' },
      { id: '14_h', rank: 14, suit: 'hearts' },
      { id: '14_d', rank: 14, suit: 'diamonds' },
      { id: '14_c', rank: 14, suit: 'clubs' },
      { id: '13_s', rank: 13, suit: 'spades' },
    ],
  },
  {
    rankNum: 4,
    nameVi: 'Cù Lũ',
    nameEn: 'Full House',
    descVi: 'Kết hợp gồm một bộ ba lá cùng điểm (Sám) và một đôi.',
    probability: '0.144%',
    cards: [
      { id: '13_s', rank: 13, suit: 'spades' },
      { id: '13_h', rank: 13, suit: 'hearts' },
      { id: '13_d', rank: 13, suit: 'diamonds' },
      { id: '10_c', rank: 10, suit: 'clubs' },
      { id: '10_s', rank: 10, suit: 'spades' },
    ],
  },
  {
    rankNum: 5,
    nameVi: 'Thùng (Đồng Chất)',
    nameEn: 'Flush',
    descVi: '5 lá bài bất kỳ cùng một chất nhưng không liên tiếp về số điểm.',
    probability: '0.197%',
    cards: [
      { id: '14_d', rank: 14, suit: 'diamonds' },
      { id: '11_d', rank: 11, suit: 'diamonds' },
      { id: '9_d', rank: 9, suit: 'diamonds' },
      { id: '6_d', rank: 6, suit: 'diamonds' },
      { id: '3_d', rank: 3, suit: 'diamonds' },
    ],
  },
  {
    rankNum: 6,
    nameVi: 'Sảnh (Dây Liên Tiếp)',
    nameEn: 'Straight',
    descVi: '5 lá bài liên tiếp về điểm số nhưng khác chất với nhau.',
    probability: '0.39%',
    cards: [
      { id: '5_c', rank: 5, suit: 'clubs' },
      { id: '6_h', rank: 6, suit: 'hearts' },
      { id: '7_s', rank: 7, suit: 'spades' },
      { id: '8_d', rank: 8, suit: 'diamonds' },
      { id: '9_c', rank: 9, suit: 'clubs' },
    ],
  },
  {
    rankNum: 7,
    nameVi: 'Sám Cô (Bộ Ba)',
    nameEn: 'Three of a Kind',
    descVi: '3 lá bài có cùng điểm số kết hợp cùng 2 lá rác (kicker).',
    probability: '2.11%',
    cards: [
      { id: '12_s', rank: 12, suit: 'spades' },
      { id: '12_h', rank: 12, suit: 'hearts' },
      { id: '12_c', rank: 12, suit: 'clubs' },
      { id: '9_d', rank: 9, suit: 'diamonds' },
      { id: '4_s', rank: 4, suit: 'spades' },
    ],
  },
  {
    rankNum: 8,
    nameVi: 'Hai Đôi (Thú)',
    nameEn: 'Two Pair',
    descVi: 'Gồm 2 cặp đôi có điểm số khác nhau và 1 lá kicker.',
    probability: '4.75%',
    cards: [
      { id: '11_s', rank: 11, suit: 'spades' },
      { id: '11_h', rank: 11, suit: 'hearts' },
      { id: '8_d', rank: 8, suit: 'diamonds' },
      { id: '8_c', rank: 8, suit: 'clubs' },
      { id: '14_s', rank: 14, suit: 'spades' },
    ],
  },
  {
    rankNum: 9,
    nameVi: 'Một Đôi',
    nameEn: 'One Pair',
    descVi: 'Gồm 2 lá bài có cùng số điểm và 3 lá bài rác độc lập.',
    probability: '42.3%',
    cards: [
      { id: '10_s', rank: 10, suit: 'spades' },
      { id: '10_h', rank: 10, suit: 'hearts' },
      { id: '14_d', rank: 14, suit: 'diamonds' },
      { id: '7_c', rank: 7, suit: 'clubs' },
      { id: '3_s', rank: 3, suit: 'spades' },
    ],
  },
  {
    rankNum: 10,
    nameVi: 'Bài Cao (Mậu Thầu)',
    nameEn: 'High Card',
    descVi: 'Không tạo thành bất kỳ sự kết hợp nào ở trên. Tính theo điểm lá cao nhất.',
    probability: '50.1%',
    cards: [
      { id: '14_s', rank: 14, suit: 'spades' },
      { id: '12_h', rank: 12, suit: 'hearts' },
      { id: '9_d', rank: 9, suit: 'diamonds' },
      { id: '6_c', rank: 6, suit: 'clubs' },
      { id: '2_s', rank: 2, suit: 'spades' },
    ],
  },
];

export const HandRankingModal: React.FC<HandRankingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90dvh] bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-amber-300">
              Bảng Thứ Hạng Bài Texas Hold'em
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Từ tay bài mạnh nhất đến yếu nhất trong luật Poker quốc tế
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 min-h-[40px] rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 divide-y divide-slate-800/80">
          {HAND_RANK_LIST.map((item) => (
            <div key={item.rankNum} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center">
                    {item.rankNum}
                  </span>
                  <span className="font-bold text-white text-sm">
                    {item.nameVi}
                  </span>
                  <span className="text-xs text-slate-400">({item.nameEn})</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 pl-7">
                  {item.descVi}
                </p>
              </div>

              {/* Visual Card Hand */}
              <div className="flex items-center gap-1 pl-7 sm:pl-0 shrink-0">
                {item.cards.map((c) => (
                  <CardView key={c.id} card={c} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Mẹo: Nhấn phím <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-400 font-mono text-[10px]">H</kbd> để bật/tắt bảng này bất kỳ lúc nào.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
