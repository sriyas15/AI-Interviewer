import assert from "node:assert/strict";
import { executeCodeAgainstTestCases } from "../src/lib/code-runner";

export async function runCodeRunnerTests() {
  console.log("▶ Running Server-Side Code Sandbox Tests (from src/lib/code-runner)...");

  // 1. Valid JavaScript solution
  {
    const code = `
      function twoSum(nums, target) {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
          const comp = target - nums[i];
          if (map.has(comp)) return [map.get(comp), i];
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    const testCases = [
      { input: "[2, 7, 11, 15], 9", expectedOutput: [0, 1], isHidden: false },
      { input: "[3, 2, 4], 6", expectedOutput: [1, 2], isHidden: false },
      { input: "[3, 3], 6", expectedOutput: [0, 1], isHidden: true },
    ];

    const res = executeCodeAgainstTestCases(code, testCases, "javascript");
    assert.equal(res.passed, 3, "All 3 test cases should pass");
    assert.equal(res.total, 3);
    assert.equal(res.results.length, 3);
    assert.equal(res.results[2].isHidden, true);
  }

  // 2. TypeScript solution with types stripped
  {
    const tsCode = `
      interface PairResult {
        indices: number[];
      }
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const testCases = [
      { input: "2, 3", expectedOutput: 5, isHidden: false },
      { input: "-1, 1", expectedOutput: 0, isHidden: false },
    ];
    const res = executeCodeAgainstTestCases(tsCode, testCases, "typescript");
    assert.equal(res.passed, 2);
    assert.equal(res.total, 2);
  }

  // 3. Failing solution
  {
    const buggyCode = `function twoSum(nums, target) { return [0, 0]; }`;
    const testCases = [
      { input: "[2, 7, 11, 15], 9", expectedOutput: [0, 1] },
      { input: "[3, 2, 4], 6", expectedOutput: [1, 2] },
    ];
    const res = executeCodeAgainstTestCases(buggyCode, testCases, "javascript");
    assert.equal(res.passed, 0);
    assert.equal(res.total, 2);
    assert.equal(res.results[0].passed, false);
  }

  // 4. Runtime error protection
  {
    const syntaxErrCode = `function solution() { throw new Error("Calculation overflow"); }`;
    const testCases = [{ input: "1", expectedOutput: 1 }];
    const res = executeCodeAgainstTestCases(syntaxErrCode, testCases, "javascript");
    assert.equal(res.passed, 0);
    assert.match(res.results[0]?.error || "", /Calculation overflow/i);
  }

  console.log("  ✔ All Server-Side Code Sandbox Tests Passed!");
}
