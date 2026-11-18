"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ReportStatusRefresher() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-primary)] mt-4">
      <Loader2 className="animate-spin" size={14} />
      <span>Checking for completed evaluation...</span>
    </div>
  );
}
