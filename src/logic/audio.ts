/**
 * Web Audio API Sound Synthesizer for Casino Poker Sound Effects
 * High fidelity synthesized audio: cards, chips clink, table knocks, chimes.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Read mute preference from localStorage if available
    try {
      const stored = localStorage.getItem('poker_sound_muted');
      if (stored !== null) {
        this.isMuted = stored === 'true';
      }
    } catch {
      // ignore
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('poker_sound_muted', String(muted));
    } catch {
      // ignore
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sound of card dealing (air swoosh + soft snap)
   */
  public playCardDeal() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Noise buffer for swoosh
      const bufferSize = this.ctx.sampleRate * 0.08;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(400, t + 0.07);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(t);
      whiteNoise.stop(t + 0.08);

      // Soft snap
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t + 0.02);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.06);

      oscGain.gain.setValueAtTime(0.25, t + 0.02);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(t + 0.02);
      osc.stop(t + 0.06);
    } catch {
      // Audio playback failed silently
    }
  }

  /**
   * Sound of chips clinking when betting or calling
   */
  public playChips() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // 3 rapid micro clicks to simulate ceramic chips hitting each other
      const times = [0, 0.035, 0.07];
      const freqs = [3200, 4100, 2800];

      times.forEach((offset, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqs[idx], t + offset);
        osc.frequency.exponentialRampToValueAtTime(1200, t + offset + 0.04);

        gain.gain.setValueAtTime(0.25, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.04);
      });
    } catch {
      // Audio error silently caught
    }
  }

  /**
   * Sound of double tap / knock on the felt table (Checking)
   */
  public playCheck() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      [0, 0.11].forEach((offset) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, t + offset);
        osc.frequency.exponentialRampToValueAtTime(50, t + offset + 0.08);

        gain.gain.setValueAtTime(0.4, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.08);
      });
    } catch {
      // Audio error silently caught
    }
  }

  /**
   * Sound of folding cards (gentle slide/swoosh)
   */
  public playFold() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    } catch {
      // Audio error silently caught
    }
  }

  /**
   * Dramatic All-In sound
   */
  public playAllIn() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const notes = [220, 277.18, 329.63, 440]; // A major chord
      notes.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.6);
      });
      // Chips clinking together
      this.playChips();
    } catch {
      // Audio error silently caught
    }
  }

  /**
   * Triumphant Win chime / Fanfare
   */
  public playWin() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      arpeggio.forEach((note, idx) => {
        if (!this.ctx) return;
        const offset = idx * 0.1;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, t + offset);

        gain.gain.setValueAtTime(0.25, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.4);
      });
    } catch {
      // Audio error silently caught
    }
  }

  /**
   * UI Click sound
   */
  public playClick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.03);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.03);
    } catch {
      // Audio error silently caught
    }
  }

  /**
   * Sound of card slap on table (Cybergame card throw slam)
   */
  public playCardSlap() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Heavy felt thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);

      // Card surface click
      const snap = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snap.type = 'sine';
      snap.frequency.setValueAtTime(1600, t);
      snap.frequency.exponentialRampToValueAtTime(300, t + 0.04);
      snapGain.gain.setValueAtTime(0.35, t);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      snap.connect(snapGain);
      snapGain.connect(this.ctx.destination);
      snap.start(t);
      snap.stop(t + 0.04);
    } catch {
      // silent
    }
  }

  /**
   * Sound of picking / lifting card from hand
   */
  public playCardLift() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(950, t + 0.06);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    } catch {
      // silent
    }
  }

  /**
   * Dramatic slice / laser for "Chặt Heo" or "Tứ Quý"
   */
  public playChop() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Pitch sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.35);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);

      // Clink
      this.playChips();
    } catch {
      // silent
    }
  }

  /**
   * Sound of Lô Tô drum rolling balls
   */
  public playLotoDrumRoll() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // 5 micro clicks representing balls rolling inside metallic cage
      const times = [0, 0.04, 0.09, 0.14, 0.2];
      times.forEach((offset, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + idx * 120, t + offset);
        osc.frequency.exponentialRampToValueAtTime(300, t + offset + 0.03);
        gain.gain.setValueAtTime(0.18, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.03);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.03);
      });
    } catch {
      // silent
    }
  }

  /**
   * Sound of ball dropping into chute
   */
  public playLotoBallDrop() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Pop / drop tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.09);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);

      // High resonant ping
      const ping = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(1046.5, t + 0.02); // C6
      pingGain.gain.setValueAtTime(0.2, t + 0.02);
      pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      ping.connect(pingGain);
      pingGain.connect(this.ctx.destination);
      ping.start(t + 0.02);
      ping.stop(t + 0.18);
    } catch {
      // silent
    }
  }

  /**
   * Sound of placing stone/chip onto Lô Tô ticket (Daub)
   */
  public playLotoDaub() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch {
      // silent
    }
  }

  /**
   * Dramatic victory fanfare for "KINH RỒI!"
   */
  public playLotoKinh() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // Fanfare: G4, C5, E5, G5, C6 triumphant
      const notes = [392, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const offset = idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + offset);
        gain.gain.setValueAtTime(0.3, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.5);
      });
    } catch {
      // silent
    }
  }
}

export const sounds = new SoundSystem();
