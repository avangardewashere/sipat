import { Pomodoro } from "@/components/Pomodoro";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <header className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sipat</h1>
        <p className="text-sm text-foreground/60">Aim. Align. Focus.</p>
      </header>
      <Pomodoro />
    </main>
  );
}
