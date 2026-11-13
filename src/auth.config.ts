import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const pathname = nextUrl.pathname;

      const isAuthRoute = pathname === "/login" || pathname === "/register";
      const isAdminRoute = pathname.startsWith("/admin");
      const isProtectedRoute =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/interview") ||
        isAdminRoute;

      // Authenticated users should not revisit login/register
      if (isLoggedIn && isAuthRoute) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Unauthenticated users trying to access protected routes
      if (!isLoggedIn && isProtectedRoute) {
        return false;
      }

      // Role check: Only ADMIN role can access /admin routes
      if (isAdminRoute && role !== "ADMIN") {
        return Response.redirect(new URL("/dashboard?error=unauthorized", nextUrl));
      }

      return true;
    },
  },
};

