import { TestCase, CodeExecutionSummary } from "./code-runner";
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
 * Extracts candidate function name from source code across multiple languages.
 */
function detectFunctionName(code: string, language: string): string {
  const normLang = language.toLowerCase();
  if (normLang === "python") {
    const m = /def\s+([a-zA-Z0-9_]+)\s*\(/.exec(code);
    return m ? m[1] : "solution";
  }
  if (normLang === "java") {
    const m = /(?:public|protected|private|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\(/.exec(code);
    return m ? m[1] : "solution";
  }
  if (normLang === "cpp" || normLang === "c") {
    const m = /[\w<>\[\]:&*]+\s+([a-zA-Z0-9_]+)\s*\(/.exec(code);
    return m ? m[1] : "solution";
  }
  // JS/TS
  const m = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=)/.exec(code);
  return m ? (m[1] || m[2]) : "solution";
}

/**
 * Wraps function-style candidate solution into a standalone executable program
 * suitable for Judge0 stdin/stdout execution across languages.
 */
function buildJudge0ExecutableSource(
  code: string,
  language: string,
  testCaseInput: string
): string {
  const normLang = language.toLowerCase();
  const fnName = detectFunctionName(code, normLang);

  if (normLang === "python") {
    return `
# Candidate Solution
${code}

# Judge0 Test Harness
import json, sys

def __judge0_harness():
    try:
        fn_name = "${fnName}"
        fn = globals().get(fn_name)
        if not callable(fn):
            print(f"Error: Function '{fn_name}' not defined", file=sys.stderr)
            sys.exit(1)

        raw_input = ${JSON.stringify(testCaseInput)}
        try:
            args = eval(f"({raw_input},)")
        except Exception:
            args = (eval(raw_input),)

        res = fn(*args)
        # Print JSON-serialized result for stdout comparison
        print(json.dumps(res, separators=(',', ':')))
    except Exception as e:
        print(f"RuntimeError: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    __judge0_harness()
`;
  }

  if (normLang === "javascript" || normLang === "typescript") {
    return `
// Candidate Solution
${code}

// Judge0 Test Harness
try {
  const rawInput = ${JSON.stringify(testCaseInput)};
  let args;
  try {
    args = eval("[" + rawInput + "]");
  } catch {
    args = [eval(rawInput)];
  }

  const fnName = "${fnName}";
  let fn = null;
  try { fn = eval(fnName); } catch(e) {}
  if (typeof fn !== "function" && typeof solution === "function") fn = solution;
  if (typeof fn !== "function" && typeof solve === "function") fn = solve;
  if (typeof fn !== "function" && typeof twoSum === "function") fn = twoSum;

  if (typeof fn !== "function") {
    console.error("Error: Function '" + fnName + "' not defined");
    process.exit(1);
  }

  const res = fn.apply(null, args);
  console.log(JSON.stringify(res));
} catch (err) {
  console.error("RuntimeError: " + err);
  process.exit(1);
}
`;
  }

  // Fallback: return raw code
  return code;
}

/**
 * Runs candidate code against test cases using Judge0 CE.
 * When Judge0 is offline or unavailable, returns "not evaluated" to ensure
 * untrusted user code NEVER runs directly in the host server process.
 */
export async function executeCodeOnServer(
  code: string,
  testCases: TestCase[],
  language: string = "javascript"
): Promise<CodeExecutionSummary & { status?: string }> {
  const judge0Url = process.env.JUDGE0_URL?.replace(/\/$/, "");
  const judge0ApiKey = process.env.JUDGE0_API_KEY;

  const normLang = (language || "javascript").toLowerCase();
  const langId = JUDGE0_LANGUAGE_IDS[normLang];

  if (!testCases || testCases.length === 0) {
    return {
      passed: null,
      total: 0,
      results: [],
      logs: ["No automated test cases configured for this question."],
      status: "NO_TESTS",
    };
  }

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

        const executableSource = buildJudge0ExecutableSource(code, normLang, tc.input);
        const expectedNormalized =
          typeof tc.expectedOutput === "string"
            ? tc.expectedOutput.trim().replace(/\s+/g, "")
            : JSON.stringify(tc.expectedOutput);

        // Create submission with wait=true
        const subRes = await fetch(`${judge0Url}/submissions?wait=true`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            source_code: executableSource,
            language_id: langId,
            stdin: tc.input,
            expected_output: expectedNormalized,
            cpu_time_limit: 2,
          }),
        });

        if (subRes.ok) {
          const subData: Judge0SubmissionResponse = await subRes.json();
          const actualOutput = (subData.stdout || "").trim().replace(/\s+/g, "");
          const isAccepted = subData.status?.id === 3 || actualOutput === expectedNormalized;
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
        logs: [`Executed ${testCases.length} test cases via Judge0 sandbox [${normLang}].`],
        status: "COMPLETED",
      };
    } catch (err: any) {
      logger.warn({
        event: "judge0_offline_safe_mode",
        message: "Judge0 endpoint error or unreachable. Host process will not execute untrusted code.",
        error: err.message,
      });
    }
  }

  // Safe fallback: when Judge0 is down or not configured, return "not evaluated"
  // Untrusted candidate code MUST NOT run inside the Next.js process via node:vm
  return {
    passed: null,
    total: testCases.length,
    results: testCases.map((tc) => ({
      input: tc.input,
      expected: String(tc.expectedOutput),
      actual: "Not evaluated (Judge0 sandbox offline)",
      passed: false,
      isHidden: !!tc.isHidden,
      error: "Automated execution offline. Code preserved for interviewer review.",
    })),
    logs: [
      `Automated test evaluation is offline (Judge0 sandbox unavailable). Code solution will be evaluated by interviewer / AI.`,
    ],
    status: "NOT_EVALUATED",
  };
}
