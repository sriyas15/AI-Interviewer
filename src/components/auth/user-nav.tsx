"use client";

import Link from "next/link";
import { LayoutDashboard, Shield } from "lucide-react";
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

  const isAdmin = user.role === "ADMIN";

  return (
    <div
      className="nav-actions"
      style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
    >
      <Link
        href={isAdmin ? "/admin" : "/dashboard"}
        className="btn btn-secondary btn-sm"
      >
        {isAdmin ? (
          <Shield size={15} className="text-amber-400" />
        ) : (
          <LayoutDashboard size={15} />
        )}
        <span>{isAdmin ? "Admin Portal" : "Dashboard"}</span>
      </Link>

      <ProfileDropdown user={user} showDashboardLink={true} />
    </div>
  );
}
