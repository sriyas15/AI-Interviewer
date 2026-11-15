"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/lib/validations";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

export interface ActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  requiresVerification?: boolean;
  previewUrl?: string;
}

export async function registerUser(input: RegisterInput): Promise<ActionResult> {
  try {
    const validated = registerSchema.safeParse(input);

    if (!validated.success) {
      return {
        success: false,
        error: "Validation failed. Please check your inputs.",
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    const { name, email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (!existingUser.passwordHash) {
        return {
          success: false,
          error:
            "An account with this email was created using Google Sign-In. Please sign in with Google.",
        };
      }
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }

    // Hash the password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create candidate user (unverified by default for email credentials)
    const newUser = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "CANDIDATE",
      },
    });

    // Generate secure email verification token (24-hour expiry)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Clean up any stale tokens for this email
    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: verificationToken,
        expires,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail({
      email: normalizedEmail,
      name: newUser.name,
      token: verificationToken,
    });

    return {
      success: true,
      requiresVerification: true,
      previewUrl: emailResult.previewUrl,
    };
  } catch (error) {
    console.error("Failed to register user:", error);
    return {
      success: false,
      error: "Something went wrong during registration. Please try again.",
    };
  }
}

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  try {
    if (!token || typeof token !== "string") {
      return { success: false, error: "Invalid verification link." };
    }

    const tokenRecord = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!tokenRecord) {
      return {
        success: false,
        error: "Invalid or expired verification token.",
      };
    }

    // Check expiration
    if (new Date() > tokenRecord.expires) {
      await db.verificationToken.delete({ where: { token } });
      return {
        success: false,
        error: "Verification link has expired. Please request a new one.",
      };
    }

    // Mark user as verified
    await db.user.update({
      where: { email: tokenRecord.identifier },
      data: { emailVerified: new Date() },
    });

    // Delete token once consumed
    await db.verificationToken.delete({ where: { token } });

    return { success: true };
  } catch (error) {
    console.error("Email verification error:", error);
    return {
      success: false,
      error: "Failed to verify email. Please try again.",
    };
  }
}

export async function resendVerificationEmailAction(
  email: string
): Promise<ActionResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Return success to avoid email enumeration
      return { success: true };
    }

    if (user.emailVerified) {
      return {
        success: false,
        error: "This email address is already verified.",
      };
    }

    // Delete old tokens
    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    });

    const emailResult = await sendVerificationEmail({
      email: normalizedEmail,
      name: user.name,
      token,
    });

    return { success: true, previewUrl: emailResult.previewUrl };
  } catch (error) {
    console.error("Resend verification error:", error);
    return {
      success: false,
      error: "Failed to resend verification email. Please try again.",
    };
  }
}

export async function requestPasswordResetAction(
  input: ForgotPasswordInput
): Promise<ActionResult> {
  try {
    const validated = forgotPasswordSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    const normalizedEmail = validated.data.email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user exists and is a credentials account
    if (user && user.passwordHash) {
      const resetIdentifier = `reset:${normalizedEmail}`;

      // Clean old reset tokens
      await db.verificationToken.deleteMany({
        where: { identifier: resetIdentifier },
      });

      // 1-hour expiration
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await db.verificationToken.create({
        data: {
          identifier: resetIdentifier,
          token,
          expires,
        },
      });

      const emailResult = await sendPasswordResetEmail({
        email: normalizedEmail,
        name: user.name,
        token,
      });

      return { success: true, previewUrl: emailResult.previewUrl };
    }

    // Generic success response to avoid email harvesting
    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return {
      success: false,
      error: "Unable to process password reset request right now.",
    };
  }
}

export async function resetPasswordAction(
  input: ResetPasswordInput
): Promise<ActionResult> {
  try {
    const validated = resetPasswordSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: "Validation failed. Please check your inputs.",
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    const { token, password } = validated.data;

    const tokenRecord = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!tokenRecord || !tokenRecord.identifier.startsWith("reset:")) {
      return {
        success: false,
        error: "This password reset link is invalid or has expired.",
      };
    }

    if (new Date() > tokenRecord.expires) {
      await db.verificationToken.delete({ where: { token } });
      return {
        success: false,
        error: "This password reset link has expired. Please request a new one.",
      };
    }

    const email = tokenRecord.identifier.replace("reset:", "");

    const newPasswordHash = await bcrypt.hash(password, 12);

    await db.user.update({
      where: { email },
      data: { passwordHash: newPasswordHash },
    });

    // Delete consumed token
    await db.verificationToken.delete({ where: { token } });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: "Failed to reset password. Please try again.",
    };
  }
}
