import React from 'react';
import { LogEntry } from '../types/poker';

interface HistoryLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

export const HistoryLogModal: React.FC<HistoryLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[85dvh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-xs sm:text-sm">Nhật Ký Hành Động</span>
            <span className="text-[10px] text-slate-400 font-mono">({logs.length})</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Chưa có hành động nào</div>
          ) : (
            logs.slice().reverse().map((log) => {
              let tagColor = 'text-slate-400 bg-slate-800';
              if (log.type === 'win') tagColor = 'text-emerald-400 bg-emerald-950/80 border border-emerald-800';
              else if (log.type === 'deal') tagColor = 'text-blue-400 bg-blue-950/80';
              else if (log.type === 'blind') tagColor = 'text-amber-400 bg-amber-950/80';
              else if (log.type === 'action') tagColor = 'text-purple-300 bg-purple-950/50';

              return (
                <div key={log.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-800/50 transition-colors">
                  <span className="text-[10px] text-slate-500 tabular-nums shrink-0 mt-0.5">
                    {log.timestamp}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${tagColor}`}>
                    {log.type}
                  </span>
                  <span className="text-slate-200 flex-1 leading-relaxed">
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
