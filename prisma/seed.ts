import { PrismaClient, Difficulty, QuestionType, InterviewStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  const candidatePasswordHash = await bcrypt.hash("Password123!", 10);
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);

  // 1. Create a dummy candidate user
  const user = await prisma.user.upsert({
    where: { email: "candidate@example.com" },
    update: {
      passwordHash: candidatePasswordHash,
    },
    create: {
      email: "candidate@example.com",
      name: "Alex Morgan",
      role: Role.CANDIDATE,
      passwordHash: candidatePasswordHash,
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    },
  });

  // 1b. Create an admin user for RBAC testing
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      passwordHash: adminPasswordHash,
    },
    create: {
      email: "admin@example.com",
      name: "Admin Officer",
      role: Role.ADMIN,
      passwordHash: adminPasswordHash,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    },
  });

  console.log(`👤 Created/found candidate: ${user.name} (${user.email})`);
  console.log(`🛡️ Created/found admin: ${adminUser.name} (${adminUser.email})`);

  // 2. Seed diverse BankQuestions with per-question hints for random sampling
  const bankQuestionsData = [
    {
      title: "React Reconciliation & Virtual DOM",
      content: "Explain how React reconciliation works, the heuristic diffing assumptions, and why stable keys prevent UI remounting bugs.",
      type: QuestionType.TECHNICAL,
      difficulty: Difficulty.MEDIUM,
      tags: ["frontend", "react", "architecture", "virtual-dom"],
      expectedTopics: ["Virtual DOM", "Diffing heuristics", "Fiber tree", "Key stability"],
      hints: [
        "Contrast React's O(n) heuristic diffing against theoretical O(n^3) general tree diffing.",
        "Discuss why index keys cause state leakage across dynamically sorted lists.",
        "Explain how the Fiber work loop splits work between render and commit phases."
      ],
    },
    {
      title: "Implement Robust Async Debounce",
      content: "Implement an asynchronous debounce utility in TypeScript that supports execution cancellation and returns a promise for trailing invocations.",
      type: QuestionType.CODING,
      difficulty: Difficulty.MEDIUM,
      tags: ["frontend", "javascript", "typescript", "async"],
      expectedTopics: ["Debounce", "Closures", "Promise handling", "Cancellation"],
      hints: [
        "Store the active timer ID in closure scope alongside references to pending resolve/reject handlers.",
        "Expose a .cancel() method on the debounced function that clears the timer and rejects the pending promise.",
        "Ensure the trailing callback forwards arguments using typed Parameters<T> generics."
      ],
    },
    {
      title: "Distributed Rate Limiter Design",
      content: "Design a high-throughput, low-latency API rate limiting service that enforces tier-based rate limits across multiple stateless backend nodes.",
      type: QuestionType.SYSTEM_DESIGN,
      difficulty: Difficulty.HARD,
      tags: ["backend", "system-design", "redis", "concurrency"],
      expectedTopics: ["Token Bucket", "Sliding Window Log", "Redis Lua script", "Race conditions"],
      hints: [
        "Compare Token Bucket versus Sliding Window Counter for memory efficiency and spike tolerance.",
        "Address race conditions between GET and INCR using Redis Lua scripts or atomic transactions.",
        "Discuss fallback behavior if the distributed cache layer experiences network partitioning."
      ],
    },
    {
      title: "Database Indexing & Query Optimization",
      content: "Explain B-Tree versus Hash indexes in relational databases like PostgreSQL. When would a composite index fail to accelerate a query?",
      type: QuestionType.TECHNICAL,
      difficulty: Difficulty.MEDIUM,
      tags: ["backend", "database", "postgresql", "indexing"],
      expectedTopics: ["B-Tree", "Composite Index", "Leftmost Prefix Rule", "Index Scan"],
      hints: [
        "Recall the leftmost prefix rule: queries that omit leading columns in a composite index cannot perform range searches.",
        "Discuss sequential scans versus bitmap index scans when filtering low-cardinality values.",
        "Explain how write amplification and vacuum overhead increase with redundant indexes."
      ],
    },
  ];

  for (const bq of bankQuestionsData) {
    const existing = await prisma.bankQuestion.findFirst({
      where: { title: bq.title },
    });
    if (!existing) {
      await prisma.bankQuestion.create({
        data: {
          ...bq,
          createdById: adminUser.id,
        },
      });
    }
  }

  // 3. Seed sample Interview Invitation for candidate
  const existingInvite = await prisma.interviewInvitation.findFirst({
    where: { candidateEmail: "candidate@example.com" },
  });

  if (!existingInvite) {
    await prisma.interviewInvitation.create({
      data: {
        token: "demo-invitation-token-123",
        candidateEmail: "candidate@example.com",
        candidateName: "Alex Morgan",
        jobRole: "Senior Frontend Engineer",
        difficulty: Difficulty.MEDIUM,
        status: "INVITED",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
        invitedById: adminUser.id,
      },
    });
    console.log("📨 Seeded candidate assessment invitation: demo-invitation-token-123");
  }

  // 4. Create a completed mock interview with questions, responses, evaluations, and report
  const completedInterview = await prisma.interview.create({
    data: {
      userId: user.id,
      title: "Senior Full-Stack Engineer Mock Interview",
      jobRole: "Full Stack Engineer",
      difficulty: Difficulty.MEDIUM,
      topics: ["React", "Node.js", "System Design", "Algorithms"],
      status: InterviewStatus.COMPLETED,
      totalScore: 84.5,
      startedAt: new Date(Date.now() - 3600000 * 2),
      completedAt: new Date(Date.now() - 3600000),
      questions: {
        create: [
          {
            orderIndex: 1,
            type: QuestionType.TECHNICAL,
            content: "Explain the React reconciliation algorithm and how the Virtual DOM uses keys.",
            expectedTopics: ["Virtual DOM", "Diffing algorithm", "Fiber architecture", "Keys stability"],
            response: {
              create: {
                content:
                  "React maintains a virtual DOM representation. During reconciliation, React diffs trees by comparing root elements, keys on sibling lists, and component types. Keys provide a persistent identity across renders so React can reorder instead of re-mounting DOM nodes.",
                durationMs: 45000,
                evaluation: {
                  create: {
                    score: 9.0,
                    feedback: "Thorough explanation covering element diffing and the importance of key stability.",
                    strengths: ["Clear explanation of key persistence", "Mentioned Fiber reconciliation"],
                    weaknesses: ["Could have elaborated on heuristic O(n) complexity vs O(n^3) tree diff"],
                    followUpAsked: false,
                  },
                },
              },
            },
          },
          {
            orderIndex: 2,
            type: QuestionType.CODING,
            content: "Implement a debounce function in TypeScript with cancel capability.",
            context: "Signature: debounce<T extends (...args: any[]) => any>(fn: T, delay: number)",
            expectedTopics: ["Closures", "Timer management", "Typing", "Cancel method"],
            response: {
              create: {
                content: "Here is the debounce implementation handling trailing execution and clean cancellation.",
                code: `export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function debounced(...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}`,
                language: "typescript",
                durationMs: 120000,
                evaluation: {
                  create: {
                    score: 8.8,
                    feedback: "Clean TypeScript implementation with properly typed arguments and cancel method.",
                    strengths: ["Strong TypeScript generics", "Cancel method properly clears reference"],
                    weaknesses: ["Did not include leading execution option"],
                    codeCorrectness: 9.5,
                    codeEfficiency: 9.0,
                    codeReadability: 9.2,
                    testCasesPassed: 4,
                    testCasesTotal: 4,
                  },
                },
              },
            },
          },
        ],
      },
      report: {
        create: {
          overallScore: 84.5,
          technicalScore: 86.0,
          communicationScore: 82.0,
          problemSolvingScore: 85.5,
          codeQualityScore: 92.0,
          summary:
            "Alex demonstrated strong full-stack foundations with notable proficiency in TypeScript, React internals, and practical coding.",
          strengths: ["Strong understanding of React reconciliation", "Clean and typed coding style"],
          weaknesses: ["Could speak more to edge-case handling under distributed load"],
          recommendations: [
            "Review debounce variations (leading vs trailing edge)",
            "Deep dive into React 19 Server Components paradigm",
          ],
          detailedFeedback: {
            breakdown: {
              react: "Advanced",
              typescript: "Proficient",
              algorithms: "Solid",
            },
          },
        },
      },
    },
  });

  console.log(`✅ Seeded completed interview: ${completedInterview.id}`);
  console.log("✨ Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
