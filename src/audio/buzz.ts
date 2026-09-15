/** Synthesized wing beats and night sounds. No assets, one AudioContext. */
export class BuzzAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wingA: OscillatorNode | null = null;
  private wingB: OscillatorNode | null = null;
  private wingFilter: BiquadFilterNode | null = null;
  private wingGain: GainNode | null = null;
  private feedGain: GainNode | null = null;
  private ambient: AudioBufferSourceNode | null = null;

  /** Call from a user gesture. */
  init(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // wing drone: two detuned saws through a lowpass
    this.wingFilter = ctx.createBiquadFilter();
    this.wingFilter.type = "lowpass";
    this.wingFilter.frequency.value = 900;
    this.wingGain = ctx.createGain();
    this.wingGain.gain.value = 0;
    this.wingA = ctx.createOscillator();
    this.wingA.type = "sawtooth";
    this.wingA.frequency.value = 480;
    this.wingB = ctx.createOscillator();
    this.wingB.type = "sawtooth";
    this.wingB.frequency.value = 487;
    this.wingA.connect(this.wingFilter);
    this.wingB.connect(this.wingFilter);
    this.wingFilter.connect(this.wingGain);
    this.wingGain.connect(this.master);
    this.wingA.start();
    this.wingB.start();

    // feeding hiss
    const feedNoise = ctx.createBufferSource();
    feedNoise.buffer = this.noiseBuffer();
    const feedFilter = ctx.createBiquadFilter();
    feedFilter.type = "bandpass";
    feedFilter.frequency.value = 2100;
    feedFilter.Q.value = 1.5;
    this.feedGain = ctx.createGain();
    this.feedGain.gain.value = 0;
    feedNoise.connect(feedFilter);
    feedFilter.connect(this.feedGain);
    this.feedGain.connect(this.master);
    feedNoise.loop = true;
    feedNoise.start();

    // room tone
    this.ambient = ctx.createBufferSource();
    this.ambient.buffer = this.noiseBuffer();
    const ambFilter = ctx.createBiquadFilter();
    ambFilter.type = "lowpass";
    ambFilter.frequency.value = 240;
    const ambGain = ctx.createGain();
    ambGain.gain.value = 0.03;
    this.ambient.connect(ambFilter);
    ambFilter.connect(ambGain);
    ambGain.connect(this.master);
    this.ambient.loop = true;
    this.ambient.start();
  }

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Wing tone tracks airspeed and throttle. */
  wing(speed: number, throttle: number): void {
    if (!this.ctx || !this.wingA || !this.wingB || !this.wingGain || !this.wingFilter) return;
    const t = this.ctx.currentTime;
    const f = 440 + Math.min(speed, 6) * 85;
    this.wingA.frequency.setTargetAtTime(f, t, 0.08);
    this.wingB.frequency.setTargetAtTime(f * 1.014, t, 0.08);
    this.wingFilter.frequency.setTargetAtTime(700 + throttle * 900, t, 0.1);
    this.wingGain.gain.setTargetAtTime(0.018 + throttle * 0.05, t, 0.1);
  }

  feeding(on: boolean): void {
    this.feedGain?.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx!.currentTime, 0.1);
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  sip(): void {
    this.blip(880, 0.12, "sine", 0.08);
  }

  chime(): void {
    this.blip(660, 0.4, "sine", 0.1);
    setTimeout(() => this.blip(990, 0.5, "sine", 0.09), 130);
  }

  swat(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.35);
  }

  resume(): void {
    void this.ctx?.resume();
  }
}
