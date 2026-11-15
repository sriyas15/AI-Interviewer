"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  LayoutDashboard,
  User as UserIcon,
} from "lucide-react";

interface ProfileDropdownProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: "CANDIDATE" | "ADMIN" | string;
  };
  showDashboardLink?: boolean;
}

export function ProfileDropdown({
  user,
  showDashboardLink = false,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user.name || "Candidate";
  const firstName = displayName.split(" ")[0];
  const email = user.email || "";
  const isAdmin = user.role === "ADMIN";

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      {/* Clickable Profile Trigger Button */}
      <button
        type="button"
        className={`profile-trigger-btn ${
          isOpen ? "profile-trigger-btn--active" : ""
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile and settings menu"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={displayName}
            className="nav-avatar"
            style={{ width: "26px", height: "26px" }}
          />
        ) : (
          <div
            className="nav-avatar-placeholder"
            style={{ width: "26px", height: "26px", fontSize: "0.75rem" }}
          >
            {firstName[0]?.toUpperCase() || <UserIcon size={14} />}
          </div>
        )}

        <span className="nav-user-name" style={{ fontSize: "0.8125rem" }}>
          {firstName}
        </span>

        <ChevronDown
          size={14}
          style={{
            color: "var(--text-tertiary)",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform var(--transition-fast)",
          }}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="profile-menu" role="menu">
          {/* Header */}
          <div className="profile-menu-header">
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginTop: "1px",
              }}
            >
              {email}
            </div>
            <div style={{ marginTop: "0.4rem" }}>
              <span
                className={`badge text-[9px] ${
                  isAdmin ? "badge-warning" : "badge-primary"
                }`}
              >
                {isAdmin ? "Admin Account" : "Candidate Account"}
              </span>
            </div>
          </div>

          {/* Links */}
          {showDashboardLink && (
            <Link
              href="/dashboard"
              className="profile-menu-item"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard size={15} />
              <span>Dashboard</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              className="profile-menu-item"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <Shield size={15} className="text-[var(--color-warning)]" />
              <span>Admin Portal</span>
            </Link>
          )}

          <Link
            href="/settings"
            className="profile-menu-item"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            <Settings size={15} />
            <span>Settings</span>
          </Link>

          <div className="profile-menu-divider" />

          {/* Sign Out Action */}
          <button
            type="button"
            className="profile-menu-item profile-menu-item--danger"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              signOut({ callbackUrl: "/" });
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

