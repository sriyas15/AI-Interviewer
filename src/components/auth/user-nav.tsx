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
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name || "User"}
            style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <UserIcon size={16} />
        )}
        <span>{user.name?.split(" ")[0] || "Candidate"}</span>
      </div>
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

