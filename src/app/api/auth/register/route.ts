import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Validate request body against schema
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      const errorMap = validation.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(errorMap).flat()[0] || "Invalid input data";

      return NextResponse.json(
        { success: false, error: firstErrorMessage, details: errorMap },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true },
    });

    if (existingUser) {
      if (!existingUser.passwordHash) {
        return NextResponse.json(
          {
            success: false,
            error:
              "An account with this email was created using Google. Please sign in with Google.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    // 3. Hash password with bcrypt (salt rounds: 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Create new user with default CANDIDATE role
    const newUser = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: Role.CANDIDATE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER_API_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}

