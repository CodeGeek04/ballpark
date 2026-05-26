"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

export function AbandonedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("abandoned") !== "1") return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), 6000);
    // clean the query param so refresh doesn't re-trigger
    router.replace("/");
    return () => clearTimeout(t);
  }, [params, router]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]"
        >
          <div className="bg-ink text-paper border-2 border-ink rounded-card shadow-stamp px-4 py-3 flex items-start gap-3">
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-mustard">heads up</p>
              <p className="font-mono text-sm mt-0.5">the host left the room.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="dismiss"
              className="font-mono text-base leading-none w-6 h-6 rounded-full border-2 border-paper text-paper flex items-center justify-center hover:bg-paper hover:text-ink"
            >
              x
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
