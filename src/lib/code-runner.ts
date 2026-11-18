import vm from "node:vm";

export interface TestCase {
  input: string;
  expectedOutput: any;
  isHidden?: boolean;
  explanation?: string;
}

export interface TestCaseResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  isHidden: boolean;
  error?: string;
}

export interface CodeExecutionSummary {
  passed: number | null;
  total: number | null;
  results: TestCaseResult[];
  logs: string[];
  executionError?: string;
}

function normalizeValue(val: any): string {
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function deepEqual(actual: any, expected: any): boolean {
  if (actual === expected) return true;
  if (actual === undefined && (expected === "undefined" || expected === undefined)) return true;
  if (actual === null && (expected === "null" || expected === null)) return true;

  const actualStr = normalizeValue(actual).trim().replace(/\s+/g, "");
  const expectedStr = normalizeValue(expected).trim().replace(/\s+/g, "");
  if (actualStr === expectedStr) return true;

  if (typeof actual === "boolean" || typeof expected === "boolean") {
    return actualStr.toLowerCase() === expectedStr.toLowerCase();
  }

  const numActual = Number(actual);
  const numExpected = Number(expected);
  if (!isNaN(numActual) && !isNaN(numExpected) && Math.abs(numActual - numExpected) < 1e-6) {
    return true;
  }

  try {
    const parsedActual = typeof actual === "object" ? actual : JSON.parse(actualStr);
    const parsedExpected = typeof expected === "object" ? expected : JSON.parse(expectedStr);
    return JSON.stringify(parsedActual) === JSON.stringify(parsedExpected);
  } catch {
    return false;
  }
}

/**
 * Executes candidate JavaScript/TypeScript code securely on the server using Node's isolated vm.
 */
export function executeCodeAgainstTestCases(
  rawCode: string,
  testCases: TestCase[],
  language: string = "javascript"
): CodeExecutionSummary {
  const normLang = (language || "javascript").toLowerCase();
  if (normLang !== "javascript" && normLang !== "typescript") {
    return {
      passed: null,
      total: null,
      results: [],
      logs: [`Language ${language} does not use VM test runner; evaluation is performed by AI grader.`],
    };
  }

  if (!testCases || testCases.length === 0) {
    return {
      passed: null,
      total: null,
      results: [],
      logs: ["No test cases configured for this question."],
    };
  }

  // Pre-process TypeScript type annotations
  let executableCode = rawCode;
  if (normLang === "typescript") {
    executableCode = executableCode
      .replace(/(?:interface|type)\s+[A-Za-z0-9_$]+(?:\s*<[^>]+>)?\s*(?:=\s*[^;]+;|{[^}]*})/g, "")
      .replace(/:\s*[A-Za-z0-9_$]+(?:\[\])?(?=[,\)])/g, "")
      .replace(/\):\s*[A-Za-z0-9_$]+(?:\[\])?\s*\{/g, ") {");
  }

  const logs: string[] = [];
  const sandbox = {
    console: {
      log: (...args: any[]) => logs.push(args.map(normalizeValue).join(" ")),
      error: (...args: any[]) => logs.push("[ERROR] " + args.map(normalizeValue).join(" ")),
      warn: (...args: any[]) => logs.push("[WARN] " + args.map(normalizeValue).join(" ")),
    },
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };

  const context = vm.createContext(sandbox);

  // Detect candidate function names
  const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>))/g;
  const candidateNames: string[] = [];
  let match;
  while ((match = fnRegex.exec(executableCode)) !== null) {
    const name = match[1] || match[2];
    if (name && !candidateNames.includes(name)) {
      candidateNames.push(name);
    }
  }

  try {
    const wrappedScript = `
      "use strict";
      ${executableCode}
      ;
      (function() {
        var names = ${JSON.stringify(candidateNames)}.concat(["solution", "solve", "twoSum", "debounce", "isValid", "mergeIntervals"]);
        for (var i = 0; i < names.length; i++) {
          try {
            var f = eval(names[i]);
            if (typeof f === "function") return f;
          } catch(e) {}
        }
        return null;
      })()
    `;

    const script = new vm.Script(wrappedScript);
    const entryFn = script.runInContext(context, { timeout: 1500 });

    if (!entryFn || typeof entryFn !== "function") {
      const results: TestCaseResult[] = testCases.map((tc) => ({
        input: tc.input,
        expected: normalizeValue(tc.expectedOutput),
        actual: "No callable function found",
        passed: false,
        isHidden: !!tc.isHidden,
        error: "No declared function found in code",
      }));
      return {
        passed: 0,
        total: testCases.length,
        results,
        logs: ["No callable function detected. Please define a function (e.g. function solution(...) { ... })."],
      };
    }

    const results: TestCaseResult[] = [];
    let passedCount = 0;

    for (const tc of testCases) {
      try {
        let args: any[];
        try {
          args = vm.runInContext(`[${tc.input}]`, context, { timeout: 500 });
        } catch {
          try {
            args = [JSON.parse(tc.input)];
          } catch {
            args = [tc.input];
          }
        }
        if (!Array.isArray(args)) {
          args = [args];
        }

        const actual = entryFn.apply(null, args);
        const actualStr = normalizeValue(actual);
        const passed = deepEqual(actual, tc.expectedOutput);
        if (passed) passedCount++;

        results.push({
          input: tc.input,
          expected: normalizeValue(tc.expectedOutput),
          actual: actualStr,
          passed,
          isHidden: !!tc.isHidden,
        });
      } catch (err: any) {
        results.push({
          input: tc.input,
          expected: normalizeValue(tc.expectedOutput),
          actual: "Runtime Error",
          passed: false,
          isHidden: !!tc.isHidden,
          error: err.message || "Runtime error during test execution",
        });
      }
    }

    return {
      passed: passedCount,
      total: testCases.length,
      results,
      logs,
    };
  } catch (err: any) {
    return {
      passed: 0,
      total: testCases.length,
      results: testCases.map((tc) => ({
        input: tc.input,
        expected: normalizeValue(tc.expectedOutput),
        actual: "Execution Failure",
        passed: false,
        isHidden: !!tc.isHidden,
        error: err.message || "Script compilation/execution failed",
      })),
      logs,
      executionError: err.message || "Script failed to compile or timed out",
    };
  }
}
