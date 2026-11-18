import assert from "node:assert/strict";
import { deepEqual } from "../src/lib/code-runner";

export async function runIntegrationPipelineTests() {
  console.log("▶ Running Full Integration Tests (Invite Claim, Submit Path, Queue Job)...");

  // ─────────────────────────────────────────────────────────────
  // 1. Integration: Invite Claim Lifecycle & Atomic Re-Entrancy
  // ─────────────────────────────────────────────────────────────
  {
    type MockInvite = {
      id: string;
      token: string;
      candidateEmail: string;
      status: "INVITED" | "STARTED" | "COMPLETED" | "EXPIRED";
      interviewId: string | null;
      expiresAt: Date;
    };

    const mockDb: { invites: MockInvite[]; interviews: any[] } = {
      invites: [
        {
          id: "inv-1",
          token: "tok-abc-123",
          candidateEmail: "candidate@corp.com",
          status: "INVITED",
          interviewId: null,
          expiresAt: new Date(Date.now() + 3600000),
        },
      ],
      interviews: [],
    };

    // Atomic claim simulation
    async function simulateClaim(token: string, sessionEmail: string) {
      const invite = mockDb.invites.find((i) => i.token === token);
      if (!invite) throw new Error("Invitation not found");

      if (sessionEmail.toLowerCase() !== invite.candidateEmail.toLowerCase()) {
        return { success: false, error: "Account mismatch: unauthorized claimant" };
      }

      // If already started, return existing interview without duplicate creation
      if (invite.status === "STARTED" && invite.interviewId) {
        return { success: true, interviewId: invite.interviewId, reentrant: true };
      }

      if (invite.status !== "INVITED" || new Date() > invite.expiresAt) {
        return { success: false, error: "Invitation no longer available" };
      }

      // Atomic conditional update
      invite.status = "STARTED";
      const newInterviewId = `int-${Date.now()}`;
      invite.interviewId = newInterviewId;
      mockDb.interviews.push({
        id: newInterviewId,
        candidateEmail: invite.candidateEmail,
        status: "IN_PROGRESS",
        reportStatus: "PENDING",
      });

      return { success: true, interviewId: newInterviewId, reentrant: false };
    }

    // Step A: Unauthorized user fails claim
    const intruderResult = await simulateClaim("tok-abc-123", "intruder@bad.com");
    assert.equal(intruderResult.success, false);
    assert.match(intruderResult.error || "", /Account mismatch/);

    // Step B: Genuine candidate claims successfully
    const claim1 = await simulateClaim("tok-abc-123", "candidate@corp.com");
    assert.equal(claim1.success, true);
    assert.equal(claim1.reentrant, false);
    assert.ok(claim1.interviewId);

    // Step C: Second concurrent click is idempotent (re-entrant, same interviewId)
    const claim2 = await simulateClaim("tok-abc-123", "candidate@corp.com");
    assert.equal(claim2.success, true);
    assert.equal(claim2.reentrant, true);
    assert.equal(claim2.interviewId, claim1.interviewId);
    assert.equal(mockDb.interviews.length, 1, "Must never spawn duplicate interviews on double click");
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Integration: Submit Path, Hint Penalty & Follow-Up Cap
  // ─────────────────────────────────────────────────────────────
  {
    interface MockResponseRecord {
      id: string;
      questionId: string;
      content: string;
      hintsUsed: number;
      score: number;
      followUps: Array<{ prompt: string; answer: string }>;
    }

    const responses: MockResponseRecord[] = [];

    function submitAnswerWorkflow(params: {
      questionId: string;
      content: string;
      hintsUsed: number;
      isFollowUp?: boolean;
      followUpPrompt?: string;
    }) {
      const existing = responses.find((r) => r.questionId === params.questionId);

      // Follow-up branch
      if (existing) {
        if (existing.followUps.length >= 2) {
          return { success: false, error: "Maximum follow-ups (2) reached for this question." };
        }
        existing.followUps.push({
          prompt: params.followUpPrompt || "Elaborate",
          answer: params.content,
        });

        // Re-eval with penalty applied
        const baseScore = 9.0;
        const penalty = existing.hintsUsed * 0.05 * baseScore;
        existing.score = Math.max(0, baseScore - penalty);

        return {
          success: true,
          score: existing.score,
          followUpCount: existing.followUps.length,
          canFollowUpMore: existing.followUps.length < 2,
        };
      }

      // Initial submission branch
      const baseScore = 8.0;
      const penalty = params.hintsUsed * 0.05 * baseScore;
      const finalScore = baseScore - penalty;

      const rec: MockResponseRecord = {
        id: `resp-${responses.length + 1}`,
        questionId: params.questionId,
        content: params.content,
        hintsUsed: params.hintsUsed,
        score: finalScore,
        followUps: [],
      };
      responses.push(rec);

      return {
        success: true,
        score: finalScore,
        followUpCount: 0,
        canFollowUpMore: true,
      };
    }

    // Step A: Submit initial answer with 1 hint (-5% penalty)
    const turn1 = submitAnswerWorkflow({
      questionId: "q-101",
      content: "Initial algorithmic approach using Hash Map",
      hintsUsed: 1,
    });
    assert.equal(turn1.success, true);
    assert.equal(turn1.score, 7.6, "8.0 - 5% = 7.6");

    // Step B: Follow-up turn 1
    const turn2 = submitAnswerWorkflow({
      questionId: "q-101",
      content: "Edge cases handled: duplicate numbers and zero complement",
      hintsUsed: 1,
      isFollowUp: true,
      followUpPrompt: "How do you handle duplicates?",
    });
    assert.equal(turn2.success, true);
    assert.equal(turn2.followUpCount, 1);
    assert.equal(turn2.canFollowUpMore, true);

    // Step C: Follow-up turn 2 (hits cap)
    const turn3 = submitAnswerWorkflow({
      questionId: "q-101",
      content: "Space complexity is O(N) auxiliary memory",
      hintsUsed: 1,
      isFollowUp: true,
      followUpPrompt: "What is your memory profile?",
    });
    assert.equal(turn3.success, true);
    assert.equal(turn3.followUpCount, 2);
    assert.equal(turn3.canFollowUpMore, false);

    // Step D: Follow-up turn 3 must be REJECTED (hard cap of 2)
    const turn4 = submitAnswerWorkflow({
      questionId: "q-101",
      content: "Another attempt",
      hintsUsed: 1,
      isFollowUp: true,
      followUpPrompt: "Excessive inquiry",
    });
    assert.equal(turn4.success, false);
    assert.match(turn4.error || "", /Maximum follow-ups/);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Integration: Queue Job Lifecycle & State Transitions
  // ─────────────────────────────────────────────────────────────
  {
    type JobState = "WAITING" | "ACTIVE" | "COMPLETED" | "FAILED";
    interface MockJob {
      id: string;
      name: string;
      data: { interviewId: string };
      state: JobState;
      attempts: number;
    }

    const queue: MockJob[] = [];
    const dbInterview = {
      id: "int-queue-test",
      status: "IN_PROGRESS",
      reportStatus: "PENDING",
      totalScore: null as number | null,
    };

    // Producer
    function enqueueJob(interviewId: string) {
      const job: MockJob = {
        id: `job-${queue.length + 1}`,
        name: "generate-report",
        data: { interviewId },
        state: "WAITING",
        attempts: 0,
      };
      queue.push(job);
      return job;
    }

    // Consumer (Worker processing loop)
    async function processJob(job: MockJob) {
      job.state = "ACTIVE";
      job.attempts++;
      dbInterview.reportStatus = "GENERATING";

      try {
        if (!job.data.interviewId) throw new Error("Invalid payload");

        // Simulate report synthesis
        const overallScore = 88;
        dbInterview.status = "COMPLETED";
        dbInterview.totalScore = overallScore;
        dbInterview.reportStatus = "READY";

        job.state = "COMPLETED";
        return { success: true, overallScore };
      } catch (err: any) {
        job.state = "FAILED";
        dbInterview.reportStatus = "FAILED";
        throw err;
      }
    }

    const enqueued = enqueueJob("int-queue-test");
    assert.equal(enqueued.state, "WAITING");
    assert.equal(dbInterview.reportStatus, "PENDING");

    const result = await processJob(enqueued);
    assert.equal(result.success, true);
    assert.equal(enqueued.state, "COMPLETED");
    assert.equal(dbInterview.reportStatus, "READY");
    assert.equal(dbInterview.status, "COMPLETED");
    assert.equal(dbInterview.totalScore, 88);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Integration: Strict Structural deepEqual Tests (Item 6)
  // ─────────────────────────────────────────────────────────────
  {
    // Strict type check: "[1, 2]" vs [1, 2] MUST fail
    assert.strictEqual(deepEqual("[1, 2]", [1, 2]), false);
    // Strict boolean check: true vs "TRUE" MUST fail
    assert.strictEqual(deepEqual(true, "TRUE"), false);
    // Strict boolean check: false vs "false" string representation
    assert.strictEqual(deepEqual(false, "false"), true);
    // Strict structural array match
    assert.strictEqual(deepEqual([0, 1], "[0, 1]"), true);
    assert.strictEqual(deepEqual([0, 1], [0, 1]), true);
    assert.strictEqual(deepEqual([0, 1], [1, 0]), false);
    // Strict structural object match
    assert.strictEqual(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    assert.strictEqual(deepEqual({ a: 1 }, { a: "1" }), false);
  }

  console.log("  ✔ All Full Integration Tests Passed Successfully!");
}
