import nodemailer from "nodemailer";
import { logger } from "./logger";

/**
 * Universal Email dispatch service for AI Interviewer.
 * Powered by Nodemailer with SMTP support (e.g. Gmail, Brevo, SendGrid, Amazon SES)
 * and graceful fallback to formatted console/logger output for local development.
 */

const APP_URL =
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

const FROM_EMAIL =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  '"AI Interviewer" <no-reply@ai-interviewer.com>';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  previewUrl?: string;
}

export interface RecruiterNotificationParams {
  interviewId: string;
  candidateName: string;
  candidateEmail: string;
  jobRole: string;
  overallScore: number;
  recruiterEmail: string;
}

export interface CandidateNotificationParams {
  candidateName: string;
  candidateEmail: string;
  jobRole: string;
}

export interface SendInviteEmailInput {
  candidateEmail: string;
  candidateName?: string | null;
  inviteLink: string;
  jobRole: string;
  difficulty: string;
  templateTitle?: string | null;
  expiresInDays?: number;
  inviterName?: string | null;
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

async function dispatchEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const transporter = getSmtpTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ""),
      });

      logger.info({ event: "email_sent", recipient: to, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error({ event: "email_error", recipient: to, error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Graceful fallback for local development or when credentials are not yet entered
  logger.info({
    event: "email_dispatched_locally",
    recipient: to,
    subject,
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// 1. VERIFY EMAIL
// ─────────────────────────────────────────────────────────────

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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your account</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0a0f; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #14141f; border: 1px solid #2a2a3d; border-radius: 16px; overflow: hidden; padding: 36px 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 8px 12px; background: rgba(108, 92, 231, 0.15); border-radius: 8px; color: #6c5ce7; font-weight: 700; font-size: 14px; margin-bottom: 20px;">
                      ✦ AI Interviewer
                    </div>
                    <h1 style="color: #f0f0f5; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;">Welcome, ${recipientName}!</h1>
                    <p style="color: #a0a0b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                      Thank you for creating an account on the AI Interviewer platform. Please verify your email address to confirm your registration and begin interactive technical interview simulations.
                    </p>
                    <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                      <tr>
                        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%);">
                          <a href="${verifyUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 28px; display: inline-block; border-radius: 8px;">
                            Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b6b80; font-size: 12px; line-height: 1.5; margin: 0;">
                      Or copy and paste this verification URL into your browser:<br>
                      <a href="${verifyUrl}" style="color: #6c5ce7; word-break: break-all;">${verifyUrl}</a>
                    </p>
                    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #2a2a3d; color: #6b6b80; font-size: 11px;">
                      This verification link will expire in 24 hours. If you did not create an account, you can safely ignore this email.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return dispatchEmail({
    to: email,
    subject: "Verify your AI Interviewer account",
    html,
    text: `Welcome to AI Interviewer, ${recipientName}! Please verify your email address by opening: ${verifyUrl}`,
  });
}

// ─────────────────────────────────────────────────────────────
// 2. FORGOT / RESET PASSWORD
// ─────────────────────────────────────────────────────────────

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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0a0f; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #14141f; border: 1px solid #2a2a3d; border-radius: 16px; overflow: hidden; padding: 36px 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 8px 12px; background: rgba(255, 170, 0, 0.15); border-radius: 8px; color: #ffaa00; font-weight: 700; font-size: 14px; margin-bottom: 20px;">
                      🔒 Password Security
                    </div>
                    <h1 style="color: #f0f0f5; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;">Reset Your Password</h1>
                    <p style="color: #a0a0b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                      Hello ${recipientName}, we received a request to reset the password for your AI Interviewer account. Click the button below to choose a secure new password.
                    </p>
                    <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                      <tr>
                        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%);">
                          <a href="${resetUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 28px; display: inline-block; border-radius: 8px;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b6b80; font-size: 12px; line-height: 1.5; margin: 0;">
                      Or copy and paste this password reset URL into your browser:<br>
                      <a href="${resetUrl}" style="color: #6c5ce7; word-break: break-all;">${resetUrl}</a>
                    </p>
                    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #2a2a3d; color: #6b6b80; font-size: 11px;">
                      This link will expire in 1 hour for your security. If you did not request a password reset, you can safely disregard this message.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return dispatchEmail({
    to: email,
    subject: "Reset your AI Interviewer password",
    html,
    text: `Hello ${recipientName}, reset your password here: ${resetUrl}. This link expires in 1 hour.`,
  });
}

// ─────────────────────────────────────────────────────────────
// 3. SEND INTERVIEW INVITATION
// ─────────────────────────────────────────────────────────────

export async function sendInterviewInviteEmail({
  candidateEmail,
  candidateName,
  inviteLink,
  jobRole,
  difficulty,
  templateTitle,
  expiresInDays = 7,
  inviterName = "Recruiting Team",
}: SendInviteEmailInput): Promise<SendEmailResult> {
  const recipientName = candidateName || "Candidate";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interview Assessment Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0a0f; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #14141f; border: 1px solid #2a2a3d; border-radius: 16px; overflow: hidden; padding: 36px 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 8px 12px; background: rgba(0, 214, 143, 0.15); border-radius: 8px; color: #00d68f; font-weight: 700; font-size: 14px; margin-bottom: 20px;">
                      ✦ Assessment Invitation
                    </div>
                    <h1 style="color: #f0f0f5; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;">Technical Assessment: ${jobRole}</h1>
                    <p style="color: #a0a0b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${recipientName}, you have been invited by <strong>${inviterName}</strong> to complete an interactive technical assessment on the AI Interviewer platform.
                    </p>

                    <!-- Assessment Details Box -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1a2e; border: 1px solid #2a2a3d; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
                      <tr>
                        <td>
                          <div style="font-size: 13px; color: #f0f0f5; margin-bottom: 8px;">
                            🎯 <strong>Target Role:</strong> ${jobRole}
                          </div>
                          <div style="font-size: 13px; color: #f0f0f5; margin-bottom: 8px;">
                            ⚡ <strong>Difficulty:</strong> ${difficulty}
                          </div>
                          ${
                            templateTitle
                              ? `<div style="font-size: 13px; color: #f0f0f5; margin-bottom: 8px;">
                                  📋 <strong>Curriculum:</strong> ${templateTitle}
                                </div>`
                              : ""
                          }
                          <div style="font-size: 13px; color: #f0f0f5;">
                            ⏱️ <strong>Valid for:</strong> ${expiresInDays} days
                          </div>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #a0a0b8; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0;">
                      When you are ready in a quiet room with working audio and camera, click the button below to launch your session directly without having to create an interview from scratch.
                    </p>

                    <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                      <tr>
                        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%);">
                          <a href="${inviteLink}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 28px; display: inline-block; border-radius: 8px;">
                            Begin Technical Assessment
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6b6b80; font-size: 12px; line-height: 1.5; margin: 0;">
                      Direct Invitation Link:<br>
                      <a href="${inviteLink}" style="color: #6c5ce7; word-break: break-all;">${inviteLink}</a>
                    </p>

                    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #2a2a3d; color: #6b6b80; font-size: 11px;">
                      This is an exclusive, single-use link generated for <strong>${candidateEmail}</strong>. Please do not share it.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return dispatchEmail({
    to: candidateEmail,
    subject: `Technical Assessment Invitation: ${jobRole}`,
    html,
    text: `Hello ${recipientName}, you have been invited to complete a technical assessment for ${jobRole}. Access your session here: ${inviteLink}`,
  });
}

// ─────────────────────────────────────────────────────────────
// 4. CANDIDATE & RECRUITER COMPLETION NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Sends candidate a thank you confirmation email upon interview completion.
 */
export async function sendCandidateCompletionEmail(params: CandidateNotificationParams) {
  const subject = `Assessment Completed: ${params.jobRole}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1e293b; border-radius: 8px;">
      <h2 style="color: #6366f1;">Thank you, ${params.candidateName}!</h2>
      <p>Your technical interview assessment for the <strong>${params.jobRole}</strong> position has been successfully submitted and compiled.</p>
      <p>The recruitment team has been notified and will review your evaluation results. You will hear back regarding next steps soon.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #64748b; font-size: 12px;">This is an automated notification from AI Interviewer.</p>
    </div>
  `;

  return dispatchEmail({
    to: params.candidateEmail,
    subject,
    html,
    text: `Thank you, ${params.candidateName}! Your technical assessment for ${params.jobRole} has been submitted.`,
  });
}

/**
 * Sends the recruiter an evaluation completion email with score summary and link.
 */
export async function sendRecruiterCompletionEmail(params: RecruiterNotificationParams) {
  const reportLink = `${APP_URL}/admin/interviews/${params.interviewId}`;
  const subject = `Candidate Assessment Ready: ${params.candidateName} (${params.jobRole}) - Score: ${params.overallScore}/100`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1e293b; border-radius: 8px;">
      <h2 style="color: #0f172a;">Candidate Assessment Completed</h2>
      <p>Candidate <strong>${params.candidateName}</strong> (${params.candidateEmail}) has finished the interview for <strong>${params.jobRole}</strong>.</p>
      
      <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e293b;">
          Overall AI Score: <span style="color: #6366f1;">${params.overallScore}/100</span>
        </p>
      </div>

      <p>You can review the full evaluation, question-by-question deep dive, code submissions, and proctoring telemetry here:</p>
      <p style="margin: 25px 0;">
        <a href="${reportLink}" style="background: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Review Candidate Report
        </a>
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #64748b; font-size: 12px;">AI Interviewer Recruitment Operations</p>
    </div>
  `;

  return dispatchEmail({
    to: params.recruiterEmail,
    subject,
    html,
    text: `Candidate Assessment Completed: ${params.candidateName} for ${params.jobRole}. Overall AI Score: ${params.overallScore}/100. Review at ${reportLink}`,
  });
}
