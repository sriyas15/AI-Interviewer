import { PrismaClient, Difficulty, QuestionType, InterviewStatus, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Create a dummy candidate user
  const user = await prisma.user.upsert({
    where: { email: "candidate@example.com" },
    update: {},
    create: {
      email: "candidate@example.com",
      name: "Alex Morgan",
      role: Role.CANDIDATE,
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    },
  });

  console.log(`👤 Created/found user: ${user.name} (${user.email})`);

  // 2. Create a completed mock interview with questions, responses, evaluations, and report
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
