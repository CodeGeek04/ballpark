import { Suspense } from "react";
import { LandingForm } from "./_components/LandingForm";
import { Logo } from "@/components/Logo";
import { HowToPlayButton } from "@/components/HowToPlay";
import { SuggestQuestionButton } from "@/components/SuggestQuestion";
import { FeedbackBar } from "@/components/FeedbackBar";
import { AbandonedToast } from "@/components/AbandonedToast";

export default function Home() {
  return (
    <main className="min-h-dvh w-full">
      <Suspense fallback={null}>
        <AbandonedToast />
      </Suspense>
      <header className="px-6 sm:px-10 pt-8 pb-2 flex justify-between items-center gap-3">
        <Logo />
        <div className="flex items-center gap-2">
          <SuggestQuestionButton />
          <HowToPlayButton />
        </div>
      </header>

      <section className="px-6 sm:px-10 pt-10 sm:pt-16 pb-20 max-w-5xl mx-auto">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] items-start">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] uppercase text-ember font-bold mb-5">
              Live · 1–8 players · 5 rounds
            </p>
            <h1 className="font-display font-bold text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.03em]">
              Guess the weirdest{" "}
              <span className="relative inline-block">
                <span className="relative z-10">number</span>
                <span className="absolute inset-x-[-4px] bottom-1 h-3 bg-mustard -z-0" aria-hidden />
              </span>
              {" "}of the day.
            </h1>
            <p className="mt-6 text-lg max-w-[58ch] leading-snug">
              You get a strange question with a number for an answer. You have sixty seconds.
              Closest guess wins. Order-of-magnitude misses still score.
            </p>

            <ul className="mt-8 space-y-2 font-mono text-[13px] tracking-tight">
              <li>→ how many liters of saliva does a person produce in a lifetime?</li>
              <li>→ how many lego bricks are made every second?</li>
              <li>→ how many text messages are sent every minute?</li>
            </ul>
          </div>

          <LandingForm />
        </div>
      </section>

      <FeedbackBar />

      <footer className="px-6 sm:px-10 pb-10 text-xs font-mono opacity-60">
        made with too much coffee · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
