import SetupForm from "./SetupForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-amber-300">🎡 งานวัด Pixel Live</h1>
        <p className="mt-2 text-white/75">
          เกม Overlay สำหรับ TikTok Live — ผู้ชมที่เข้ามาในไลฟ์จะกลายเป็นตัวละครเดินในงานวัด พร้อมรูปโปรไฟล์
          ขึ้นชิงช้าสวรรค์ ม้าหมุน รถบั๊ม และจุดพลุเมื่อส่งของขวัญ
        </p>
      </div>
      <SetupForm />
      <section className="rounded-xl bg-white/5 p-4 text-sm leading-relaxed text-white/80">
        <h2 className="mb-2 text-base font-semibold text-white">คำสั่งในแชท</h2>
        <ul className="list-inside list-disc">
          <li>
            <b>1</b> หรือ “ชิงช้า” — ขึ้นชิงช้าสวรรค์
          </li>
          <li>
            <b>2</b> หรือ “ม้า” — ขี่ม้าหมุน
          </li>
          <li>
            <b>3</b> หรือ “รถ” / “บั๊ม” — ขับรถบั๊ม
          </li>
          <li>
            <b>4</b> หรือ “เต้น” — ไปเต้นหน้าเวที
          </li>
          <li>กดหัวใจ = หัวใจลอย + เลเวลขึ้น · ส่งของขวัญ = ได้เล่นเครื่องเล่นทันที + พลุ (30 เหรียญขึ้นไป)</li>
          <li>ผู้ส่งของขวัญมากที่สุดได้มงกุฎ VIP</li>
        </ul>
        <h2 className="mb-2 mt-4 text-base font-semibold text-white">ใช้กับ TikTok LIVE Studio / OBS</h2>
        <p>
          เพิ่ม Source แบบ <b>Link / Browser</b> ใส่ลิงก์ที่ได้ ขนาด <b>1080×1920</b> (แนวตั้ง)
        </p>
      </section>
    </main>
  );
}
