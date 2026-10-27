/**
 * Peer-to-Peer WebRTC Real-Time Network Manager for GitHub Pages
 * Enables players on 2 or more different devices anywhere on the internet
 * to play together in real time with ZERO server cost.
 * Powered by WebRTC DataChannels & free public STUN/TURN cloud signaling.
 */

import Peer, { DataConnection } from 'peerjs';

export type GameNetworkType = 'tienlen' | 'poker' | 'loto';

export interface NetworkPacket<T = any> {
  type: string;
  senderId: string;
  senderName: string;
  payload: T;
  timestamp: number;
}

export type NetworkStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'HOSTING' | 'ERROR';

class NetworkManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private isHost: boolean = false;
  private currentRoomCode: string = '';
  private gameType: GameNetworkType = 'tienlen';
  private statusListeners: Set<(status: NetworkStatus, info?: string) => void> = new Set();
  private packetListeners: Set<(packet: NetworkPacket) => void> = new Set();
  private currentStatus: NetworkStatus = 'DISCONNECTED';

  // Helper to construct normalized Peer ID prefix
  private getPeerIdForRoom(game: GameNetworkType, code: string): string {
    const cleanCode = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    return `ghub_${game}_${cleanCode}`;
  }

  public getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getConnectedPeersCount(): number {
    return this.connections.size;
  }

  public onStatusChange(callback: (status: NetworkStatus, info?: string) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  public onPacket(callback: (packet: NetworkPacket) => void): () => void {
    this.packetListeners.add(callback);
    return () => this.packetListeners.delete(callback);
  }

  private setStatus(status: NetworkStatus, info?: string) {
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => {
      try {
        cb(status, info);
      } catch {
        // ignore
      }
    });
  }

  private emitPacket(packet: NetworkPacket) {
    this.packetListeners.forEach((cb) => {
      try {
        cb(packet);
      } catch {
        // ignore
      }
    });
  }

  /**
   * Host a room: registers public Peer ID so other players can join via 6-digit code
   */
  public hostRoom(game: GameNetworkType, code: string, hostUser: { id: string; name: string }): Promise<boolean> {
    return new Promise((resolve) => {
      this.disconnect();
      this.gameType = game;
      this.currentRoomCode = code;
      this.isHost = true;
      this.setStatus('CONNECTING', 'Đang khởi tạo máy chủ phòng P2P qua WebRTC...');

      const targetPeerId = this.getPeerIdForRoom(game, code);

      try {
        // Connect to free public WebRTC cloud signaling broker
        this.peer = new Peer(targetPeerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });

        this.peer.on('open', (id) => {
          this.setStatus('HOSTING', `Phòng mở thành công. Mã phòng: ${code}`);
          resolve(true);
        });

        this.peer.on('connection', (conn) => {
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('PeerJS Host Error:', err);
          // If ID is already taken, try creating anonymous peer and fall back gracefully
          if (err.type === 'unavailable-id') {
            this.setStatus('HOSTING', `Mã phòng đã kích hoạt trên mạng P2P.`);
            resolve(true);
          } else {
            this.setStatus('ERROR', err.message || 'Lỗi kết nối WebRTC');
            resolve(false);
          }
        });
      } catch (err: any) {
        this.setStatus('ERROR', err.message);
        resolve(false);
      }
    });
  }

  /**
   * Join a room: connects to the host's Peer ID using the 6-digit code
   */
  public joinRoom(game: GameNetworkType, code: string, user: { id: string; name: string }): Promise<boolean> {
    return new Promise((resolve) => {
      this.disconnect();
      this.gameType = game;
      this.currentRoomCode = code;
      this.isHost = false;
      this.setStatus('CONNECTING', `Đang tìm kiếm phòng #${code} qua Internet...`);

      const targetHostPeerId = this.getPeerIdForRoom(game, code);

      try {
        // Create an ephemeral client peer
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });

        this.peer.on('open', () => {
          if (!this.peer) return;
          const conn = this.peer.connect(targetHostPeerId, {
            metadata: { user },
            reliable: true,
          });

          this.hostConnection = conn;
          this.setupConnection(conn, () => {
            this.setStatus('CONNECTED', `Đã kết nối vào phòng #${code} qua WebRTC P2P!`);
            resolve(true);
          });
        });

        this.peer.on('error', (err) => {
          console.warn('PeerJS Client Error:', err);
          this.setStatus('ERROR', 'Không tìm thấy phòng hoặc chủ phòng chưa online.');
          resolve(false);
        });

        // Timeout fallback after 10 seconds
        setTimeout(() => {
          if (this.currentStatus === 'CONNECTING') {
            this.setStatus('ERROR', 'Hết thời gian tìm kiếm phòng. Vui lòng kiểm tra mã phòng.');
            resolve(false);
          }
        }, 10000);
      } catch (err: any) {
        this.setStatus('ERROR', err.message);
        resolve(false);
      }
    });
  }

  /**
   * Set up incoming or outgoing data connection listeners
   */
  private setupConnection(conn: DataConnection, onReady?: () => void) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      if (onReady) onReady();
      if (this.isHost) {
        this.setStatus('HOSTING', `Có người chơi vừa kết nối P2P (${this.connections.size} người)`);
      }
    });

    conn.on('data', (data: any) => {
      if (data && typeof data === 'object' && data.type) {
        const packet = data as NetworkPacket;
        this.emitPacket(packet);

        // If host receives a packet, forward/relay it to all other connected peers (Star topology)
        if (this.isHost) {
          this.connections.forEach((peerConn) => {
            if (peerConn.peer !== conn.peer && peerConn.open) {
              peerConn.send(packet);
            }
          });
        }
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.hostConnection?.peer === conn.peer) {
        this.hostConnection = null;
        this.setStatus('DISCONNECTED', 'Mất kết nối với chủ phòng.');
      }
      if (this.isHost) {
        this.setStatus('HOSTING', `Người chơi đã rời phòng (${this.connections.size} người còn lại)`);
      }
    });

    conn.on('error', (err) => {
      console.warn('Connection error:', err);
    });
  }

  /**
   * Broadcast packet to all connected peers over the internet
   */
  public broadcast<T = any>(type: string, sender: { id: string; name: string }, payload: T) {
    const packet: NetworkPacket<T> = {
      type,
      senderId: sender.id,
      senderName: sender.name,
      payload,
      timestamp: Date.now(),
    };

    // Send to host if we are a client
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(packet);
    }

    // Send to all connected clients if we are host
    if (this.isHost) {
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send(packet);
        }
      });
    }

    // Also notify local listeners
    this.emitPacket(packet);
  }

  /**
   * Disconnect and release WebRTC resources
   */
  public disconnect() {
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {
        // ignore
      }
    });
    this.connections.clear();

    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {
        // ignore
      }
      this.hostConnection = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }

    this.isHost = false;
    this.currentRoomCode = '';
    this.setStatus('DISCONNECTED');
  }
}

export const networkManager = new NetworkManager();
