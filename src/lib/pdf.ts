import { db } from "./db";

export interface PdfReportData {
  candidateName: string;
  candidateEmail: string;
  jobRole: string;
  difficulty: string;
  completedAt: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  codeQualityScore?: number | null;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  questions: Array<{
    orderIndex: number;
    type: string;
    content: string;
    score?: number;
    feedback?: string;
    code?: string | null;
  }>;
  flaggedEvents: Array<{
    type: string;
    description: string | null;
    createdAt: string;
  }>;
}

/**
 * Builds printable HTML document for PDF generation or direct PDF download.
 */
export function buildReportHtml(data: PdfReportData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Assessment Report - ${data.candidateName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; font-size: 13px; }
    .header { border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
    .score-banner { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; display: flex; justify-content: space-around; margin-bottom: 25px; }
    .score-card { text-align: center; }
    .score-num { font-size: 28px; font-weight: 800; color: #6366f1; }
    .score-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-top: 4px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    .list-item { margin-bottom: 6px; }
    .code-box { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 11px; overflow-x: auto; white-space: pre-wrap; margin-top: 8px; }
    .q-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #e0e7ff; color: #4338ca; }
    .flag { background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 4px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">Technical Assessment Report</h1>
      <div class="subtitle">${data.candidateName} (${data.candidateEmail}) • ${data.jobRole} (${data.difficulty})</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      <div>Completed: ${data.completedAt}</div>
      <div>Platform: AI Interviewer</div>
    </div>
  </div>

  <div class="score-banner">
    <div class="score-card">
      <div class="score-num">${data.overallScore}/100</div>
      <div class="score-label">Overall Score</div>
    </div>
    <div class="score-card">
      <div class="score-num" style="color: #0284c7;">${data.technicalScore}/100</div>
      <div class="score-label">Technical</div>
    </div>
    <div class="score-card">
      <div class="score-num" style="color: #10b981;">${data.problemSolvingScore}/100</div>
      <div class="score-label">Problem Solving</div>
    </div>
    <div class="score-card">
      <div class="score-num" style="color: #8b5cf6;">${data.communicationScore}/100</div>
      <div class="score-label">Communication</div>
    </div>
    ${data.codeQualityScore !== null && data.codeQualityScore !== undefined ? `
    <div class="score-card">
      <div class="score-num" style="color: #f59e0b;">${data.codeQualityScore}/100</div>
      <div class="score-label">Code Quality</div>
    </div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Executive Summary</div>
    <p>${data.summary}</p>
  </div>

  <div class="section">
    <div class="section-title">Key Strengths</div>
    <ul>
      ${data.strengths.map((s) => `<li class="list-item">${s}</li>`).join("")}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">Areas for Development</div>
    <ul>
      ${data.weaknesses.map((w) => `<li class="list-item">${w}</li>`).join("")}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">Recommendations</div>
    <ul>
      ${data.recommendations.map((r) => `<li class="list-item">${r}</li>`).join("")}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">Question Breakdown</div>
    ${data.questions
      .map(
        (q) => `
      <div class="q-card">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <div><span class="tag">${q.type}</span> <strong>Question ${q.orderIndex}</strong></div>
          <div style="font-weight: 700; color: #6366f1;">${q.score !== undefined ? `Score: ${q.score}/10` : "Not evaluated"}</div>
        </div>
        <p style="margin: 4px 0 8px;">${q.content}</p>
        ${q.feedback ? `<div style="font-size: 12px; color: #475569;"><strong>AI Feedback:</strong> ${q.feedback}</div>` : ""}
        ${q.code ? `<div class="code-box">${q.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
      </div>
    `
      )
      .join("")}
  </div>

  ${
    data.flaggedEvents.length > 0
      ? `
  <div class="section">
    <div class="section-title">Proctoring Telemetry (${data.flaggedEvents.length} flags)</div>
    ${data.flaggedEvents
      .map(
        (ev) => `
      <div class="flag">
        <strong>${ev.type}</strong>: ${ev.description || "Unusual window or focus activity detected"} (${ev.createdAt})
      </div>
    `
      )
      .join("")}
  </div>
  `
      : ""
  }
</body>
</html>`;
}

/**
 * Generates report buffer from database interview ID.
 */
export async function generateReportPdfBuffer(interviewId: string): Promise<Buffer> {
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
    include: {
      user: true,
      report: true,
      activities: { orderBy: { timestamp: "asc" } },
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { response: { include: { evaluation: true } } },
      },
    },
  });

  if (!interview || !interview.report) {
    throw new Error("Interview report not found or not yet generated.");
  }

  const reportData: PdfReportData = {
    candidateName: interview.user.name || "Candidate",
    candidateEmail: interview.user.email,
    jobRole: interview.jobRole,
    difficulty: interview.difficulty,
    completedAt: interview.completedAt ? new Date(interview.completedAt).toLocaleString() : new Date().toLocaleString(),
    overallScore: Math.round(interview.report.overallScore),
    technicalScore: Math.round(interview.report.technicalScore),
    communicationScore: Math.round(interview.report.communicationScore),
    problemSolvingScore: Math.round(interview.report.problemSolvingScore),
    codeQualityScore: interview.report.codeQualityScore ? Math.round(interview.report.codeQualityScore) : null,
    summary: interview.report.summary,
    strengths: interview.report.strengths,
    weaknesses: interview.report.weaknesses,
    recommendations: interview.report.recommendations,
    questions: interview.questions.map((q) => ({
      orderIndex: q.orderIndex,
      type: q.type,
      content: q.content,
      score: q.response?.evaluation?.score,
      feedback: q.response?.evaluation?.feedback,
      code: q.response?.code,
    })),
    flaggedEvents: interview.activities.map((ev) => ({
      type: ev.type,
      description: ev.description,
      createdAt: new Date(ev.timestamp).toLocaleTimeString(),
    })),
  };

  const html = buildReportHtml(reportData);
  return Buffer.from(html, "utf-8");
}
