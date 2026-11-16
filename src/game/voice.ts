// เสียงพูดภาษาไทยด้วย Web Speech API (ใช้เสียง TTS ของเครื่อง ไม่ต้องมีไฟล์เสียง)

export const GUIDE_LINES = [
  "ยินดีต้อนรับสู่งานวัด พิกเซลไลฟ์ แค่เข้ามาดูไลฟ์ ตัวละครของคุณก็จะเดินเข้างานทันที",
  "พิมพ์เลข 1 ไปเล่นชิงช้าสวรรค์ พิมพ์ 2 ขี่ม้าหมุน พิมพ์ 3 ขับรถบั๊ม พิมพ์ 4 ออกไปเต้น",
  "อยากให้ตัวละครเลเวลอัป กดหัวใจรัวๆ ได้เลย ยิ่งกดไลก์เยอะ เลเวลยิ่งสูง",
  "ส่งของขวัญ ตัวละครจะเรืองแสง แล้วได้ขึ้นเครื่องเล่นทันที ของขวัญตั้งแต่สามสิบเหรียญขึ้นไป จุดพลุทั้งงาน",
  "ใครส่งของขวัญมากที่สุด จะได้เป็นวีไอพีประจำงาน และขึ้นอันดับหนึ่งในตารางจัดอันดับ",
  "อย่าลืมกดติดตาม แล้วแชร์ไลฟ์ชวนเพื่อนๆ มาเที่ยวงานวัดด้วยกันนะ",
];

type Opts = { onSpeaking?: (speaking: boolean) => void };

export class Voice {
  private synth: SpeechSynthesis | null = typeof window !== "undefined" ? window.speechSynthesis ?? null : null;
  private voice: SpeechSynthesisVoice | null = null;
  private queue: string[] = [];
  private busy = false;
  private guideTimer: ReturnType<typeof setInterval> | null = null;
  private guideIdx = 0;
  private lastThanks = 0;
  enabled = false;

  constructor(private opts: Opts = {}) {
    if (!this.synth) return;
    const pickVoice = () => {
      const vs = this.synth!.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("th"));
      // เสียงออนไลน์ (Google/Natural) มักฟังเป็นธรรมชาติกว่า
      this.voice = vs.find((v) => /natural|google|premwadee|niwat/i.test(v.name)) ?? vs[0] ?? null;
    };
    pickVoice();
    this.synth.addEventListener?.("voiceschanged", pickVoice);
  }

  get supported() {
    return !!this.synth;
  }

  get voiceName() {
    return this.voice?.name ?? null;
  }

  /** ต้องเรียกจากการกด/แตะของผู้ใช้ (เบราว์เซอร์บล็อกเสียงพูดอัตโนมัติ) */
  enable(guideEverySec = 75) {
    if (!this.synth || this.enabled) return;
    this.enabled = true;
    this.say(GUIDE_LINES[0]);
    this.guideIdx = 1;
    if (guideEverySec > 0) {
      this.guideTimer = setInterval(() => {
        if (this.queue.length) return; // กำลังมีคิวพูดอยู่ ข้ามรอบนี้
        this.say(GUIDE_LINES[this.guideIdx]);
        this.guideIdx = (this.guideIdx + 1) % GUIDE_LINES.length;
      }, guideEverySec * 1000);
    }
  }

  disable() {
    this.enabled = false;
    if (this.guideTimer) clearInterval(this.guideTimer);
    this.guideTimer = null;
    this.queue = [];
    this.synth?.cancel();
    this.busy = false;
    this.opts.onSpeaking?.(false);
  }

  thankGift(name: string, gift: string, count: number) {
    if (!this.enabled) return;
    const now = Date.now();
    // ของขวัญรัวๆ: ขอบคุณไม่เกินทุก 4 วิ และไม่ให้คิวยาวเกินไป
    if (now - this.lastThanks < 4000 || this.queue.length >= 2) return;
    this.lastThanks = now;
    this.say(`ขอบคุณ ${cleanName(name)} ที่ส่ง ${gift}${count > 1 ? ` ${count} ชิ้น` : ""} มาให้นะ`, true);
  }

  thankFollow(name: string) {
    if (!this.enabled || this.queue.length >= 1) return;
    this.say(`ขอบคุณ ${cleanName(name)} ที่กดติดตามนะ`);
  }

  say(text: string, urgent = false) {
    if (!this.synth || !this.enabled) return;
    if (urgent) this.queue.unshift(text);
    else this.queue.push(text);
    this.next();
  }

  private next() {
    if (this.busy || !this.synth) return;
    const text = this.queue.shift();
    if (!text) {
      this.opts.onSpeaking?.(false);
      return;
    }
    this.busy = true;
    this.opts.onSpeaking?.(true);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    const done = () => {
      this.busy = false;
      this.next();
    };
    u.onend = done;
    u.onerror = done;
    this.synth.speak(u);
  }

  dispose() {
    this.disable();
  }
}

/** ตัดอีโมจิ/สัญลักษณ์ออกจากชื่อให้อ่านออกเสียงได้ */
function cleanName(name: string) {
  const s = name.replace(/[^\p{L}\p{M}\p{N}\s._-]/gu, "").trim();
  return s.slice(0, 24) || "เพื่อนคนนี้";
}
