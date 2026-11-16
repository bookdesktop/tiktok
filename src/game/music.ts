// เพลงประกอบแบบ chiptune สร้างสดด้วย Web Audio (แต่งขึ้นเอง ไม่มีไฟล์เสียง ไม่ติดลิขสิทธิ์)

// แต่ละเพลง: 8 ห้อง × 8 ตัวโน้ตเขบ็ตหนึ่งชั้น (เลข MIDI, 0 = พัก)
// kick/snare/hat = ตำแหน่งในห้อง (0–7) · bass = ระยะจากโน้ตต้นคอร์ดในแต่ละตำแหน่ง (null = เงียบ)
type Song = {
  name: string;
  bpm: number;
  lead: OscillatorType;
  melody: number[];
  roots: number[];
  minor: number[];
  kick: number[];
  snare: number[];
  hat: number[];
  bass: (number | null)[];
};

const SONGS: Song[] = [
  {
    name: "งานวัดมันส์",
    bpm: 142,
    lead: "square",
    melody: [
      76, 0, 79, 0, 76, 74, 72, 0,
      72, 0, 76, 0, 74, 72, 69, 0,
      69, 72, 77, 0, 76, 74, 72, 74,
      74, 0, 71, 0, 67, 0, 0, 0,
      76, 0, 79, 0, 81, 79, 76, 0,
      76, 77, 76, 74, 72, 0, 69, 0,
      77, 0, 76, 0, 74, 0, 72, 0,
      74, 71, 67, 71, 72, 0, 0, 0,
    ],
    roots: [48, 45, 41, 43, 48, 45, 41, 43],
    minor: [45],
    kick: [0, 3, 4],
    snare: [2, 6],
    hat: [1, 3, 5, 7],
    bass: [0, 12, 7, 12, 0, 12, 7, 12],
  },
  {
    name: "แดนซ์ปาร์ตี้",
    bpm: 150,
    lead: "sawtooth",
    melody: [
      76, 0, 76, 79, 0, 76, 74, 72,
      72, 0, 72, 74, 0, 72, 69, 0,
      72, 0, 72, 76, 0, 79, 76, 72,
      74, 0, 74, 71, 74, 76, 74, 0,
      81, 0, 79, 76, 0, 79, 76, 74,
      77, 76, 74, 72, 0, 74, 72, 69,
      72, 74, 76, 79, 0, 84, 79, 76,
      79, 0, 77, 0, 76, 0, 74, 0,
    ],
    roots: [45, 41, 48, 43, 45, 41, 48, 43],
    minor: [45],
    kick: [0, 2, 4, 6],
    snare: [2, 6],
    hat: [1, 3, 5, 7],
    bass: [null, 12, null, 12, null, 12, null, 12],
  },
  {
    name: "ลูกทุ่งแดนซ์",
    bpm: 146,
    lead: "square",
    melody: [
      72, 74, 76, 79, 76, 74, 72, 0,
      79, 81, 79, 76, 74, 0, 72, 0,
      69, 72, 74, 72, 69, 0, 67, 0,
      67, 69, 72, 74, 76, 74, 72, 74,
      76, 79, 81, 84, 81, 79, 76, 0,
      76, 74, 72, 74, 76, 0, 69, 0,
      67, 0, 74, 0, 72, 74, 72, 67,
      72, 0, 0, 79, 72, 0, 0, 0,
    ],
    roots: [48, 48, 41, 43, 48, 45, 43, 48],
    minor: [45],
    kick: [0, 3, 4, 7],
    snare: [2, 6],
    hat: [0, 1, 2, 3, 4, 5, 6, 7],
    bass: [0, null, 7, 0, 12, null, 7, 5],
  },
];
const LOOPS_PER_SONG = 2; // เล่นแต่ละเพลง 2 รอบแล้วเปลี่ยนเพลง
const VOLUME = 0.2;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private loop = 0;
  private songIdx = 0;
  private nextTime = 0;
  playing = false;

  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    this.master = master;
    this.noise = buf;
    return ctx;
  }

  /** ต้องเรียกจากการกด/แตะของผู้ใช้ เพราะเบราว์เซอร์บล็อกเสียงอัตโนมัติ */
  async start() {
    const ctx = this.ensure();
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    if (this.ctx !== ctx) return false; // ถูก dispose ระหว่างรอ
    if (this.playing) return ctx.state === "running";
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
    return ctx.state === "running";
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** ลดเสียงเพลงลงตอนมีเสียงพูด */
  duck(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 0.05 : VOLUME, ctx.currentTime, 0.15);
  }

  dispose() {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  /** เสียงกริ๊งตอนมีคนส่งของขวัญ */
  chime() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    [84, 88, 91, 96].forEach((n, i) => this.tone("square", midi(n), t + i * 0.07, 0.12, 0.22));
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return this.stop();
    while (this.nextTime < ctx.currentTime + 0.12) {
      const song = SONGS[this.songIdx];
      const eighth = 60 / song.bpm / 2;
      this.playStep(song, this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step++;
      if (this.step >= song.melody.length) {
        this.step = 0;
        if (++this.loop >= LOOPS_PER_SONG) {
          this.loop = 0;
          this.songIdx = (this.songIdx + 1) % SONGS.length;
        }
      }
    }
  }

  private playStep(song: Song, s: number, t: number, eighth: number) {
    const bar = Math.floor(s / 8);
    const pos = s % 8;
    const lastBar = bar === song.roots.length - 1;
    const root = song.roots[bar];

    // ทำนองหลัก + เสียงซ้อนคู่แปดเบาๆ ให้หนาขึ้น
    const m = song.melody[s];
    if (m) {
      this.tone(song.lead, midi(m), t, eighth * 0.85, song.lead === "sawtooth" ? 0.09 : 0.14);
      this.tone("square", midi(m + 12), t, eighth * 0.4, 0.03);
    }

    const b = song.bass[pos];
    if (b !== null) this.tone("triangle", midi(root + b - 12), t, eighth * 0.9, 0.55);

    // arpeggio 16th รัวๆ เบาๆ
    const third = song.minor.includes(root) ? 3 : 4;
    const arp = [0, third, 7, 12, 7, third, 0, 12];
    const half = eighth / 2;
    this.tone("square", midi(root + 12 + arp[pos]), t, half * 0.8, 0.035);
    this.tone("square", midi(root + 24 + arp[(pos + 2) % 8]), t + half, half * 0.8, 0.025);

    // กลอง
    if (song.kick.includes(pos)) this.kick(t);
    if (song.snare.includes(pos)) this.hit(t, 1500, 0.14, 0.3);
    if (song.hat.includes(pos)) this.hit(t, 7500, 0.03, pos % 2 ? 0.14 : 0.08);
    // ห้องสุดท้าย: กลองรัวส่งเข้ารอบใหม่
    if (lastBar && pos >= 4) {
      this.hit(t, 1500, 0.08, 0.2);
      this.hit(t + half, 1500, 0.08, 0.25);
    }
  }

  private tone(type: OscillatorType, freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.16);
  }

  private hit(t: number, cutoff: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
