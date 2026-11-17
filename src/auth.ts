import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) {
          return null;
        }

        const { email, password } = validated.data;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!passwordsMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
    Credentials({
      id: "invite-token",
      name: "invite-token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token || typeof credentials.token !== "string") {
          return null;
        }
        const invitation = await db.interviewInvitation.findUnique({
          where: { token: credentials.token },
        });
        if (!invitation) return null;
        if (
          invitation.status === "EXPIRED" ||
          invitation.status === "REVOKED" ||
          new Date() > invitation.expiresAt
        ) {
          return null;
        }

        const normalizedEmail = invitation.candidateEmail.toLowerCase().trim();
        let user = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          user = await db.user.create({
            data: {
              email: normalizedEmail,
              name: invitation.candidateName || "Candidate",
              role: "CANDIDATE",
              emailVerified: new Date(),
              isActive: true,
            },
          });
        }

        if (!user.isActive) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.isActive = (user as any).isActive ?? true;

        // If Google OAuth or if role is missing on user object, look it up in DB
        if ((!token.role || token.isActive === undefined) && user.email) {
          const dbUser = await db.user.findUnique({
            where: { email: user.email.toLowerCase().trim() },
            select: { id: true, role: true, isActive: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.isActive = dbUser.isActive;
          }
        }
      } else if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isActive = dbUser.isActive;
        }
      }
      return token;
    },
  },
});
