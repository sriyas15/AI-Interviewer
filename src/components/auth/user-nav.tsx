"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { ProfileDropdown } from "@/components/auth/profile-dropdown";

interface UserNavProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
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
    <div
      className="nav-actions"
      style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
    >
      <Link href="/dashboard" className="btn btn-secondary btn-sm">
        <LayoutDashboard size={15} />
        <span>Dashboard</span>
      </Link>

      <ProfileDropdown user={user} />
    </div>
  );
}
