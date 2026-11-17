import assert from "node:assert";

export async function runCodeExecutionTests() {
  console.log("▶ Running Code Editor & Execution Tests...");

  // 1. Function name regex extraction
  const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>))/g;
  
  const sampleCode1 = `
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
  const names1: string[] = [];
  let m1;
  while ((m1 = fnRegex.exec(sampleCode1)) !== null) {
    const name = m1[1] || m1[2];
    if (name && !names1.includes(name)) names1.push(name);
  }
  assert.deepStrictEqual(names1, ["twoSum"]);

  // 2. Arrow function extraction
  const sampleCode2 = `
    const solve = (a, b) => a + b;
  `;
  const names2: string[] = [];
  let m2;
  while ((m2 = fnRegex.exec(sampleCode2)) !== null) {
    const name = m2[1] || m2[2];
    if (name && !names2.includes(name)) names2.push(name);
  }
  assert.deepStrictEqual(names2, ["solve"]);

  // 3. Deep equality comparison logic
  function deepEqual(actual: any, expected: any): boolean {
    if (actual === expected) return true;
    if (actual === undefined && (expected === "undefined" || expected === undefined)) return true;
    if (actual === null && (expected === "null" || expected === null)) return true;

    const actualStr = actual === undefined ? "undefined" : (typeof actual === "object" ? JSON.stringify(actual) : String(actual));
    const normActual = actualStr.trim().replace(/\s+/g, "");
    const normExpected = String(expected).trim().replace(/\s+/g, "");

    if (normActual === normExpected) return true;

    if ((actual === true || actual === false) && normActual.toLowerCase() === normExpected.toLowerCase()) return true;

    const numActual = Number(actual);
    const numExpected = Number(expected);
    if (!isNaN(numActual) && !isNaN(numExpected) && Math.abs(numActual - numExpected) < 1e-6) {
      return true;
    }

    try {
      const pActual = typeof actual === "object" ? actual : JSON.parse(normActual);
      const pExpected = JSON.parse(normExpected);
      return JSON.stringify(pActual) === JSON.stringify(pExpected);
    } catch {
      // ignore
    }

    return false;
  }

  assert.strictEqual(deepEqual([0, 1], "[0, 1]"), true);
  assert.strictEqual(deepEqual([0, 1], "[0,1]"), true);
  assert.strictEqual(deepEqual(true, "true"), true);
  assert.strictEqual(deepEqual(42, "42"), true);
  assert.strictEqual(deepEqual([0, 1], "[1, 2]"), false);

  // 4. In-process execution simulation
  const runner = new Function(
    "customConsole",
    `
    var console = customConsole;
    function twoSum(nums, target) {
      const map = new Map();
      for (let i = 0; i < nums.length; i++) {
        const comp = target - nums[i];
        if (map.has(comp)) return [map.get(comp), i];
        map.set(nums[i], i);
      }
      return [];
    }
    return twoSum;
    `
  );
  const entryFn = runner({ log: () => {}, error: () => {}, warn: () => {} });
  assert.strictEqual(typeof entryFn, "function");

  const testArgs = eval("[[2, 7, 11, 15], 9]");
  const result = entryFn(...testArgs);
  assert.deepStrictEqual(result, [0, 1]);
  assert.strictEqual(deepEqual(result, "[0, 1]"), true);

  console.log("  ✔ All Code Editor & Execution Tests Passed!");
}

