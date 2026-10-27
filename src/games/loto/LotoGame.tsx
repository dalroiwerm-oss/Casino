import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../../logic/audio';
import { UserProfile } from '../../logic/auth';
import {
  LotoRoom,
  LotoRoomPlayer,
  LotoTicket,
  getStoredLotoRooms,
  findLotoRoomByCode,
  createLotoRoom,
  joinLotoRoom,
  leaveLotoRoom,
  startLotoGame,
  nextLotoBall,
  claimLotoKinh,
  resetLotoRoomForNewRound,
  sendLotoRoomMessage,
  updatePlayerTicketMark,
  subscribeToLotoRoomUpdates,
  checkWinningTicketRow,
  addTestPlayerToLotoRoom,
  saveLotoRooms,
} from '../../logic/lotoRoom';
import { networkManager, NetworkPacket, NetworkStatus } from '../../logic/network';
import { onlineHub } from '../../logic/onlineHub';
import { DeviceModeSelector } from '../../components/DeviceModeSelector';
import { useDeviceMode } from '../../logic/device';

interface LotoGameProps {
  currentUser: UserProfile | null;
  onUpdateChips: (newChips: number, wonAmount: number) => void;
  onExit: () => void;
  onRequireRegister: () => void;
}

// Decade color themes for balls (1 to 90)
function getBallColorStyle(num: number) {
  if (num <= 9) return { bg: 'from-cyan-400 to-blue-600', ring: 'ring-cyan-300', text: 'text-slate-950', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' };
  if (num <= 19) return { bg: 'from-blue-400 to-indigo-600', ring: 'ring-blue-300', text: 'text-white', badge: 'bg-blue-500/20 text-blue-300 border-blue-400/40' };
  if (num <= 29) return { bg: 'from-emerald-400 to-teal-700', ring: 'ring-emerald-300', text: 'text-slate-950', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' };
  if (num <= 39) return { bg: 'from-yellow-300 to-amber-600', ring: 'ring-yellow-200', text: 'text-slate-950', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40' };
  if (num <= 49) return { bg: 'from-amber-400 to-orange-600', ring: 'ring-amber-300', text: 'text-slate-950', badge: 'bg-amber-500/20 text-amber-300 border-amber-400/40' };
  if (num <= 59) return { bg: 'from-orange-400 to-red-600', ring: 'ring-orange-300', text: 'text-white', badge: 'bg-orange-500/20 text-orange-300 border-orange-400/40' };
  if (num <= 69) return { bg: 'from-rose-400 to-pink-600', ring: 'ring-rose-300', text: 'text-white', badge: 'bg-rose-500/20 text-rose-300 border-rose-400/40' };
  if (num <= 79) return { bg: 'from-purple-400 to-violet-700', ring: 'ring-purple-300', text: 'text-white', badge: 'bg-purple-500/20 text-purple-300 border-purple-400/40' };
  return { bg: 'from-fuchsia-400 to-pink-700', ring: 'ring-fuchsia-300', text: 'text-white', badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40' };
}

export const LotoGame: React.FC<LotoGameProps> = ({
  currentUser,
  onUpdateChips,
  onExit,
  onRequireRegister,
}) => {
  // Navigation State: 'LOBBY' | 'ROOM_WAITING' | 'ROOM_PLAYING'
  const [viewState, setViewState] = useState<'LOBBY' | 'ROOM_WAITING' | 'ROOM_PLAYING'>('LOBBY');

  // Active Room
  const [currentRoom, setCurrentRoom] = useState<LotoRoom | null>(null);

  // Lobby Creation & Join Form State
  const [roomNameInput, setRoomNameInput] = useState<string>('');
  const [ticketPriceInput, setTicketPriceInput] = useState<number>(100);
  const [turnTimeInput, setTurnTimeInput] = useState<number>(5);
  const [customTurnTimeInput, setCustomTurnTimeInput] = useState<string>('5');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Available Rooms List
  const [availableRooms, setAvailableRooms] = useState<LotoRoom[]>(() => getStoredLotoRooms());

  // In-Game Options & Turn Countdown
  const [autoDaub, setAutoDaub] = useState<boolean>(true);
  const [showMasterBoard, setShowMasterBoard] = useState<boolean>(false);
  const [drawSpeed, setDrawSpeed] = useState<number>(3000);
  const [isAutoDrawing, setIsAutoDrawing] = useState<boolean>(true);
  const [ballCountdown, setBallCountdown] = useState<number>(5);

  // Drawing Animation State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [ejectedBall, setEjectedBall] = useState<number | null>(null);
  const [isEjecting, setIsEjecting] = useState<boolean>(false);

  // Room Chat input
  const [chatMessage, setChatMessage] = useState<string>('');

  // Floating Particles inside the transparent glass chamber
  const chamberParticles = useRef(
    Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      num: Math.floor(Math.random() * 90) + 1,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      size: 16 + Math.random() * 8,
      speedX: (Math.random() - 0.5) * 4,
      speedY: (Math.random() - 0.5) * 4,
      color: ['#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#34d399', '#fb923c'][i % 6],
    }))
  ).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [netStatus, setNetStatus] = useState<NetworkStatus>(networkManager.getStatus());
  const currentRoomRef = useRef<LotoRoom | null>(null);
  const currentUserRef = useRef<UserProfile | null>(currentUser);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Subscribe to real-time WebRTC P2P packets
  useEffect(() => {
    const unsubStatus = networkManager.onStatusChange((status) => {
      setNetStatus(status);
    });

    const unsubPacket = networkManager.onPacket((packet: NetworkPacket) => {
      if (packet.type === 'LT_PLAYER_JOIN') {
        const room = currentRoomRef.current;
        const user = currentUserRef.current;
        if (room && user && room.hostId === user.id) {
          const incomingUser = packet.payload.user || packet.payload;
          if (incomingUser && incomingUser.id && !room.players.some((p) => p.id === incomingUser.id)) {
            const joinRes = joinLotoRoom(room.id, incomingUser);
            if (joinRes.success && joinRes.room) {
              setCurrentRoom(joinRes.room);
              networkManager.broadcast('LT_ROOM_SYNC', user, joinRes.room);
              sounds.playChips();
              showToast(`${incomingUser.name} vừa mua vé vào phòng qua WebRTC!`);
            }
          }
        }
      } else if (packet.type === 'LT_ROOM_SYNC') {
        const remoteRoom: LotoRoom = packet.payload;
        setCurrentRoom(remoteRoom);
        const allRooms = getStoredLotoRooms();
        saveLotoRooms([remoteRoom, ...allRooms.filter((r) => r.id !== remoteRoom.id)]);
      } else if (packet.type === 'LT_START_GAME') {
        const playingRoom: LotoRoom = packet.payload;
        setCurrentRoom(playingRoom);
        setViewState('ROOM_PLAYING');
        sounds.playWin();
      } else if (packet.type === 'LT_BALL_DRAW') {
        const { currentBallIndex, room: syncRoom } = packet.payload;
        if (syncRoom) {
          setCurrentRoom(syncRoom);
        } else if (currentRoomRef.current) {
          setCurrentRoom({ ...currentRoomRef.current, currentBallIndex });
        }
      } else if (packet.type === 'LT_CLAIM_KINH') {
        const { room: winRoom } = packet.payload;
        if (winRoom) {
          setCurrentRoom(winRoom);
          sounds.playLotoKinh();
          confetti({ particleCount: 260, spread: 100, origin: { y: 0.55 } });
        }
      } else if (packet.type === 'LT_RESET_ROUND') {
        const resetRoom: LotoRoom = packet.payload;
        setCurrentRoom(resetRoom);
        setViewState('ROOM_WAITING');
      }
    });

    return () => {
      unsubStatus();
      unsubPacket();
    };
  }, []);

  // Dual-channel server polling for Loto
  const lastLotoEventTimeRef = useRef<number>(Date.now() - 10000);
  const processedLotoEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentRoom) return;
    const interval = setInterval(async () => {
      try {
        const events = await onlineHub.getGameEvents(currentRoom.id, lastLotoEventTimeRef.current);
        if (!events || events.length === 0) return;

        for (const ev of events) {
          if (processedLotoEventIdsRef.current.has(ev.id)) continue;
          processedLotoEventIdsRef.current.add(ev.id);
          if (ev.timestamp > lastLotoEventTimeRef.current) {
            lastLotoEventTimeRef.current = ev.timestamp;
          }

          if (ev.type === 'LT_BALL_DRAW') {
            const { currentBallIndex, room: syncRoom } = ev.payload;
            if (syncRoom) {
              setCurrentRoom(syncRoom);
            } else if (currentRoomRef.current) {
              setCurrentRoom({ ...currentRoomRef.current, currentBallIndex });
            }
          } else if (ev.type === 'LT_CLAIM_KINH') {
            const { room: winRoom } = ev.payload;
            if (winRoom) {
              setCurrentRoom(winRoom);
              sounds.playLotoKinh();
              confetti({ particleCount: 260, spread: 100, origin: { y: 0.55 } });
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [currentRoom]);

  // Sync rooms across tabs & Central Server
  const reloadRooms = useCallback(async () => {
    try {
      const localList = getStoredLotoRooms();
      const serverList = await onlineHub.getRooms('loto');
      const mergedMap = new Map();
      localList.forEach((r) => mergedMap.set(r.id, r));
      serverList.forEach((sr) => {
        mergedMap.set(sr.id, {
          id: sr.id,
          code: sr.code,
          name: sr.name,
          hostId: sr.hostId,
          hostName: sr.hostName,
          ticketPrice: sr.ticketPrice || 100,
          turnTimeSeconds: sr.turnTimeSeconds || 5,
          status: sr.status,
          players: sr.players || [],
          drawSequence: sr.extraData?.drawSequence || [],
          currentBallIndex: sr.extraData?.currentBallIndex ?? -1,
          createdAt: sr.createdAt,
          messages: [],
        });
      });
      const list = Array.from(mergedMap.values());
      setAvailableRooms(list);

      if (currentRoom) {
        const refreshed = list.find((r) => r.id === currentRoom.id || r.code === currentRoom.code);
        if (refreshed) {
          setCurrentRoom(refreshed);

          // Check view state transition based on room status
          if (refreshed.status === 'PLAYING') {
            setViewState('ROOM_PLAYING');
          } else if (refreshed.status === 'WAITING') {
            setViewState('ROOM_WAITING');
          }
        }
      }
    } catch {
      // fallback
    }
  }, [currentRoom]);

  useEffect(() => {
    const unsubscribe = subscribeToLotoRoomUpdates(() => {
      reloadRooms();
    });
    return () => unsubscribe();
  }, [reloadRooms]);

  // Sync latest ball and trigger modern ejection animation when currentBallIndex changes
  useEffect(() => {
    if (currentRoom && currentRoom.status === 'PLAYING' && currentRoom.currentBallIndex >= 0) {
      const drawnBall = currentRoom.drawSequence[currentRoom.currentBallIndex];
      setIsSpinning(true);
      sounds.playLotoDrumRoll();

      const timer = setTimeout(() => {
        setIsSpinning(false);
        setIsEjecting(true);
        setEjectedBall(drawnBall);
        sounds.playLotoBallDrop();

        const ejectTimer = setTimeout(() => {
          setIsEjecting(false);
        }, 800);

        return () => clearTimeout(ejectTimer);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentRoom?.currentBallIndex, currentRoom?.status]);

  // Auto-daub tickets if enabled
  useEffect(() => {
    if (!autoDaub || !currentRoom || currentRoom.status !== 'PLAYING' || !currentUser) return;
    if (currentRoom.currentBallIndex < 0) return;

    const drawnSoFar = new Set(currentRoom.drawSequence.slice(0, currentRoom.currentBallIndex + 1));
    const myPlayer = currentRoom.players.find((p) => p.id === currentUser.id);
    if (!myPlayer) return;

    let changed = false;
    myPlayer.ticket.board.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell.value !== null && drawnSoFar.has(cell.value) && !cell.marked) {
          updatePlayerTicketMark(currentRoom.id, currentUser.id, rIdx, cIdx);
          changed = true;
        }
      });
    });

    if (changed) {
      sounds.playLotoDaub();
    }
  }, [currentRoom?.currentBallIndex, autoDaub, currentRoom?.id, currentUser?.id]);

  const turnDuration = currentRoom?.turnTimeSeconds || 5;

  // Reset ballCountdown when currentBallIndex advances or room starts
  useEffect(() => {
    if (currentRoom?.status === 'PLAYING') {
      setBallCountdown(turnDuration);
    }
  }, [currentRoom?.currentBallIndex, currentRoom?.status, turnDuration]);

  // Turn Countdown & Host Automated Drawing Ticker
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'PLAYING' || !currentUser) return;
    if (currentRoom.currentBallIndex >= 89) return;
    if (!isAutoDrawing) return;

    const interval = setInterval(() => {
      setBallCountdown((prev) => {
        if (prev <= 1) {
          // If user is host, trigger authoritative next ball draw
          if (currentRoom.hostId === currentUser.id) {
            const updated = nextLotoBall(currentRoom.id);
            if (updated) {
              setCurrentRoom(updated);
            }
          }
          return turnDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRoom?.id, currentRoom?.status, currentRoom?.currentBallIndex, currentRoom?.hostId, currentUser?.id, isAutoDrawing, turnDuration]);

  // HANDLER: Create Room
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      onRequireRegister();
      return;
    }

    if (currentUser.chips < ticketPriceInput) {
      setErrorMessage(`Bạn cần tối thiểu $${ticketPriceInput.toLocaleString()} chip để mua vé vào phòng!`);
      sounds.playFold();
      return;
    }

    // Deduct ticket price from host's wallet
    const newChips = currentUser.chips - ticketPriceInput;
    onUpdateChips(newChips, -ticketPriceInput);
    sounds.playChips();

    const created = createLotoRoom({
      name: roomNameInput.trim() || `Phòng Lô Tô của ${currentUser.name}`,
      ticketPrice: ticketPriceInput,
      turnTimeSeconds: turnTimeInput,
      hostUser: currentUser,
    });

    setCurrentRoom(created);
    setViewState('ROOM_WAITING');
    networkManager.hostRoom('loto', created.code, currentUser);
    showToast(`Tạo phòng thành công! Mã phòng: #${created.code}`);
  };

  // HANDLER: Join Room
  const handleJoinRoom = async (codeOrId: string) => {
    setErrorMessage(null);
    if (!currentUser) {
      onRequireRegister();
      return;
    }

    const cleanCode = codeOrId.trim().toUpperCase();

    // 1. Try Central Server Join first for cross-device multiplayer
    try {
      const serverJoin = await onlineHub.joinRoom(cleanCode, {
        id: currentUser.id,
        name: currentUser.name,
        avatarColor: currentUser.avatarColor,
        chips: currentUser.chips,
      });

      if (serverJoin.success && serverJoin.room) {
        const sr = serverJoin.room;
        const targetTicketPrice = sr.ticketPrice || 100;
        if (currentUser.chips < targetTicketPrice) {
          setErrorMessage(`Bạn cần tối thiểu ${targetTicketPrice.toLocaleString()} chip để mua vé vào phòng này!`);
          sounds.playFold();
          return;
        }

        const isAlreadyInside = sr.players && sr.players.some((p) => p.id === currentUser.id);
        if (!isAlreadyInside) {
          const newChips = currentUser.chips - targetTicketPrice;
          onUpdateChips(newChips, -targetTicketPrice);
          sounds.playChips();
        }

        const formatted = {
          id: sr.id,
          code: sr.code,
          name: sr.name,
          hostId: sr.hostId,
    hostName: sr.hostName,
          ticketPrice: targetTicketPrice,
          turnTimeSeconds: sr.turnTimeSeconds || 5,
          status: sr.status,
          players: sr.players,
          drawSequence: sr.extraData?.drawSequence || [],
          currentBallIndex: sr.extraData?.currentBallIndex ?? -1,
          createdAt: sr.createdAt,
          messages: [],
        };

        setCurrentRoom(formatted);
        setViewState(formatted.status === 'PLAYING' ? 'ROOM_PLAYING' : 'ROOM_WAITING');
        const allRooms = getStoredLotoRooms();
        saveLotoRooms([formatted, ...allRooms.filter((r) => r.id !== formatted.id)]);

        networkManager.joinRoom('loto', sr.code, currentUser).then((conn) => {
          if (conn) {
            networkManager.broadcast('LT_PLAYER_JOIN', currentUser, formatted);
          }
        });
        showToast(`Đã tham gia phòng [${formatted.name}] thành công!`);
        return;
      }
    } catch {
      // fallback
    }
    setErrorMessage(null);

    if (!currentUser) {
      onRequireRegister();
      return;
    }

    const rooms = getStoredLotoRooms();
    const targetRoom = rooms.find((r) => r.id === codeOrId || r.code === cleanCode);

    // If room is found locally (e.g. same browser multi-tab)
    if (targetRoom) {
      if (currentUser.chips < targetRoom.ticketPrice) {
        setErrorMessage(`Bạn cần tối thiểu $${targetRoom.ticketPrice.toLocaleString()} chip để mua vé vào phòng này!`);
        sounds.playFold();
        return;
      }

      const isAlreadyInside = targetRoom.players.some((p) => p.id === currentUser.id);
      if (!isAlreadyInside) {
        const newChips = currentUser.chips - targetRoom.ticketPrice;
        onUpdateChips(newChips, -targetRoom.ticketPrice);
        sounds.playChips();
      }

      const result = joinLotoRoom(targetRoom.id, currentUser);
      if (result.success && result.room) {
        setCurrentRoom(result.room);
        setViewState(result.room.status === 'PLAYING' ? 'ROOM_PLAYING' : 'ROOM_WAITING');
        networkManager.joinRoom('loto', targetRoom.code, currentUser).then((conn) => {
          if (conn) {
            networkManager.broadcast('LT_PLAYER_JOIN', currentUser, result.room);
          }
        });
        showToast(`Đã tham gia phòng [${result.room.name}] thành công!`);
        return;
      }
    }

    // Connect across Internet via WebRTC DataChannel (2 different devices)
    networkManager.joinRoom('loto', cleanCode, currentUser).then((connected) => {
      if (connected) {
        networkManager.broadcast('LT_PLAYER_JOIN', currentUser, {
          user: currentUser,
          code: cleanCode,
        });
        showToast(`Đã kết nối vào phòng #${cleanCode} qua WebRTC P2P!`);
      } else {
        setErrorMessage('Không tìm thấy phòng Lô Tô với mã này trên mạng!');
        sounds.playFold();
      }
    });
  };

  // HANDLER: Start Game (Host only, min 2 players)
  const handleHostStartGame = () => {
    if (!currentRoom || !currentUser) return;
    if (currentRoom.players.length < 2) {
      setErrorMessage('Cần tối thiểu 2 người chơi mua vé để bắt đầu quay số!');
      sounds.playFold();
      return;
    }

    sounds.playWin();
    const updated = startLotoGame(currentRoom.id);
    if (updated) {
      setCurrentRoom(updated);
      setViewState('ROOM_PLAYING');
      networkManager.broadcast('LT_START_GAME', currentUser, updated);
      showToast('Bắt đầu quay số Lô Tô!');
    }
  };

  // HANDLER: Add Test Bot (Helps user test room alone)
  const handleAddTestBot = () => {
    if (!currentRoom) return;
    sounds.playChips();
    const updated = addTestPlayerToLotoRoom(currentRoom.id);
    if (updated) {
      setCurrentRoom(updated);
      if (currentUser) {
        networkManager.broadcast('LT_ROOM_SYNC', currentUser, updated);
      }
      showToast('Đã thêm 1 người chơi ảo / bot test để thử nghiệm phòng!');
    }
  };

  // HANDLER: Manual Next Ball (Host only)
  const handleManualNextBall = () => {
    if (!currentRoom || !currentUser) return;
    sounds.playClick();
    const updated = nextLotoBall(currentRoom.id);
    if (updated) {
      setCurrentRoom(updated);
      networkManager.broadcast('LT_BALL_DRAW', currentUser, {
        currentBallIndex: updated.currentBallIndex,
        room: updated,
      });
    }
  };

  // HANDLER: Leave Room
  const handleLeaveCurrentRoom = () => {
    if (!currentRoom || !currentUser) return;
    sounds.playClick();
    leaveLotoRoom(currentRoom.id, currentUser.id);
    setCurrentRoom(null);
    setViewState('LOBBY');
    reloadRooms();
  };

  // HANDLER: Cell Stamp Click
  const handleCellClick = (rowIdx: number, cellIdx: number) => {
    if (!currentRoom || currentRoom.status !== 'PLAYING' || !currentUser) return;

    const myPlayer = currentRoom.players.find((p) => p.id === currentUser.id);
    if (!myPlayer) return;

    const cell = myPlayer.ticket.board[rowIdx]?.[cellIdx];
    if (!cell || cell.value === null) return;

    // Check if number was drawn so far
    const drawnNumbers = currentRoom.drawSequence.slice(0, currentRoom.currentBallIndex + 1);
    if (!drawnNumbers.includes(cell.value)) {
      sounds.playFold();
      showToast(`Số ${cell.value} chưa được quay ra! Hãy chờ lồng cầu xổ số này.`);
      return;
    }

    sounds.playLotoDaub();
    const updated = updatePlayerTicketMark(currentRoom.id, currentUser.id, rowIdx, cellIdx);
    if (updated) setCurrentRoom(updated);
  };

  // HANDLER: Player Claims "BÁO KINH!"
  const handleClaimKinh = () => {
    if (!currentRoom || currentRoom.status !== 'PLAYING' || !currentUser) return;

    const myPlayer = currentRoom.players.find((p) => p.id === currentUser.id);
    if (!myPlayer) return;

    const winningRow = checkWinningTicketRow(myPlayer.ticket);
    if (!winningRow) {
      sounds.playFold();
      showToast('⚠️ Bạn chưa đủ 5 số trên cùng một hàng để Kinh! Hãy kiểm tra lại vé.');
      return;
    }

    // Verify all 5 numbers were drawn
    const drawnSoFar = new Set(currentRoom.drawSequence.slice(0, currentRoom.currentBallIndex + 1));
    const allDrawn = winningRow.every((n) => drawnSoFar.has(n));

    if (!allDrawn) {
      sounds.playFold();
      showToast('⚠️ Hàng này có số chưa được xổ ra! Không thể Báo Kinh.');
      return;
    }

    const claimRes = claimLotoKinh(currentRoom.id, currentUser.id, winningRow);
    if (claimRes.valid && claimRes.room) {
      sounds.playLotoKinh();
      confetti({ particleCount: 260, spread: 100, origin: { y: 0.55 } });

      // Total prize pot
      const totalPrize = claimRes.room.winningPot || (currentRoom.ticketPrice * currentRoom.players.length);
      const newChips = currentUser.chips + totalPrize;
      onUpdateChips(newChips, totalPrize);

      setCurrentRoom(claimRes.room);
      networkManager.broadcast('LT_CLAIM_KINH', currentUser, { room: claimRes.room });
    } else {
      sounds.playFold();
      showToast(claimRes.error || 'Báo Kinh thất bại!');
    }
  };

  // HANDLER: Reset Room for New Round (Host only)
  const handleResetForNewRound = () => {
    if (!currentRoom || !currentUser) return;
    sounds.playWin();
    const updated = resetLotoRoomForNewRound(currentRoom.id);
    if (updated) {
      setCurrentRoom(updated);
      setViewState('ROOM_WAITING');
      networkManager.broadcast('LT_RESET_ROUND', currentUser, updated);
      showToast('Đã phát vé mới cho mọi người!');
    }
  };

  // HANDLER: Send In-Room Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !currentUser || !chatMessage.trim()) return;
    sounds.playClick();
    const updated = sendLotoRoomMessage(
      currentRoom.id,
      currentUser.name,
      currentUser.avatarColor || '#f59e0b',
      chatMessage
    );
    if (updated) {
      setCurrentRoom(updated);
      setChatMessage('');
    }
  };

  const isHost = currentRoom && currentUser && currentRoom.hostId === currentUser.id;
  const myPlayer = currentRoom?.players.find((p) => p.id === currentUser?.id);
  const totalPrizePool = currentRoom ? currentRoom.ticketPrice * currentRoom.players.length : 0;
  const drawnNumbersList = currentRoom && currentRoom.currentBallIndex >= 0
    ? currentRoom.drawSequence.slice(0, currentRoom.currentBallIndex + 1)
    : [];
  const currentDrawnBall = currentRoom && currentRoom.currentBallIndex >= 0
    ? currentRoom.drawSequence[currentRoom.currentBallIndex]
    : null;

  const heroHasWinningRow = myPlayer ? checkWinningTicketRow(myPlayer.ticket) !== null : false;

  return (
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-950 text-white flex flex-col justify-between select-none overflow-x-hidden font-sans">
      {/* Broadcast Top Navigation Bar */}
      <header className="px-3 sm:px-8 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-fuchsia-900/40 flex items-center justify-between backdrop-blur-md z-30 sticky top-0 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              sounds.playClick();
              if (currentRoom) handleLeaveCurrentRoom();
              onExit();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors active:scale-95"
          >
            <span>←</span>
            <span className="hidden sm:inline">Danh Sách Trò Chơi</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-amber-500 flex items-center justify-center text-lg font-bold shadow-md shadow-fuchsia-500/20">
              🎯
            </div>
            <div>
              <span className="font-serif font-black text-white tracking-wider text-xs sm:text-base uppercase whitespace-nowrap flex items-center gap-1.5">
                LÔ TÔ CHUYÊN NGHIỆP
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                  PHÒNG NHIỀU NGƯỜI
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Dynamic Cumulative Pot HUD & Device Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <DeviceModeSelector compact={true} />
          {currentRoom && (
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border border-amber-400/50 shadow-lg backdrop-blur-sm">
              <span className="text-[10px] sm:text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <span className="animate-pulse">💰</span> GIẢI THƯỞNG:
              </span>
              <span className="text-sm sm:text-lg font-mono font-black tabular-nums text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                ${totalPrizePool.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                ({currentRoom.players.length} người × ${currentRoom.ticketPrice})
              </span>
            </div>
          )}

          {/* Master 90-ball board button */}
          {viewState === 'ROOM_PLAYING' && (
            <button
              onClick={() => {
                sounds.playClick();
                setShowMasterBoard(!showMasterBoard);
              }}
              className="px-2.5 sm:px-3 py-1.5 min-h-[40px] rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-300 font-bold text-xs transition-colors flex items-center gap-1"
            >
              <span>📊</span>
              <span className="hidden sm:inline">Bảng 90 Số</span>
              <span className="font-mono text-[11px]">({drawnNumbersList.length}/90)</span>
            </button>
          )}

          {/* Wallet Chips */}
          <div className="px-3 sm:px-4 py-1.5 min-h-[40px] rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Ví:</span>
            <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm tabular-nums">
              ${(currentUser?.chips || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2 border border-yellow-300 animate-in slide-in-from-top-4">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="max-w-xl mx-auto mt-3 px-4 py-2 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs flex items-center justify-between gap-3">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* VIEW 1: LOBBY (Create Room, Join via Code, Browse Open Rooms) */}
      {viewState === 'LOBBY' && (
        <main className="max-w-5xl w-full mx-auto p-4 sm:p-8 flex-1 flex flex-col justify-center">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-fuchsia-400 font-serif tracking-tight drop-shadow-md">
              PHÒNG LÔ TÔ ĐA NGƯỜI CHƠI
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto mt-2 leading-relaxed">
              Giải thưởng tích lũy trực tiếp từ số tiền mua vé của tất cả người chơi trong phòng.
              Tối thiểu 2 người để mở màn, không giới hạn số lượng tham gia — càng đông càng thưởng lớn!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
            {/* Box 1: Create New Room */}
            <div className="bg-slate-900/90 border-2 border-fuchsia-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-9 h-9 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40 flex items-center justify-center text-lg font-bold">
                  ➕
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                    Tạo Phòng Mới
                  </h2>
                  <p className="text-xs text-slate-400">Thiết lập giá vé và mở phòng cho mọi người</p>
                </div>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tên Phòng:
                  </label>
                  <input
                    type="text"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    placeholder={currentUser ? `Phòng Lô Tô của ${currentUser.name}` : 'Phòng Lô Tô Vui Vẻ'}
                    maxLength={35}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-semibold focus:border-fuchsia-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Giá Vé Mỗi Người Tham Gia:
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[25, 50, 100, 200].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setTicketPriceInput(amt);
                        }}
                        className={`py-2 rounded-xl font-mono font-bold text-xs border transition-all ${
                          ticketPriceInput === amt
                            ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border-pink-400 ring-2 ring-fuchsia-400 shadow-md scale-105'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 whitespace-nowrap">Tùy chỉnh $:</span>
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={ticketPriceInput}
                      onChange={(e) => setTicketPriceInput(Math.max(10, Number(e.target.value) || 10))}
                      className="w-full bg-transparent font-mono font-bold text-amber-400 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Customizable Turn Time Selector (in seconds) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Thời Gian Mỗi Số (Giây):
                    </label>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      ⏱ {turnTimeInput}s / số
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {[3, 5, 8, 10, 15].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setTurnTimeInput(sec);
                          setCustomTurnTimeInput(String(sec));
                        }}
                        className={`py-2 rounded-xl font-mono font-bold text-xs border transition-all ${
                          turnTimeInput === sec
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 ring-2 ring-cyan-400 shadow-md scale-105'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 whitespace-nowrap">Tùy chỉnh giây (2-60s):</span>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={customTurnTimeInput}
                      onChange={(e) => {
                        setCustomTurnTimeInput(e.target.value);
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 2 && val <= 60) {
                          setTurnTimeInput(val);
                        }
                      }}
                      className="w-full bg-transparent font-mono font-bold text-cyan-300 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-500/30 text-xs space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Phí mua vé tạo phòng:</span>
                    <span className="font-mono font-bold text-amber-400">${ticketPriceInput.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Thời gian mỗi lượt xổ:</span>
                    <span className="font-mono font-bold text-cyan-300">⏱ {turnTimeInput}s / số</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Quy mô tối thiểu:</span>
                    <span className="font-semibold text-emerald-400">2 người chơi</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                    <span>Công thức giải thưởng:</span>
                    <span className="font-mono text-amber-300">Tổng giải = Vé × Số người</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-500 hover:from-fuchsia-500 hover:to-amber-400 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-fuchsia-600/25 active:scale-95 transition-all border border-pink-400 flex items-center justify-center gap-2"
                >
                  <span>MỞ PHÒNG & MUA VÉ (${ticketPriceInput.toLocaleString()})</span>
                  <span>→</span>
                </button>
              </form>
            </div>

            {/* Box 2: Join via Code & Browse Public Rooms */}
            <div className="space-y-5">
              {/* Join via 6-digit code */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🔑</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Nhập Mã 6 Chữ Số Vào Phòng
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="VD: 888888"
                    className="w-full sm:flex-1 min-w-0 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono font-black text-lg text-amber-300 tracking-[0.2em] focus:border-amber-400 focus:outline-none uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-xs placeholder:text-slate-500"
                  />
                  <button
                    onClick={() => handleJoinRoom(joinCodeInput)}
                    disabled={!joinCodeInput.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 whitespace-nowrap shrink-0 flex items-center justify-center gap-1"
                  >
                    <span>Vào Phòng</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Public Waiting Rooms */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌐</span>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Phòng Chờ Đang Mở ({availableRooms.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      reloadRooms();
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Làm mới ↻
                  </button>
                </div>

                {availableRooms.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                    Chưa có phòng nào đang mở. Hãy là người đầu tiên tạo phòng!
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {availableRooms.map((room) => {
                      const pot = room.ticketPrice * room.players.length;
                      return (
                        <div
                          key={room.id}
                          className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition-all flex items-center justify-between gap-3 shadow-md"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                #{room.code}
                              </span>
                              <span className="font-bold text-xs text-white truncate max-w-[160px]">
                                {room.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                              <span>Chủ: <strong className="text-slate-300">{room.hostName}</strong></span>
                              <span>·</span>
                              <span className="text-emerald-400 font-mono font-bold">${room.ticketPrice}/vé</span>
                              <span>·</span>
                              <span className="text-cyan-400 font-mono font-bold">⏱ {room.turnTimeSeconds || 5}s/số</span>
                              <span>·</span>
                              <span className="text-amber-300 font-mono font-bold">Giải: ${pot.toLocaleString()}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleJoinRoom(room.code)}
                            className="px-4 py-2 min-h-[40px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 shrink-0"
                          >
                            Tham Gia (${room.ticketPrice})
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* VIEW 2: ROOM WAITING (Before starting drawing) */}
      {viewState === 'ROOM_WAITING' && currentRoom && (
        <main className="max-w-4xl w-full mx-auto p-4 sm:p-8 flex-1 flex flex-col justify-center">
          {/* Room Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-fuchsia-950/40 to-slate-900 border-2 border-fuchsia-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md mb-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 uppercase">
                    Phòng Đang Chờ
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Chủ phòng: {currentRoom.hostName}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {currentRoom.name}
                </h2>
              </div>

              {/* 6-Digit Room Code Big Pill */}
              <div className="flex flex-col items-center sm:items-end">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mã Phòng</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-amber-300 tracking-[0.2em] px-3 py-1 bg-black/60 rounded-xl border border-amber-500/40">
                    {currentRoom.code}
                  </span>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(currentRoom.code);
                        showToast(`Đã sao chép mã phòng: ${currentRoom.code}`);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all"
                  >
                    Sao chép
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Cumulative Prize Pool Hero Indicator */}
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border-2 border-amber-400/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
                  🏆 GIẢI THƯỞNG TÍCH LŨY HIỆN TẠI:
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-amber-300 tabular-nums drop-shadow-[0_0_12px_rgba(251,191,36,0.8)] mt-0.5">
                  ${totalPrizePool.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Giá vé: <strong className="text-white">${currentRoom.ticketPrice}</strong> / người. Toàn bộ tiền vé của tất cả người chơi được cộng dồn vào giải độc đắc!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs text-cyan-300 font-mono font-bold flex items-center gap-1.5 shadow-sm">
                  <span>⏱</span>
                  <span>Thời gian lượt: {currentRoom.turnTimeSeconds || 5}s / số</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Chờ người chơi vào phòng</span>
                </div>
              </div>
            </div>
          </div>

          {/* Players Roster */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Danh Sách Người Chơi Mua Vé ({currentRoom.players.length} người)</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  currentRoom.players.length >= 2
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {currentRoom.players.length >= 2 ? 'Đủ điều kiện bắt đầu' : 'Cần tối thiểu 2 người'}
                </span>
              </h3>
              <span className="text-[11px] text-slate-400 italic">Không giới hạn số người</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {currentRoom.players.map((p, idx) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs text-white truncate">{p.name}</span>
                        {p.isHost && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            Chủ
                          </span>
                        )}
                        {p.id === currentUser?.id && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                            Bạn
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {p.ticket.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Đã mua vé
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={handleLeaveCurrentRoom}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all"
            >
              ← Rời Phòng
            </button>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
              {isHost && (
                <button
                  type="button"
                  onClick={handleAddTestBot}
                  className="flex-1 sm:flex-initial px-4 py-3 rounded-2xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  title="Thêm người chơi ảo (Bot Test) để thử nghiệm game ngay lập tức"
                >
                  <span>🤖</span>
                  <span>+ Thêm Bot Test</span>
                </button>
              )}

              {isHost ? (
                <button
                  onClick={handleHostStartGame}
                  disabled={currentRoom.players.length < 2}
                  className="flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>BẮT ĐẦU QUAY SỐ (${totalPrizePool.toLocaleString()})</span>
                  <span>▶</span>
                </button>
              ) : (
                <div className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-amber-300 font-semibold flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>Đang chờ chủ phòng ({currentRoom.hostName}) bấm bắt đầu...</span>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* VIEW 3: ACTIVE PLAYING (Modern Sleek 3D Drawing Chamber + Ticket) */}
      {viewState === 'ROOM_PLAYING' && currentRoom && (
        <main className="max-w-6xl w-full mx-auto p-2 sm:p-5 flex-1 flex flex-col items-center">
          {/* WINNER CELEBRATION MODAL BANNER */}
          {currentRoom.status === 'FINISHED' && currentRoom.winnerId && (
            <div className="w-full max-w-2xl p-6 mb-5 rounded-3xl bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 border-4 border-yellow-300 text-center shadow-[0_0_80px_rgba(251,191,36,0.9)] animate-in zoom-in-90 z-20">
              <div className="text-4xl mb-1">
                {currentRoom.winnerId === currentUser?.id ? '👑 🏆 👑' : '🎉 🔔 🎉'}
              </div>
              <h2 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-wider drop-shadow-md font-serif">
                {currentRoom.winnerId === currentUser?.id
                  ? 'BẠN ĐÃ KINH RỒI! CHIẾN THẮNG!'
                  : `${currentRoom.winnerName} ĐÃ BÁO KINH!`}
              </h2>
              <div className="mt-2 text-sm text-amber-100">
                Hàng 5 số may mắn:{' '}
                <strong className="text-white font-mono text-lg bg-black/40 px-3 py-1 rounded-xl">
                  {currentRoom.winningNumbers?.join(' - ')}
                </strong>
              </div>
              <div className="mt-3 text-3xl sm:text-4xl font-black font-mono text-yellow-200 drop-shadow">
                +${(currentRoom.winningPot || totalPrizePool).toLocaleString()} CHIP
              </div>
              <p className="text-xs text-amber-200 mt-1">
                Toàn bộ tiền vé của tất cả người chơi trong phòng đã được trao cho người chiến thắng!
              </p>

              {isHost && (
                <button
                  onClick={handleResetForNewRound}
                  className="mt-5 px-8 py-3 rounded-2xl bg-slate-950 text-amber-300 font-black text-sm uppercase border-2 border-amber-400 hover:bg-slate-900 transition-all shadow-xl active:scale-95"
                >
                  TIẾP TỤC VÁN MỚI
                </button>
              )}
            </div>
          )}

          {/* HIGH-TECH BROADCAST DRAWING ARENA */}
          <div className="w-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-fuchsia-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-md mb-4 flex flex-col items-center relative overflow-hidden">
            {/* Ambient Cyber Neon Glow */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-fuchsia-600/20 to-transparent blur-3xl pointer-events-none" />

            {/* Upper Broadcast Status Ribbon */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono font-bold text-emerald-400 uppercase tracking-widest text-[11px]">
                  TRỰC TIẾP QUAY SỐ LÔ TÔ
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-mono">
                  Phòng #{currentRoom.code}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-mono">
                  Đã xổ: <strong className="text-amber-400 font-bold">{drawnNumbersList.length}</strong> / 90 số
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-amber-300 font-mono font-bold">
                  Giải Thưởng: ${totalPrizePool.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Central Stage: High-tech 3D Chamber & Ball Ejection */}
            <div className="py-4 sm:py-6 flex flex-col md:flex-row items-center justify-around gap-6 w-full">
              {/* Left: 3D Futuristic Glass Lottery Chamber with Circular Countdown Ring */}
              <div className="relative flex flex-col items-center">
                <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
                  {/* Circular Countdown Progress Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      className="stroke-slate-800/80"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      className="stroke-amber-400 transition-all duration-1000 ease-linear drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 70}
                      strokeDashoffset={(2 * Math.PI * 70) * (1 - Math.max(0, ballCountdown) / Math.max(1, turnDuration))}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  {/* Orbital 3D Glass Lottery Sphere */}
                  <div
                    className={`relative w-36 h-36 sm:w-42 sm:h-42 rounded-full border-4 border-cyan-400/60 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 shadow-[0_0_40px_rgba(6,182,212,0.35)] flex items-center justify-center overflow-hidden ${
                      isSpinning ? 'animate-spin-slow' : ''
                    }`}
                    style={{
                      perspective: '1000px',
                    }}
                  >
                    {/* Glass chamber internal reflections */}
                    <div className="absolute inset-2 rounded-full border border-cyan-300/30 bg-[radial-gradient(ellipse_at_30%_30%,rgba(255,255,255,0.35),transparent_60%)] pointer-events-none" />

                    {/* Agitated Floating Tumble Balls inside glass chamber */}
                    {chamberParticles.map((pt) => {
                      return (
                        <div
                          key={pt.id}
                          className={`absolute rounded-full flex items-center justify-center text-[8px] font-mono font-bold text-slate-950 shadow-sm transition-transform duration-300 ${
                            isSpinning ? 'scale-110' : 'scale-90 opacity-80'
                          }`}
                          style={{
                            width: `${pt.size}px`,
                            height: `${pt.size}px`,
                            left: `${pt.x}%`,
                            top: `${pt.y}%`,
                            backgroundColor: pt.color,
                            boxShadow: `0 0 8px ${pt.color}`,
                            transform: isSpinning
                              ? `translate(${(Math.random() - 0.5) * 40}px, ${(Math.random() - 0.5) * 40}px)`
                              : 'none',
                          }}
                        >
                          {pt.num}
                        </div>
                      );
                    })}

                    {/* Center Energy Core Vortex */}
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-amber-400/80 bg-amber-500/20 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse">
                      ⚡
                    </div>
                  </div>

                  {/* Live Countdown Badge Overlay */}
                  <div className="absolute -bottom-2 px-3 py-1 rounded-full bg-slate-950/95 border-2 border-amber-400 text-amber-300 font-mono font-black text-xs shadow-xl flex items-center gap-1.5 z-10">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>⏱ {ballCountdown}s</span>
                  </div>
                </div>

                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 mt-4">
                  LỒNG CẦU QUAY SỐ 3D ({turnDuration}S/SỐ)
                </div>
              </div>

              {/* Center: Sleek Ball Chute & Ejection Animation */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  SỐ VỪA QUAY RA
                </span>

                {currentDrawnBall ? (
                  <div className="relative flex flex-col items-center">
                    {/* 3D Ejected Glowing Lottery Sphere */}
                    <div
                      className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr ${
                        getBallColorStyle(currentDrawnBall).bg
                      } border-4 border-white shadow-[0_12px_45px_rgba(251,191,36,0.85)] flex flex-col items-center justify-center ${
                        getBallColorStyle(currentDrawnBall).text
                      } font-black font-mono transition-all duration-300 ${
                        isEjecting ? 'scale-125 rotate-12' : 'scale-100 rotate-0'
                      }`}
                    >
                      {/* 3D Curved Specular Sheen */}
                      <div className="absolute top-2 left-4 w-10 sm:w-14 h-5 sm:h-7 bg-white/75 rounded-full rotate-[-25deg] pointer-events-none" />

                      <span className="text-[10px] sm:text-xs opacity-75 uppercase tracking-tighter -mb-1">
                        LÔ TÔ
                      </span>
                      <span className="text-4xl sm:text-6xl leading-none drop-shadow-md">
                        {currentDrawnBall}
                      </span>
                    </div>

                    {/* Laser Scanner Ring Underneath */}
                    <div className="w-24 sm:w-32 h-3 mt-2 rounded-full bg-amber-400/40 blur-sm animate-pulse" />
                  </div>
                ) : (
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-900 border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs text-center p-3">
                    Đang chuẩn bị quay số...
                  </div>
                )}
              </div>

              {/* Right: History Tape of Last 6 Balls */}
              <div className="flex flex-col items-center md:items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Các số vừa xổ gần nhất:
                </span>
                <div className="flex flex-wrap md:flex-col gap-1.5 items-center md:items-end">
                  {drawnNumbersList.slice(-6).reverse().map((num, idx) => {
                    const style = getBallColorStyle(num);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full border ${style.badge} font-mono font-bold text-xs shadow animate-in fade-in`}
                      >
                        <span className="text-[10px] opacity-75">#{drawnNumbersList.length - idx}</span>
                        <span className="text-sm font-black">{num}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Host Controls Console */}
            {isHost && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 w-full flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Chủ phòng:</span>
                  <button
                    onClick={() => setIsAutoDrawing(!isAutoDrawing)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isAutoDrawing
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isAutoDrawing ? '⏸ Tạm Dừng Tự Động' : '▶ Tiếp Tục Tự Động'}
                  </button>

                  <button
                    onClick={handleManualNextBall}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all active:scale-95"
                  >
                    🎲 Quay Số Tiếp Theo
                  </button>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-300">
                    <span>⏱ {turnDuration}s/số</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAutoDaub(!autoDaub)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      autoDaub
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {autoDaub ? '⚡ Tự Động Dò: Bật' : '🖐 Tự Tay Dò: Bật'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PLAYER TICKET & CLAIM BAR */}
          {myPlayer && (
            <div className="w-full max-w-4xl mx-auto space-y-4">
              {/* ACTION BAR: BIG BÁO KINH BUTTON */}
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Vé của bạn:</span>
                  <strong className="text-white font-semibold">{myPlayer.ticket.name}</strong>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">
                    Đã trúng:{' '}
                    <strong className="text-amber-400 font-mono">
                      {myPlayer.ticket.board.flat().filter((c) => c.marked).length}
                    </strong> / 15 số
                  </span>
                </div>

                <button
                  onClick={handleClaimKinh}
                  className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl flex items-center gap-2 ${
                    heroHasWinningRow
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 ring-4 ring-amber-400 animate-bounce shadow-amber-500/60 scale-105'
                      : 'bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white hover:from-fuchsia-500 hover:to-rose-500 shadow-fuchsia-600/30 active:scale-95'
                  }`}
                >
                  <span>🏆 BÁO KINH!</span>
                  {heroHasWinningRow ? <span>(ĐÃ ĐỦ 5 SỐ HÀNG NGANG!)</span> : <span>(ĂM TRỌN ${totalPrizePool.toLocaleString()})</span>}
                </button>
              </div>

              {/* AUTHENTIC 3x9 LÔ TÔ TICKET BOARD */}
              <div className="rounded-2xl sm:rounded-3xl bg-slate-900/95 border-2 border-amber-500/60 p-2 sm:p-5 shadow-2xl backdrop-blur-md overflow-x-auto touch-pan-x scrollbar-none">
                <div className="min-w-[320px] sm:min-w-0">
                  <div className="flex items-center justify-between mb-2 sm:mb-3 px-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        VÉ LÔ TÔ TRUYỀN THỐNG
                      </span>
                      <span className="text-slate-400 hidden sm:inline">(Chạm vào số đã xổ để đóng dấu sao)</span>
                    </div>
                    <div className="text-slate-400 text-[10px] sm:text-[11px]">
                      Thắng: Đủ 5 số trên bất kỳ hàng nào
                    </div>
                  </div>

                  {/* 3 Rows of 9 Cells Matrix */}
                  <div className="grid grid-rows-3 gap-1 sm:gap-2">
                    {myPlayer.ticket.board.map((row, rIdx) => {
                      const numbersInRow = row.filter((c) => c.value !== null);
                      const markedCount = numbersInRow.filter((c) => c.marked).length;
                      const isRowComplete = markedCount === 5;

                      return (
                        <div
                          key={rIdx}
                          className={`grid grid-cols-9 gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl transition-all ${
                            isRowComplete
                              ? 'bg-amber-500/25 ring-2 ring-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.5)] animate-pulse'
                              : 'bg-slate-950/80 border border-slate-800'
                          }`}
                        >
                          {row.map((cell, cIdx) => {
                            if (cell.value === null) {
                              return (
                                <div
                                  key={cell.id}
                                  className="aspect-[4/3] sm:aspect-square rounded-lg sm:rounded-xl bg-slate-900/40 border border-dashed border-slate-800 flex items-center justify-center pointer-events-none"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                                </div>
                              );
                            }

                            const wasDrawn = drawnNumbersList.includes(cell.value);

                            return (
                              <div
                                key={cell.id}
                                onClick={() => handleCellClick(rIdx, cIdx)}
                                className={`relative aspect-[4/3] sm:aspect-square rounded-lg sm:rounded-xl flex items-center justify-center font-mono font-black text-xs sm:text-xl cursor-pointer transition-all duration-200 select-none shadow-md ${
                                  cell.marked
                                    ? 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-2 border-yellow-200 ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.8)] scale-95'
                                    : wasDrawn
                                    ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border-2 border-emerald-400 animate-pulse'
                                    : 'bg-white hover:bg-slate-100 text-slate-950 border-2 border-slate-300 hover:border-amber-400'
                                }`}
                            >
                              <span>{cell.value}</span>

                              {/* Traditional Star Stamp when marked */}
                              {cell.marked && (
                                <div className="absolute inset-1 rounded-full border-2 border-amber-950/40 flex items-center justify-center pointer-events-none">
                                  <span className="text-[10px] sm:text-xs font-serif font-black text-amber-950">
                                    ★
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

              {/* OTHER HUMAN PARTICIPANTS ROSTER MINI BAR */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Người chơi khác ({currentRoom.players.length - 1} người):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {currentRoom.players
                    .filter((p) => p.id !== currentUser?.id)
                    .map((other) => {
                      const markedCount = other.ticket.board.flat().filter((c) => c.marked).length;
                      return (
                        <div
                          key={other.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: other.avatarColor }}
                          >
                            {other.name.charAt(0)}
                          </div>
                          <span className="text-slate-300 font-medium truncate max-w-[90px]">{other.name}</span>
                          <span className="text-amber-400 font-mono text-[11px]">({markedCount}/15)</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* MASTER 90-BALL BOARD MODAL */}
          {showMasterBoard && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-2xl bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85dvh]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h3 className="font-bold text-white text-sm sm:text-base">
                      Bảng Tra Cứu 90 Số Lô Tô
                    </h3>
                    <span className="text-xs font-mono text-amber-400">
                      ({drawnNumbersList.length}/90 đã xổ)
                    </span>
                  </div>
                  <button
                    onClick={() => setShowMasterBoard(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-10 gap-1.5 p-1">
                  {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
                    const isDrawn = drawnNumbersList.includes(num);
                    return (
                      <div
                        key={num}
                        className={`aspect-square rounded-xl flex items-center justify-center font-mono font-bold text-xs sm:text-sm border transition-all ${
                          isDrawn
                            ? 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 font-black border-yellow-200 shadow-md'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setShowMasterBoard(false)}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
                  >
                    Đóng Bảng
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Broadcast Footer */}
      <footer className="p-3 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500">
        Lô Tô Phòng Nhiều Người · Giải thưởng tích lũy = Giá vé × Tổng người chơi · Không giới hạn người tham gia · Đủ 5 số trên bất kỳ hàng nào là Báo Kinh!
      </footer>
    </div>
  );
};
