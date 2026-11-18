import vm from "node:vm";
import ts from "typescript";

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

/**
 * Strict structural deep equality comparator.
 * Enforces strict type consistency:
 * - "[1, 2]" vs [1, 2] FAILS (string !== array)
 * - "TRUE" vs true FAILS (string !== boolean)
 * - Strict array and object structural recursion
 */
export function deepEqual(actual: any, expected: any): boolean {
  // If expected is passed as a string representation of JSON (standard for test cases)
  let parsedExpected = expected;
  if (typeof expected === "string") {
    const trimmed = expected.trim();
    // Only parse if it represents an object, array, boolean, number or null
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      trimmed === "true" ||
      trimmed === "false" ||
      trimmed === "null" ||
      (!isNaN(Number(trimmed)) && trimmed !== "")
    ) {
      try {
        parsedExpected = JSON.parse(trimmed);
      } catch {
        parsedExpected = expected;
      }
    }
  }

  return strictEqual(actual, parsedExpected);
}

function strictEqual(a: any, b: any): boolean {
  if (a === b) return true;

  // Enforce identical types (no coercion)
  if (typeof a !== typeof b) return false;

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }

  if (typeof a !== "object") {
    return a === b;
  }

  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;

  if (aIsArr && bIsArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!strictEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;

  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
    if (key !== bKeys[i]) return false;
    if (!strictEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Executes candidate JavaScript/TypeScript code using isolated VM with prototype protection.
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
      logs: [`Language ${language} does not use VM test runner; evaluation is performed by AI grader or Judge0.`],
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

  // Security guard against sandbox escape patterns
  const forbiddenPatterns = [
    /process\s*\./,
    /child_process/,
    /constructor\s*\.\s*constructor/,
    /__proto__/,
    /importScripts/,
    /require\s*\(/,
    /fs\s*\./,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(rawCode)) {
      return {
        passed: 0,
        total: testCases.length,
        results: testCases.map((tc) => ({
          input: tc.input,
          expected: normalizeValue(tc.expectedOutput),
          actual: "SecurityViolation",
          passed: false,
          isHidden: !!tc.isHidden,
          error: "Sandbox security violation: forbidden identifier or escape attempt detected",
        })),
        logs: ["Security Exception: Code contained forbidden identifiers (process/fs/escape pattern)."],
        executionError: "Sandbox security policy violation",
      };
    }
  }

  // Compile TypeScript using official compiler transpileModule (Item 7)
  let executableCode = rawCode;
  if (normLang === "typescript") {
    try {
      const transpiled = ts.transpileModule(rawCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          removeComments: false,
        },
      });
      executableCode = transpiled.outputText;
    } catch (tsErr: any) {
      return {
        passed: 0,
        total: testCases.length,
        results: testCases.map((tc) => ({
          input: tc.input,
          expected: normalizeValue(tc.expectedOutput),
          actual: "CompileError",
          passed: false,
          isHidden: !!tc.isHidden,
          error: `TypeScript compilation error: ${tsErr.message}`,
        })),
        logs: [`TypeScript compile error: ${tsErr.message}`],
      };
    }
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
    process: undefined,
    require: undefined,
    global: undefined,
    globalThis: undefined,
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
      } catch (tcErr: any) {
        results.push({
          input: tc.input,
          expected: normalizeValue(tc.expectedOutput),
          actual: `RuntimeError: ${tcErr.message}`,
          passed: false,
          isHidden: !!tc.isHidden,
          error: tcErr.message,
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
        actual: `Error: ${err.message}`,
        passed: false,
        isHidden: !!tc.isHidden,
        error: err.message,
      })),
      logs: [`Execution failed: ${err.message}`],
      executionError: err.message,
    };
  }
}

