import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;
  const role = user?.role;
  const { pathname, searchParams } = req.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email");
  const isAdminRoute = pathname.startsWith("/admin");
  const isCandidateDashboard = pathname === "/dashboard";
  const isProtectedRoute =
    isAdminRoute ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/interview") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings");

  // Deactivated user check (Item 8)
  if (isLoggedIn && (user as any)?.isActive === false) {
    return NextResponse.redirect(new URL("/login?error=AccountDeactivated", req.nextUrl));
  }

  // Redirect authenticated users away from /login, /register, etc.
  if (isAuthRoute && isLoggedIn) {
    const destination = role === "ADMIN" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(destination, req.nextUrl));
  }

  // Redirect unauthenticated users to /login when visiting protected pages
  if (isProtectedRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.nextUrl)
    );
  }

  // Candidate role gate: candidates cannot access /interview/new directly (Item 9)
  if (pathname.startsWith("/interview/new") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Enforce role-based access: CANDIDATE cannot access /admin
  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // If ADMIN visits /dashboard directly without explicitly requesting ?view=candidate, send them to /admin
  if (isCandidateDashboard && role === "ADMIN" && searchParams.get("view") !== "candidate") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
