"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ className = "btn btn-secondary btn-sm" }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className}
    >
      <LogOut size={14} />
      <span>Sign Out</span>
    </button>
  );
}

