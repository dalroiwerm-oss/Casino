import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DeviceMode = 'auto' | 'desktop' | 'tablet' | 'mobile';
export type ScreenType = 'desktop' | 'tablet' | 'mobile';

interface DeviceContextType {
  deviceMode: DeviceMode;
  setDeviceMode: (mode: DeviceMode) => void;
  actualScreen: ScreenType;
  effectiveScreen: ScreenType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const DeviceContext = createContext<DeviceContextType>({
  deviceMode: 'auto',
  setDeviceMode: () => {},
  actualScreen: 'desktop',
  effectiveScreen: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
});

export const DEVICE_STORAGE_KEY = 'game_hub_device_mode_pref';

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deviceMode, setDeviceModeState] = useState<DeviceMode>(() => {
    try {
      const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
      if (stored === 'desktop' || stored === 'tablet' || stored === 'mobile' || stored === 'auto') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'auto';
  });

  const [actualScreen, setActualScreen] = useState<ScreenType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) setActualScreen('mobile');
      else if (w < 1024) setActualScreen('tablet');
      else setActualScreen('desktop');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode);
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const effectiveScreen: ScreenType = deviceMode === 'auto' ? actualScreen : deviceMode;
  const isMobile = effectiveScreen === 'mobile';
  const isTablet = effectiveScreen === 'tablet';
  const isDesktop = effectiveScreen === 'desktop';

  return (
    <DeviceContext.Provider
      value={{
        deviceMode,
        setDeviceMode,
        actualScreen,
        effectiveScreen,
        isMobile,
        isTablet,
        isDesktop,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDeviceMode = () => useContext(DeviceContext);
