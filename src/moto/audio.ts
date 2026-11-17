import { getExhaustMod, type ExhaustModId } from './catalog';

export class MotoAudioEngine {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private muted = false;
  private initialized = false;

  unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineFilter.Q.value = 2.4;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      const oscPrimary = ctx.createOscillator();
      oscPrimary.type = 'sawtooth';
      oscPrimary.frequency.value = 55;

      const oscSub = ctx.createOscillator();
      oscSub.type = 'triangle';
      oscSub.frequency.value = 27.5;

      oscPrimary.connect(engineFilter);
      oscSub.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);

      oscPrimary.start();
      oscSub.start();

      // Subtle wind rush noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windFilter.Q.value = 0.8;

      const windGain = ctx.createGain();
      windGain.gain.value = 0;

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();

      this.oscPrimary = oscPrimary;
      this.oscSub = oscSub;
      this.engineFilter = engineFilter;
      this.engineGain = engineGain;
      this.windGain = windGain;
      this.initialized = true;
    } catch {
      // Audio unavailable in headless / restricted environments
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.silence();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  silence() {
    if (!this.ctx || !this.engineGain || !this.windGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, now, 0.04);
    this.windGain.gain.setTargetAtTime(0, now, 0.04);
  }

  updateEngine(
    rpm: number,
    speedKmh: number,
    cylinders: 1 | 2 | 4,
    nitroActive: boolean,
    active: boolean,
    exhaustMod: ExhaustModId = 'oem',
  ) {
    if (!this.ctx || !this.oscPrimary || !this.oscSub || !this.engineGain || !this.engineFilter || !this.windGain) {
      return;
    }
    const now = this.ctx.currentTime;
    if (this.muted || !active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      this.windGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const exhaust = getExhaustMod(exhaustMod);
    // Inline-4 (ZX-25R / R1M / BMW / V4R) > Parallel-Twin (CBR250RR) > Single (R15 / CBR150 / GSX)
    const firingMult = cylinders === 4 ? 2.0 : cylinders === 2 ? 1.35 : 0.85;
    const baseHz = Math.max(24, (rpm / 60) * firingMult);
    this.oscPrimary.frequency.setTargetAtTime(baseHz, now, 0.03);
    this.oscSub.frequency.setTargetAtTime(baseHz * 0.5, now, 0.03);

    const filterCutoff = 240 + (rpm / 17000) * 1850 + (nitroActive ? 650 : 0) + exhaust.soundCutoffBoost;
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.04);

    const targetGain = 0.055 + Math.min(0.06, (rpm / 17000) * 0.06) + exhaust.soundGainBoost;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);

    const windVol = Math.min(0.065, Math.max(0, (speedKmh - 45) / 260) * 0.065);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
  }

  playCrashImpact(fatal: boolean) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fatal ? 130 : 170, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + (fatal ? 0.45 : 0.22));
    gain.gain.setValueAtTime(fatal ? 0.34 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (fatal ? 0.5 : 0.25));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (fatal ? 0.52 : 0.26));

    // Metallic crunch burst
    const len = Math.floor(ctx.sampleRate * (fatal ? 0.38 : 0.18));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.32));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    const nGain = ctx.createGain();
    nGain.gain.value = fatal ? 0.28 : 0.16;
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  playNearMiss() {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  dispose() {
    try {
      this.oscPrimary?.stop();
      this.oscSub?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.initialized = false;
  }
}
