/**
 * Email dispatch service for AI Interviewer.
 * Handles Email Verification and Password Reset flows.
 *
 * Supports Resend API (via process.env.RESEND_API_KEY) and falls back
 * gracefully to formatted console logging for local development.
 */

const APP_URL =
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

const FROM_EMAIL =
  process.env.EMAIL_FROM || "AI Interviewer <no-reply@ai-interviewer.com>";

export interface SendEmailResult {
  success: boolean;
  error?: string;
  previewUrl?: string;
}

export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string | null;
  token: string;
}): Promise<SendEmailResult> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const recipientName = name || "Candidate";

  console.log("\n============================================================");
  console.log(`✉️  [EMAIL DISPATCH] Verification Email`);
  console.log(`To: ${recipientName} <${email}>`);
  console.log(`Subject: Verify your AI Interviewer account`);
  console.log(`Verification URL: ${verifyUrl}`);
  console.log("============================================================\n");

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: "Verify your AI Interviewer account",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #0a0a0f; color: #f0f0f5; border-radius: 12px;">
              <h2 style="color: #6c5ce7;">Welcome to AI Interviewer, ${recipientName}!</h2>
              <p style="color: #a0a0b8; font-size: 15px;">Please confirm your email address to activate your account and start technical interview simulations.</p>
              <div style="margin: 28px 0;">
                <a href="${verifyUrl}" style="background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="color: #6b6b80; font-size: 13px;">This verification link will expire in 24 hours. If you did not create an account, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend API error:", errText);
      }
    } catch (err) {
      console.error("Failed to send verification email via Resend:", err);
    }
  }

  return { success: true, previewUrl: verifyUrl };
}

export async function sendPasswordResetEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string | null;
  token: string;
}): Promise<SendEmailResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const recipientName = name || "User";

  console.log("\n============================================================");
  console.log(`🔒 [EMAIL DISPATCH] Password Reset`);
  console.log(`To: ${recipientName} <${email}>`);
  console.log(`Subject: Reset your AI Interviewer password`);
  console.log(`Reset URL: ${resetUrl}`);
  console.log("============================================================\n");

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: "Reset your AI Interviewer password",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #0a0a0f; color: #f0f0f5; border-radius: 12px;">
              <h2 style="color: #6c5ce7;">Password Reset Request</h2>
              <p style="color: #a0a0b8; font-size: 15px;">Hello ${recipientName}, we received a request to reset your password. Click the button below to choose a new password.</p>
              <div style="margin: 28px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #6b6b80; font-size: 13px;">This reset link expires in 1 hour. If you did not request a password reset, no further action is needed.</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend API error:", errText);
      }
    } catch (err) {
      console.error("Failed to send password reset email via Resend:", err);
    }
  }

  return { success: true, previewUrl: resetUrl };
}
