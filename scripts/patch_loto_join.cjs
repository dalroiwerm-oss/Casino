const fs = require('fs');
let code = fs.readFileSync('src/games/loto/LotoGame.tsx', 'utf8');

const target = '  const handleJoinRoom = (codeOrId: string) => {';
const replacement = `  const handleJoinRoom = async (codeOrId: string) => {
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
          setErrorMessage(\`Bạn cần tối thiểu $\${targetTicketPrice.toLocaleString()} chip để mua vé vào phòng này!\`);
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
        showToast(\`Đã tham gia phòng [\${formatted.name}] thành công!\`);
        return;
      }
    } catch {
      // fallback
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/games/loto/LotoGame.tsx', code, 'utf8');
console.log('Patched handleJoinRoom in LotoGame.tsx');
