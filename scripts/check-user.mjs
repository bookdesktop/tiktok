// ใช้: node --env-file=.env.local scripts/check-user.mjs <username> [roomId]
// ถ้าใส่ roomId จะลองเชื่อมต่อจริงและแสดงเหตุการณ์ 20 วินาที
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";

const u = process.argv[2] || "tiktok";
const roomId = process.argv[3];
console.log("EULER_API_KEY:", process.env.EULER_API_KEY ? "ใส่แล้ว" : "ยังไม่ได้ใส่");

const c = new TikTokLiveConnection(u, {
  signApiKey: process.env.EULER_API_KEY || undefined,
  fetchRoomInfoOnConnect: !roomId,
});
c.on("error", () => {});

function printErr(e) {
  console.log("ERROR:", e?.message);
  for (const [i, x] of (e?.config?.requestErrs || []).entries())
    console.log(`  [${i}]`, x?.constructor?.name, "-", String(x?.message).slice(0, 300));
}

try {
  if (roomId) {
    await c.connect(roomId);
    console.log("✅ เชื่อมต่อสำเร็จ! roomId =", c.roomId, "— รอฟังเหตุการณ์ 20 วิ...");
    c.on(WebcastEvent.CHAT, (d) => console.log("💬", d.user?.uniqueId, ":", d.comment));
    c.on(WebcastEvent.MEMBER, (d) => console.log("👋", d.user?.uniqueId, "เข้าร่วม"));
    c.on(WebcastEvent.LIKE, (d) => console.log("❤", d.user?.uniqueId, "x", d.likeCount));
    c.on(WebcastEvent.GIFT, (d) => console.log("🎁", d.user?.uniqueId, d.giftDetails?.giftName));
    await new Promise((r) => setTimeout(r, 20000));
    await c.disconnect().catch(() => {});
  } else {
    const id = await c.fetchRoomId();
    console.log("ROOM ID:", id);
    console.log("isLive:", await c.fetchIsLive());
  }
} catch (e) {
  printErr(e);
}
process.exit(0);
