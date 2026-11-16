import type { LiveEvent, LiveUser } from "@/lib/live/types";
import { pick, rand } from "./util";

const NAMES = [
  "taveesak", "supalak", "Nyein", "max", "Nudnad", "Thodsathep", "สมตัวดิง", "Lalamunii", "CeeCee",
  "Ampy", "chuchutik", "baipor", "Clarita", "numai361", "aiw.khani", "ภูคะวัน", "Noina2532", "Cream",
  "หมีขาว", "namview", "กฤษณพล", "ซัดเจน", "ป้าแอ๋ว", "บ่าวอีสาน", "น้องฟ้า", "MooKaTa", "Tonkla",
];
const CHATS = [
  "สวัสดีค่า", "มาแล้วจ้า", "1", "2", "3", "4", "ไหนวะ", "งานวัดสนุกมาก", "ขึ้นชิงช้าหน่อย", "ขอเพลงหน่อย",
  "555555", "รถบั๊มมา!", "เต้นๆ", "ม้าหมุนน่ารัก", "สู้ๆ นะคะ", "หิวไก่ย่าง",
];
const GIFTS = [
  { name: "Rose", coins: 1 },
  { name: "กุหลาบ", coins: 1 },
  { name: "Finger Heart", coins: 5 },
  { name: "Doughnut", coins: 30 },
  { name: "Hat", coins: 99 },
  { name: "Galaxy", coins: 1000 },
];

export function startDemo(emit: (e: LiveEvent) => void): () => void {
  const users: LiveUser[] = [];
  let n = 0;
  const newUser = (): LiveUser => {
    const u = { id: `demo_${n}`, name: NAMES[n % NAMES.length] + (n >= NAMES.length ? n : "") };
    n++;
    users.push(u);
    return u;
  };

  emit({ type: "status", state: "connected", message: "โหมดทดลอง (Demo)" });
  for (let i = 0; i < 8; i++) emit({ type: "join", user: newUser() });

  let likes = 0;
  const timer = setInterval(() => {
    const r = Math.random();
    if (r < 0.15 && users.length < 60) emit({ type: "join", user: newUser() });
    else if (r < 0.45 && users.length) emit({ type: "chat", user: pick(users), text: pick(CHATS) });
    else if (r < 0.75 && users.length) {
      const c = Math.ceil(rand(1, 15));
      likes += c;
      emit({ type: "like", user: pick(users), count: c, total: likes });
    } else if (r < 0.85 && users.length) {
      const g = Math.random() < 0.9 ? pick(GIFTS.slice(0, 4)) : pick(GIFTS);
      const count = Math.random() < 0.3 ? Math.ceil(rand(2, 10)) : 1;
      emit({ type: "gift", user: pick(users), giftName: g.name, count, coins: g.coins * count });
    } else if (r < 0.9 && users.length) emit({ type: "follow", user: pick(users) });
    else if (r < 0.93 && users.length) emit({ type: "share", user: pick(users) });
    else emit({ type: "viewers", count: users.length + Math.floor(rand(10, 40)) });
  }, 700);

  return () => clearInterval(timer);
}
