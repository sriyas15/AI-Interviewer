"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema, RegisterInput } from "@/lib/validations";

export interface ActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
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
          error: "An account with this email was created using Google Sign-In. Please sign in with Google.",
        };
      }
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }

    // Hash the password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create candidate user
    await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "CANDIDATE",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to register user:", error);
    return {
      success: false,
      error: "Something went wrong during registration. Please try again.",
    };
  }
}

