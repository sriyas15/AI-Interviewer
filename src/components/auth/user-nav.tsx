"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";

interface UserNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export function UserNav({ user }: UserNavProps) {
  if (!user) {
    return (
      <div className="nav-actions">
        <Link href="/login" className="btn btn-ghost">
          Sign In
        </Link>
        <Link href="/register" className="btn btn-primary">
          Get Started
        </Link>
      </div>
    );
  }

  return (
    <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <Link href="/dashboard" className="btn btn-secondary btn-sm">
        <LayoutDashboard size={16} />
        <span>Dashboard</span>
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="btn btn-ghost btn-sm"
        title="Sign Out"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>
    </div>
  );
}
