import nodemailer from "nodemailer";
import { logger } from "./logger";

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

function getMailTransporter() {
  const host = process.env.SMTP_HOST || "localhost";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Sends candidate a thank you confirmation email upon interview completion.
 */
export async function sendCandidateCompletionEmail(params: CandidateNotificationParams) {
  const transporter = getMailTransporter();
  const from = process.env.SMTP_FROM || '"AI Interviewer Platform" <noreply@ai-interviewer.com>';

  const subject = `Assessment Completed: ${params.jobRole}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6366f1;">Thank you, ${params.candidateName}!</h2>
      <p>Your technical interview assessment for the <strong>${params.jobRole}</strong> position has been successfully submitted and compiled.</p>
      <p>The recruitment team has been notified and will review your evaluation results. You will hear back regarding next steps soon.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #64748b; font-size: 12px;">This is an automated notification from AI Interviewer.</p>
    </div>
  `;

  if (!transporter) {
    logger.info({ event: "email_skipped_no_smtp", recipient: params.candidateEmail, subject });
    return;
  }

  await transporter.sendMail({
    from,
    to: params.candidateEmail,
    subject,
    html,
  });
}

/**
 * Sends the recruiter an evaluation completion email with score summary and link.
 */
export async function sendRecruiterCompletionEmail(params: RecruiterNotificationParams) {
  const transporter = getMailTransporter();
  const from = process.env.SMTP_FROM || '"AI Interviewer Platform" <noreply@ai-interviewer.com>';
  const appUrl = process.env.AUTH_URL || "http://localhost:3000";
  const reportLink = `${appUrl}/admin/interviews/${params.interviewId}`;

  const subject = `Candidate Assessment Ready: ${params.candidateName} (${params.jobRole}) - Score: ${params.overallScore}/100`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">Candidate Assessment Completed</h2>
      <p>Candidate <strong>${params.candidateName}</strong> (${params.candidateEmail}) has finished the interview for <strong>${params.jobRole}</strong>.</p>
      
      <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e293b;">
          Overall AI Score: <span style="color: #6366f1;">${params.overallScore}/100</span>
        </p>
      </div>

      <p>You can review the full evaluation, question-by-question deep dive, code submissions, and proctoring telemetry here:</p>
      <p style="margin: 25px 0;">
        <a href="${reportLink}" style="background: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review Candidate Report
        </a>
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #64748b; font-size: 12px;">AI Interviewer Recruitment Operations</p>
    </div>
  `;

  if (!transporter) {
    logger.info({ event: "email_skipped_no_smtp", recipient: params.recruiterEmail, subject });
    return;
  }

  await transporter.sendMail({
    from,
    to: params.recruiterEmail,
    subject,
    html,
  });
}
