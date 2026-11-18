import { executeCodeAgainstTestCases, TestCase, CodeExecutionSummary } from "./code-runner";
import { logger } from "./logger";

export const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
};

export interface Judge0SubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

export interface Judge0SubmissionResponse {
  token: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  status?: {
    id: number;
    description: string;
  };
}

/**
 * Runs candidate code against test cases using Judge0 CE if configured,
 * otherwise falling back to the sandboxed in-memory runner for JavaScript/TypeScript.
 */
export async function executeCodeOnServer(
  code: string,
  testCases: TestCase[],
  language: string = "javascript"
): Promise<CodeExecutionSummary> {
  const judge0Url = process.env.JUDGE0_URL?.replace(/\/$/, "");
  const judge0ApiKey = process.env.JUDGE0_API_KEY;

  const normLang = (language || "javascript").toLowerCase();
  const langId = JUDGE0_LANGUAGE_IDS[normLang];

  if (judge0Url && langId) {
    try {
      logger.info({ event: "judge0_execution_start", language: normLang, testCaseCount: testCases.length });

      const results = [];
      let passedCount = 0;

      for (const tc of testCases) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (judge0ApiKey) {
          headers["X-RapidAPI-Key"] = judge0ApiKey;
          headers["X-RapidAPI-Host"] = new URL(judge0Url).host;
        }

        // Create submission
        const subRes = await fetch(`${judge0Url}/submissions?wait=true`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            source_code: code,
            language_id: langId,
            stdin: tc.input,
            expected_output: typeof tc.expectedOutput === "string" ? tc.expectedOutput : JSON.stringify(tc.expectedOutput),
            cpu_time_limit: 2,
          }),
        });

        if (subRes.ok) {
          const subData: Judge0SubmissionResponse = await subRes.json();
          const isAccepted = subData.status?.id === 3; // 3 = Accepted
          if (isAccepted) passedCount++;

          results.push({
            input: tc.input,
            expected: String(tc.expectedOutput),
            actual: (subData.stdout || subData.stderr || subData.compile_output || "").trim(),
            passed: isAccepted,
            isHidden: !!tc.isHidden,
            error: subData.stderr || subData.compile_output || undefined,
          });
        } else {
          throw new Error(`Judge0 responded with HTTP ${subRes.status}`);
        }
      }

      logger.info({ event: "judge0_execution_complete", passed: passedCount, total: testCases.length });
      return {
        passed: passedCount,
        total: testCases.length,
        results,
        logs: [`Executed ${testCases.length} test cases via Judge0 CE [${normLang}].`],
      };
    } catch (err: any) {
      logger.warn({
        event: "judge0_fallback",
        message: "Judge0 endpoint error or unreachable, using local execution engine.",
        error: err.message,
      });
    }
  }

  // Graceful fallback: local secure VM runner
  return executeCodeAgainstTestCases(code, testCases, normLang);
}
