import React from 'react';
import { useDeviceMode, DeviceMode } from '../logic/device';
import { sounds } from '../logic/audio';

interface DeviceModeSelectorProps {
  compact?: boolean;
  className?: string;
}

export const DeviceModeSelector: React.FC<DeviceModeSelectorProps> = ({
  compact = false,
  className = '',
}) => {
  const { deviceMode, setDeviceMode, effectiveScreen } = useDeviceMode();

  const options: { id: DeviceMode; label: string; shortLabel: string; icon: string }[] = [
    { id: 'desktop', label: 'Máy Tính', shortLabel: 'PC', icon: '🖥️' },
    { id: 'tablet', label: 'Tablet', shortLabel: 'Tab', icon: '📱' },
    { id: 'mobile', label: 'Điện Thoại', shortLabel: 'Mobile', icon: '📲' },
    { id: 'auto', label: 'Tự Động', shortLabel: 'Auto', icon: '⚡' },
  ];

  return (
    <div
      className={`inline-flex items-center p-0.5 sm:p-1 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-inner backdrop-blur-md shrink-0 ${className}`}
      title="Chuyển đổi giao diện hiển thị: Desktop, Tablet hoặc Mobile"
    >
      {options.map((opt) => {
        const isActive = deviceMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              sounds.playClick();
              setDeviceMode(opt.id);
            }}
            className={`flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2.5 py-0.5 sm:py-1 min-h-[28px] sm:min-h-[36px] rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-200 active:scale-95 ${
              isActive
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold shadow-md shadow-amber-500/25 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span className="text-[11px] sm:text-sm leading-none">{opt.icon}</span>
            <span className={compact ? 'hidden md:inline' : 'hidden xs:inline'}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
