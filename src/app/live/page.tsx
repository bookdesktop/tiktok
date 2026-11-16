import { Suspense } from "react";
import LiveGame from "./LiveGame";

export const metadata = { title: "งานวัด Pixel Live — Overlay" };

export default function LivePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <LiveGame />
    </Suspense>
  );
}
