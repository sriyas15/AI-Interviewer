"use client";

import { useState, useRef } from "react";
import {
  Play,
  RotateCcw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Code2,
  Loader2,
  History,
  Check,
  X,
  Layers,
} from "lucide-react";

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  isHidden?: boolean;
}

interface RunHistoryEntry {
  id: string;
  timestamp: string;
  status: "SUCCESS" | "ERROR" | "TIMEOUT";
  output: string;
  durationMs: number;
}

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  sampleTestCases?: TestCase[];
  onTestResultsChange?: (summary: { passed: number; total: number; results: TestResult[] }) => void;
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  onLanguageChange,
  sampleTestCases = [
    { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" },
    { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]" },
  ],
  onTestResultsChange,
}: CodeEditorProps) {
  const [output, setOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);

  // Tab: "console" | "tests" | "history" (C4)
  const [activeBottomTab, setActiveBottomTab] = useState<"console" | "tests" | "history">("console");
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [testResults, setTestResults] = useState<
    Array<{ input: string; expected: string; actual: string; passed: boolean }>
  >([]);

  const gutterRef = useRef<HTMLDivElement>(null);

  // Handle Tab key to insert 2 spaces
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Safe Sandboxed In-Browser Execution via Web Worker
  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);
    setHasError(false);
    const startTime = performance.now();

    try {
      if (language !== "javascript" && language !== "typescript") {
        const msg = `[Language Preview: ${language}]\nSyntax accepted. Server-side test runner and AI will evaluate your ${language} solution upon submission.\n(Tip: Switch to JavaScript/TypeScript to test your functions interactively in this browser sandbox.)`;
        setOutput(msg);
        setExecutionTime(Math.round(performance.now() - startTime));
        setIsRunning(false);
        return;
      }

      if (typeof window === "undefined" || typeof Worker === "undefined") {
        setOutput("Web Worker environment not available in this browser.");
        setHasError(true);
        setIsRunning(false);
        return;
      }

      // Pre-process TypeScript type annotations to run smoothly in standard JavaScript engine
      let executableCode = value;
      if (language === "typescript") {
        executableCode = executableCode
          .replace(/(?:interface|type)\s+[A-Za-z0-9_$]+(?:\s*<[^>]+>)?\s*(?:=\s*[^;]+;|{[^}]*})/g, "")
          .replace(/:\s*[A-Za-z0-9_$]+(?:\[\])?(?=[,\)])/g, "")
          .replace(/\):\s*[A-Za-z0-9_$]+(?:\[\])?\s*\{/g, ") {");
      }

      // Extract candidate function declarations
      const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>))/g;
      const candidateNames: string[] = [];
      let match;
      while ((match = fnRegex.exec(executableCode)) !== null) {
        const name = match[1] || match[2];
        if (name && !candidateNames.includes(name)) {
          candidateNames.push(name);
        }
      }

      const workerCode = `
        self.onmessage = function(e) {
          var code = e.data.code;
          var testCases = e.data.testCases || [];
          var candidateNames = e.data.candidateNames || [];
          var logs = [];

          var customConsole = {
            log: function() {
              var args = Array.prototype.slice.call(arguments);
              logs.push(args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }).join(' '));
            },
            error: function() {
              var args = Array.prototype.slice.call(arguments);
              logs.push('[ERROR] ' + args.map(function(a) { return String(a); }).join(' '));
            },
            warn: function() {
              var args = Array.prototype.slice.call(arguments);
              logs.push('[WARN] ' + args.map(function(a) { return String(a); }).join(' '));
            }
          };

          function deepEqual(actual, expected) {
            if (actual === expected) return true;
            if (actual === undefined && (expected === "undefined" || expected === undefined)) return true;
            if (actual === null && (expected === "null" || expected === null)) return true;

            var actualStr = actual === undefined ? "undefined" : (typeof actual === "object" ? JSON.stringify(actual) : String(actual));
            var normActual = actualStr.trim().replace(/\\s+/g, '');
            var normExpected = String(expected).trim().replace(/\\s+/g, '');

            if (normActual === normExpected) return true;

            if ((actual === true || actual === false) && normActual.toLowerCase() === normExpected.toLowerCase()) return true;

            var numActual = Number(actual);
            var numExpected = Number(expected);
            if (!isNaN(numActual) && !isNaN(numExpected) && Math.abs(numActual - numExpected) < 1e-6) {
              return true;
            }

            try {
              var pActual = typeof actual === 'object' ? actual : JSON.parse(normActual);
              var pExpected = JSON.parse(normExpected);
              return JSON.stringify(pActual) === JSON.stringify(pExpected);
            } catch(e) {}

            return false;
          }

          try {
            // Execute candidate code and resolve entry function
            var runner = new Function(
              'customConsole',
              'var console = customConsole;\\n' +
              code + '\\n' +
              'var names = ' + JSON.stringify(candidateNames) + '.concat(["twoSum", "solution", "solve", "debounce", "isValid", "mergeIntervals", "findMedianSortedArrays"]);\\n' +
              'for (var i = 0; i < names.length; i++) {\\n' +
              '  try {\\n' +
              '    var f = eval(names[i]);\\n' +
              '    if (typeof f === "function") return f;\\n' +
              '  } catch(e) {}\\n' +
              '}\\n' +
              'return null;\\n'
            );

            var entryFn = runner(customConsole);

            var testResults = [];
            if (testCases && testCases.length > 0) {
              if (!entryFn) {
                logs.push("Note: No callable function was detected in your code. Please define a function (e.g. function solution(...) { ... }) to run against test cases.");
                for (var t = 0; t < testCases.length; t++) {
                  testResults.push({
                    input: testCases[t].input,
                    expected: testCases[t].expectedOutput,
                    actual: "No function found",
                    passed: false,
                    isHidden: !!testCases[t].isHidden
                  });
                }
              } else {
                for (var i = 0; i < testCases.length; i++) {
                  var tc = testCases[i];
                  try {
                    var args;
                    try {
                      args = eval('[' + tc.input + ']');
                    } catch(e1) {
                      try {
                        args = [JSON.parse(tc.input)];
                      } catch(e2) {
                        args = [tc.input];
                      }
                    }
                    if (!Array.isArray(args)) {
                      args = [args];
                    }

                    var actual = entryFn.apply(null, args);
                    var actualStr = actual === undefined ? "undefined" : (typeof actual === "object" ? JSON.stringify(actual) : String(actual));
                    var passed = deepEqual(actual, tc.expectedOutput);

                    testResults.push({
                      input: tc.input,
                      expected: tc.expectedOutput,
                      actual: actualStr,
                      passed: passed,
                      isHidden: !!tc.isHidden
                    });
                  } catch(tcErr) {
                    testResults.push({
                      input: tc.input,
                      expected: tc.expectedOutput,
                      actual: "Error: " + tcErr.message,
                      passed: false,
                      isHidden: !!tc.isHidden
                    });
                  }
                }
              }
            }

            self.postMessage({
              success: true,
              logs: logs,
              testResults: testResults
            });
          } catch (err) {
            self.postMessage({
              success: false,
              error: err.message,
              logs: logs
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const timeoutId = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        setExecutionTime(3000);
        const timeoutMsg = "Execution timed out (3000ms limit exceeded).";
        setOutput(timeoutMsg);
        setHasError(true);
        setIsRunning(false);

        // Record history entry
        setRunHistory((prev) => [
          {
            id: String(Date.now()),
            timestamp: new Date().toLocaleTimeString(),
            status: "TIMEOUT",
            output: timeoutMsg,
            durationMs: 3000,
          },
          ...prev.slice(0, 9),
        ]);
      }, 3000);

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        const elapsed = Math.round(performance.now() - startTime);
        setExecutionTime(elapsed);

        const { success, logs, error, testResults: evaluatedTests } = e.data;
        let out = "";
        if (success) {
          out = logs && logs.length > 0 ? logs.join("\n") : "Code executed successfully with no console output.";
          setOutput(out);
          setHasError(false);

          // Real test evaluation against provided bank test cases
          if (evaluatedTests && evaluatedTests.length > 0) {
            setTestResults(evaluatedTests);
            const passedCount = evaluatedTests.filter((r: any) => r.passed).length;
            onTestResultsChange?.({
              passed: passedCount,
              total: evaluatedTests.length,
              results: evaluatedTests,
            });
          }

          // Record run history (C4)
          setRunHistory((prev) => [
            {
              id: String(Date.now()),
              timestamp: new Date().toLocaleTimeString(),
              status: "SUCCESS",
              output: out.slice(0, 150),
              durationMs: elapsed,
            },
            ...prev.slice(0, 9),
          ]);
        } else {
          out = logs && logs.length > 0 ? `${logs.join("\n")}\nRuntime Error: ${error}` : `Runtime Error: ${error}`;
          setOutput(out);
          setHasError(true);

          setRunHistory((prev) => [
            {
              id: String(Date.now()),
              timestamp: new Date().toLocaleTimeString(),
              status: "ERROR",
              output: out.slice(0, 150),
              durationMs: elapsed,
            },
            ...prev.slice(0, 9),
          ]);
        }
        setIsRunning(false);
      };

      worker.onerror = (e) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        const elapsed = Math.round(performance.now() - startTime);
        setExecutionTime(elapsed);
        const errMsg = `Runtime Error: ${e.message || "Script execution failed."}`;
        setOutput(errMsg);
        setHasError(true);
        setIsRunning(false);
      };

      worker.postMessage({
        code: executableCode,
        testCases: sampleTestCases,
        candidateNames: candidateNames,
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setExecutionTime(elapsed);
      setOutput(`Runtime Error: ${err.message}`);
      setHasError(true);
      setIsRunning(false);
    }
  };

  const lineCount = Math.max(12, value.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="card border border-[var(--surface-border)] rounded-xl overflow-hidden flex flex-col bg-[#0f0f17]">
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] font-semibold">
            <Code2 size={16} />
            <span>Interactive Code Editor</span>
          </div>

          {onLanguageChange && (
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs border border-[var(--surface-border)] focus:outline-none focus:border-[var(--color-primary)]"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOutput(null);
              setExecutionTime(null);
            }}
            title="Clear Console Output"
            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] text-xs flex items-center gap-1"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning || !value.trim()}
            className="btn btn-primary btn-sm text-xs py-1 px-3 flex items-center gap-1.5 shadow"
          >
            {isRunning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} className="fill-current" />
            )}
            <span>{isRunning ? "Testing..." : "Run Tests"}</span>
          </button>
        </div>
      </div>

      {/* Code Textarea & Gutter with Synchronized Scrolling and Strict Alignment */}
      <div className="flex relative font-mono text-xs overflow-hidden min-h-[220px] max-h-[380px]">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          className="py-3 px-3 select-none text-right text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border-r border-[var(--surface-border)] shrink-0 min-w-[44px] overflow-hidden font-mono text-xs"
          aria-hidden="true"
        >
          {lineNumbers.map((num) => (
            <div key={num} className="leading-[20px] h-[20px]">
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <div className="relative flex-1 overflow-hidden">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={(e) => {
              if (gutterRef.current) {
                gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            wrap="off"
            spellCheck="false"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder={
              language === "python"
                ? "# Write your solution here...\ndef solution(nums, target):\n    # Your logic\n    return result"
                : "// Write your solution here...\nfunction twoSum(nums, target) {\n  // Your logic\n  return [0, 1];\n}"
            }
            className="w-full h-full py-3 px-3 bg-transparent text-[var(--text-primary)] leading-[20px] resize-none border-none outline-none font-mono text-xs whitespace-pre overflow-auto"
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* Bottom Tabs: Console, Sample Tests, Run History (C4) */}
      <div className="border-t border-[var(--surface-border)] bg-[var(--surface)] flex flex-col">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--surface-border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveBottomTab("console")}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.55rem",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeBottomTab === "console" ? "var(--bg-tertiary)" : "transparent",
                color: activeBottomTab === "console" ? "var(--text-primary)" : "var(--text-tertiary)",
                fontWeight: activeBottomTab === "console" ? 600 : 400,
              }}
            >
              Console Output
            </button>

            <button
              type="button"
              onClick={() => setActiveBottomTab("tests")}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.55rem",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeBottomTab === "tests" ? "var(--bg-tertiary)" : "transparent",
                color: activeBottomTab === "tests" ? "var(--text-primary)" : "var(--text-tertiary)",
                fontWeight: activeBottomTab === "tests" ? 600 : 400,
              }}
            >
              Sample Tests ({sampleTestCases.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveBottomTab("history")}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.55rem",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeBottomTab === "history" ? "var(--bg-tertiary)" : "transparent",
                color: activeBottomTab === "history" ? "var(--text-primary)" : "var(--text-tertiary)",
                fontWeight: activeBottomTab === "history" ? 600 : 400,
              }}
            >
              Run History ({runHistory.length})
            </button>
          </div>

          {executionTime !== null && (
            <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
              Elapsed: {executionTime}ms
            </span>
          )}
        </div>

        {/* Tab 1: Console Output */}
        {activeBottomTab === "console" && (
          <div className="p-3 bg-[var(--bg-primary)] font-mono text-xs min-h-[90px] max-h-[160px] overflow-y-auto">
            {output ? (
              <pre
                className={`whitespace-pre-wrap leading-relaxed ${
                  hasError ? "text-[var(--color-error)]" : "text-[var(--text-secondary)]"
                }`}
              >
                {output}
              </pre>
            ) : (
              <span className="text-[var(--text-tertiary)] italic">
                Click &apos;Run Tests&apos; to execute your solution against test cases.
              </span>
            )}
          </div>
        )}

        {/* Tab 2: Sample Test Cases */}
        {activeBottomTab === "tests" && (
          <div className="p-3 bg-[var(--bg-primary)] text-xs flex flex-col gap-2 min-h-[90px] max-h-[160px] overflow-y-auto font-mono">
            {sampleTestCases.map((tc, idx) => {
              const res = testResults[idx];
              return (
                <div
                  key={idx}
                  className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--surface-border)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-tertiary)]">Case {idx + 1}:</span>
                    <span>input: <code>{tc.input}</code></span>
                    <span className="text-[var(--text-tertiary)]">→</span>
                    <span>expected: <code>{tc.expectedOutput}</code></span>
                  </div>

                  {res && (
                    <div className="flex items-center gap-2">
                      {!res.passed && (
                        <span className="text-[10px] text-[var(--color-error)]">
                          got: <code>{res.actual}</code>
                        </span>
                      )}
                      <span
                        className={`badge text-[10px] ${
                          res.passed ? "badge-success" : "badge-error"
                        }`}
                      >
                        {res.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Run History (C4) */}
        {activeBottomTab === "history" && (
          <div className="p-3 bg-[var(--bg-primary)] text-xs flex flex-col gap-1.5 min-h-[90px] max-h-[160px] overflow-y-auto font-mono">
            {runHistory.length === 0 ? (
              <span className="text-[var(--text-tertiary)] italic">No execution runs recorded yet.</span>
            ) : (
              runHistory.map((run) => (
                <div
                  key={run.id}
                  className="p-1.5 rounded bg-[var(--bg-secondary)] flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        color:
                          run.status === "SUCCESS"
                            ? "var(--color-success)"
                            : "var(--color-error)",
                        fontWeight: 600,
                      }}
                    >
                      [{run.status}]
                    </span>
                    <span className="text-[var(--text-secondary)] truncate max-w-[260px]">{run.output}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <span>{run.durationMs}ms</span>
                    <span>{run.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
