const fs = require('fs');

console.log('=== Starting Online Hub Synchronization ===');

// --- 1. POKER ROOM MODAL ---
let pokerModal = fs.readFileSync('src/components/PokerRoomModal.tsx', 'utf8');

if (!pokerModal.includes('await onlineHub.joinRoom(')) {
  const targetJoin = '    const result = joinRoom(';
  const serverJoinSnippet = `    // Try central server join first for seamless cross-device joining
    const serverJoin = await onlineHub.joinRoom(
      cleaned,
      {
        id: currentUser.id,
        name: currentUser.name,
        avatarColor: currentUser.avatarColor,
        chips: currentUser.chips,
      },
      passwordToUse || joinPassword
    );

    if (serverJoin.success && serverJoin.room) {
      const sr = serverJoin.room;
      const formatted = {
        id: sr.id,
        code: sr.code,
        name: sr.name,
        hostId: sr.hostId,
        hostName: sr.hostName,
        smallBlind: sr.smallBlind || 25,
        bigBlind: sr.bigBlind || 50,
        buyIn: sr.buyIn || 2500,
        maxPlayers: sr.maxPlayers || 6,
        turnTimeSeconds: sr.turnTimeSeconds || 15,
        status: sr.status,
        createdAt: sr.createdAt,
        players: sr.players,
        messages: [],
      };
      sounds.playChips();
      setCurrentRoom(formatted);
      const allRooms = getStoredRooms();
      saveRooms([formatted, ...allRooms.filter((r) => r.id !== formatted.id)]);
      showToast(\`Đã tham gia phòng [\${formatted.name}] thành công!\`);

      networkManager.joinRoom('poker', cleaned, {
        id: currentUser.id,
        name: currentUser.name,
      }).then((conn) => {
        if (conn) {
          networkManager.broadcast('PK_PLAYER_JOIN', currentUser, {
            id: currentUser.id,
            name: currentUser.name,
            avatarColor: currentUser.avatarColor || '#f59e0b',
            chips: currentUser.chips,
          });
        }
      });
      return;
    }

    const result = joinRoom(`;

  pokerModal = pokerModal.replace(targetJoin, serverJoinSnippet);
  fs.writeFileSync('src/components/PokerRoomModal.tsx', pokerModal, 'utf8');
  console.log('[OK] PokerRoomModal.tsx updated with server join');
} else {
  console.log('[SKIP] PokerRoomModal.tsx already has server join');
}

// --- 2. POKER GAME (Dual-Channel Event Bus) ---
let pokerGame = fs.readFileSync('src/components/PokerGame.tsx', 'utf8');
if (!pokerGame.includes('onlineHub')) {
  pokerGame = pokerGame.replace(
    "import { networkManager, NetworkPacket } from '../logic/network';",
    "import { networkManager, NetworkPacket } from '../logic/network';\nimport { onlineHub } from '../logic/onlineHub';"
  );
}

// Send event in executeAction
if (!pokerGame.includes("onlineHub.sendGameEvent(roomConfig.roomId, 'PK_REMOTE_ACTION'")) {
  const broadcastTarget = "        networkManager.broadcast('PK_REMOTE_ACTION', { id: playerId, name: player.name }, {\n          action,\n          amount,\n          labelVi,\n        });";
  const replacement = `        networkManager.broadcast('PK_REMOTE_ACTION', { id: playerId, name: player.name }, {
          action,
          amount,
          labelVi,
        });
        onlineHub.sendGameEvent(roomConfig.roomId, 'PK_REMOTE_ACTION', { id: playerId, name: player.name }, {
          action,
          amount,
          labelVi,
        });`;
  pokerGame = pokerGame.replace(broadcastTarget, replacement);
}

// Polling server events in PokerGame
if (!pokerGame.includes("onlineHub.getGameEvents(roomConfig.roomId")) {
  const listenerTarget = `  // Listen to remote P2P WebRTC actions in Poker room
  useEffect(() => {
    if (!roomConfig) return;
    const unsub = networkManager.onPacket((packet: NetworkPacket) => {
      if (packet.type === 'PK_REMOTE_ACTION' && packet.senderId !== players[0]?.id) {
        const { action, amount, labelVi } = packet.payload;
        executeActionRef.current(packet.senderId, action, amount, labelVi);
      }
    });
    return () => unsub();
  }, [roomConfig, players]);`;

  const replacementListener = `  // Listen to remote P2P WebRTC actions in Poker room + Dual Channel Central Server
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
  }, [roomConfig, players]);`;

  pokerGame = pokerGame.replace(listenerTarget, replacementListener);
}

fs.writeFileSync('src/components/PokerGame.tsx', pokerGame, 'utf8');
console.log('[OK] PokerGame.tsx updated with dual-channel sync');

// --- 3. TIEN LEN GAME (Background Event Bus Polling) ---
let tienLenGame = fs.readFileSync('src/games/tienlen/TienLenGame.tsx', 'utf8');
if (!tienLenGame.includes('onlineHub.getGameEvents(roomConfig.id')) {
  const tlListenerTarget = `    return () => unsub();
  }, [roomConfig, currentUser, players, currentTurnIdx]);`;

  const tlReplacement = `    return () => unsub();
  }, [roomConfig, currentUser, players, currentTurnIdx]);

  // Dual-channel server event polling for Tien Len
  const lastTlEventTimeRef = useRef<number>(Date.now() - 10000);
  const processedTlEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!roomConfig) return;
    const interval = setInterval(async () => {
      try {
        const events = await onlineHub.getGameEvents(roomConfig.id, lastTlEventTimeRef.current);
        if (!events || events.length === 0) return;

        for (const ev of events) {
          if (processedTlEventIdsRef.current.has(ev.id)) continue;
          processedTlEventIdsRef.current.add(ev.id);
          if (ev.timestamp > lastTlEventTimeRef.current) {
            lastTlEventTimeRef.current = ev.timestamp;
          }

          if (ev.type === 'TL_REMOTE_DEAL' && currentUser?.id !== roomConfig.hostId) {
            const { hands, startingPlayer } = ev.payload;
            sounds.playCardDeal();
            const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
            const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 1;
            const numP = players.length;

            const mappedHands = [];
            for (let i = 0; i < numP; i++) {
              const originalSeat = (effectiveMySeat + i) % numP;
              mappedHands.push(hands[originalSeat] || []);
            }

            setPlayers((prev) =>
              prev.map((p, idx) => ({
                ...p,
                cards: mappedHands[idx] || [],
                passed: false,
              }))
            );
            setLastPlay(null);
            setSelectedCardIds(new Set());
            const relativeStarting = (startingPlayer - effectiveMySeat + numP) % numP;
            setCurrentTurnIdx(relativeStarting);
            setGameState('PLAYING');
            sounds.playChips();
          } else if (ev.type === 'TL_REMOTE_PLAY' && ev.senderId !== currentUser?.id) {
            const senderInRoom = roomConfig.players.find((p) => p.id === ev.senderId);
            const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
            const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 0;
            const senderIdx = senderInRoom ? roomConfig.players.findIndex((p) => p.id === senderInRoom.id) : 1;
            const numP = players.length;
            const relativeSeat = (senderIdx - effectiveMySeat + numP) % numP;
            executePlayerPlay(relativeSeat, ev.payload.play);
          } else if (ev.type === 'TL_REMOTE_PASS' && ev.senderId !== currentUser?.id) {
            const senderInRoom = roomConfig.players.find((p) => p.id === ev.senderId);
            const myRoomIdx = roomConfig.players.findIndex((p) => p.id === currentUser?.id);
            const effectiveMySeat = myRoomIdx >= 0 ? myRoomIdx : 0;
            const senderIdx = senderInRoom ? roomConfig.players.findIndex((p) => p.id === senderInRoom.id) : 1;
            const numP = players.length;
            const relativeSeat = (senderIdx - effectiveMySeat + numP) % numP;
            executePlayerPass(relativeSeat);
          }
        }
      } catch (err) {
        // ignore
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [roomConfig, currentUser, players]);`;

  tienLenGame = tienLenGame.replace(tlListenerTarget, tlReplacement);
  fs.writeFileSync('src/games/tienlen/TienLenGame.tsx', tienLenGame, 'utf8');
  console.log('[OK] TienLenGame.tsx updated with dual-channel polling');
}

// --- 4. LOTO GAME & ROOM SYNC ---
let lotoGame = fs.readFileSync('src/games/loto/LotoGame.tsx', 'utf8');
if (!lotoGame.includes("import { onlineHub } from '../../logic/onlineHub';")) {
  lotoGame = lotoGame.replace(
    "import { networkManager, NetworkPacket, NetworkStatus } from '../../logic/network';",
    "import { networkManager, NetworkPacket, NetworkStatus } from '../../logic/network';\nimport { onlineHub } from '../../logic/onlineHub';"
  );
}

// Upgrade reloadRooms to fetch server rooms
if (!lotoGame.includes("const serverList = await onlineHub.getRooms('loto');")) {
  const oldReloadRooms = `  // Sync rooms across tabs & storage
  const reloadRooms = useCallback(() => {
    const list = getStoredLotoRooms();
    setAvailableRooms(list);

    if (currentRoom) {
      const refreshed = list.find((r) => r.id === currentRoom.id);
      if (refreshed) {
        setCurrentRoom(refreshed);

        // Check view state transition based on room status
        if (refreshed.status === 'PLAYING') {
          setViewState('ROOM_PLAYING');
        } else if (refreshed.status === 'WAITING') {
          setViewState('ROOM_WAITING');
        }
      } else {
        // Room was closed
        setCurrentRoom(null);
        setViewState('LOBBY');
      }
    }
  }, [currentRoom]);`;

  const newReloadRooms = `  // Sync rooms across tabs & Central Server
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
  }, [currentRoom]);`;

  lotoGame = lotoGame.replace(oldReloadRooms, newReloadRooms);
}

// Upgrade room creation and join in LotoGame
if (!lotoGame.includes("await onlineHub.saveRoom({")) {
  const oldCreateLoto = `    const newRoom = createLotoRoom({
      name: roomNameInput.trim() || \`Phòng của \${currentUser.name}\`,
      ticketPrice: ticketPriceInput,
      turnTimeSeconds: finalTurnTime,
      hostUser: currentUser,
    });

    sounds.playChips();
    setCurrentRoom(newRoom);
    setViewState('ROOM_WAITING');
    showToast(\`Đã tạo phòng thành công! Mã phòng: \${newRoom.code}\`);

    // Register host on WebRTC P2P network
    networkManager.hostRoom('loto', newRoom.code, { id: currentUser.id, name: currentUser.name });`;

  const newCreateLoto = `    const newRoom = createLotoRoom({
      name: roomNameInput.trim() || \`Phòng của \${currentUser.name}\`,
      ticketPrice: ticketPriceInput,
      turnTimeSeconds: finalTurnTime,
      hostUser: currentUser,
    });

    sounds.playChips();
    setCurrentRoom(newRoom);
    setViewState('ROOM_WAITING');
    showToast(\`Đã tạo phòng thành công! Mã phòng: \${newRoom.code}\`);

    // Register to central server for cross-device discovery
    await onlineHub.saveRoom({
      id: newRoom.id,
      game: 'loto',
      code: newRoom.code,
      name: newRoom.name,
      hostId: currentUser.id,
      hostName: currentUser.name,
      status: 'WAITING',
      maxPlayers: 20,
      ticketPrice: newRoom.ticketPrice,
      turnTimeSeconds: newRoom.turnTimeSeconds,
      players: newRoom.players,
      extraData: {
        drawSequence: newRoom.drawSequence,
        currentBallIndex: newRoom.currentBallIndex,
      },
      createdAt: newRoom.createdAt,
      lastActive: Date.now(),
    });

    // Register host on WebRTC P2P network
    networkManager.hostRoom('loto', newRoom.code, { id: currentUser.id, name: currentUser.name });`;

  lotoGame = lotoGame.replace('const handleCreateRoomSubmit = (e: React.FormEvent) => {', 'const handleCreateRoomSubmit = async (e: React.FormEvent) => {');
  lotoGame = lotoGame.replace(oldCreateLoto, newCreateLoto);
}

// Upgrade Loto ball draw to broadcast via onlineHub
if (!lotoGame.includes("onlineHub.sendGameEvent(currentRoom.id, 'LT_BALL_DRAW'")) {
  const oldBallDraw = `      if (currentUser && currentRoom.hostId === currentUser.id) {
        networkManager.broadcast('LT_BALL_DRAW', currentUser, {
          currentBallIndex: nextIdx,
          room: updatedRoom,
        });
      }`;

  const newBallDraw = `      if (currentUser && currentRoom.hostId === currentUser.id) {
        networkManager.broadcast('LT_BALL_DRAW', currentUser, {
          currentBallIndex: nextIdx,
          room: updatedRoom,
        });
        onlineHub.sendGameEvent(currentRoom.id, 'LT_BALL_DRAW', currentUser, {
          currentBallIndex: nextIdx,
          room: updatedRoom,
        });
      }`;

  lotoGame = lotoGame.replace(oldBallDraw, newBallDraw);
}

// Upgrade Loto claim Kinh to broadcast via onlineHub
if (!lotoGame.includes("onlineHub.sendGameEvent(currentRoom.id, 'LT_CLAIM_KINH'")) {
  const oldClaimKinh = `      if (currentUser) {
        networkManager.broadcast('LT_CLAIM_KINH', currentUser, {
          room: winRoom,
        });
      }`;

  const newClaimKinh = `      if (currentUser) {
        networkManager.broadcast('LT_CLAIM_KINH', currentUser, {
          room: winRoom,
        });
        onlineHub.sendGameEvent(currentRoom.id, 'LT_CLAIM_KINH', currentUser, {
          room: winRoom,
        });
      }`;

  lotoGame = lotoGame.replace(oldClaimKinh, newClaimKinh);
}

// Add polling loop for LotoGame events
if (!lotoGame.includes("onlineHub.getGameEvents(currentRoom.id")) {
  const lotoListenerEnd = `    return () => {
      unsubStatus();
      unsubPacket();
    };
  }, []);`;

  const lotoDualPoll = `    return () => {
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
  }, [currentRoom]);`;

  lotoGame = lotoGame.replace(lotoListenerEnd, lotoDualPoll);
}

fs.writeFileSync('src/games/loto/LotoGame.tsx', lotoGame, 'utf8');
console.log('[OK] LotoGame.tsx updated with dual-channel sync');

console.log('=== All files successfully synced! ===');
