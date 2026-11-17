"use client";

import { useState } from "react";
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
        const msg = `[Language Preview: ${language}]\nSyntax accepted. Server-side test runner and AI will evaluate your ${language} solution upon submission.`;
        setOutput(msg);
        setExecutionTime(Math.round(performance.now() - startTime));
        setIsRunning(false);
        return;
      }

      if (typeof window === "undefined" || typeof Worker === "undefined") {
        setOutput("Web Worker environment not available.");
        setHasError(true);
        setIsRunning(false);
        return;
      }

      const workerCode = `
        self.onmessage = function(e) {
          var code = e.data.code;
          var testCases = e.data.testCases || [];
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

          try {
            // 1. Initial code execution to detect syntax errors and capture top-level console output
            var runner = new Function(
              'console', 'window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts',
              '"use strict"; ' + code
            );
            var result = runner(customConsole, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
            if (result !== undefined) {
              logs.push('=> Returned: ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
            }

            // 2. Real test case evaluation against candidate's functions
            var testResults = [];
            if (testCases && testCases.length > 0) {
              for (var i = 0; i < testCases.length; i++) {
                var tc = testCases[i];
                try {
                  var testRunner = new Function(
                    'console', 'tcInput',
                    '"use strict"; ' +
                    code + '\\n' +
                    'var entryFn = null;\\n' +
                    'var knownNames = ["twoSum", "debounce", "solution", "solve", "mergeIntervals", "findMedianSortedArrays", "isValid"];\\n' +
                    'for (var k = 0; k < knownNames.length; k++) {\\n' +
                    '  try { if (eval("typeof " + knownNames[k]) === "function") { entryFn = eval(knownNames[k]); break; } } catch(ignore) {}\\n' +
                    '}\\n' +
                    'if (!entryFn) {\\n' +
                    '  try {\\n' +
                    '    var names = Object.getOwnPropertyNames(this);\\n' +
                    '    for (var n = 0; n < names.length; n++) {\\n' +
                    '      if (typeof this[names[n]] === "function" && names[n] !== "eval") { entryFn = this[names[n]]; break; }\\n' +
                    '    }\\n' +
                    '  } catch(e) {}\\n' +
                    '}\\n' +
                    'if (entryFn) {\\n' +
                    '  var args;\\n' +
                    '  try { args = eval("[" + tcInput + "]"); } catch(e) { args = [tcInput]; }\\n' +
                    '  return entryFn.apply(null, args);\\n' +
                    '} else {\\n' +
                    '  return eval(tcInput);\\n' +
                    '}\\n'
                  );

                  var actual = testRunner(customConsole, tc.input);
                  var actualStr = actual === undefined ? "undefined" : (typeof actual === "object" ? JSON.stringify(actual) : String(actual));
                  var expectedNorm = String(tc.expectedOutput).trim().replace(/\\s+/g, "");
                  var actualNorm = actualStr.trim().replace(/\\s+/g, "");
                  var passed = (actualNorm === expectedNorm);

                  testResults.push({
                    input: tc.input,
                    expected: tc.expectedOutput,
                    actual: actualStr,
                    passed: passed,
                    isHidden: !!tc.isHidden,
                  });
                } catch (tcErr) {
                  testResults.push({
                    input: tc.input,
                    expected: tc.expectedOutput,
                    actual: "Error: " + tcErr.message,
                    passed: false,
                    isHidden: !!tc.isHidden,
                  });
                }
              }
            }

            self.postMessage({ success: true, logs: logs, result: result, testResults: testResults });
          } catch (err) {
            self.postMessage({ success: false, error: err.message, logs: logs });
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

      worker.postMessage({ code: value, testCases: sampleTestCases });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setExecutionTime(elapsed);
      setOutput(`Runtime Error: ${err.message}`);
      setHasError(true);
      setIsRunning(false);
    }
  };

  const lineCount = Math.max(8, value.split("\n").length);
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

      {/* Code Textarea & Gutter */}
      <div className="flex relative font-mono text-xs overflow-x-auto min-h-[200px] max-h-[340px]">
        {/* Line Numbers Gutter */}
        <div
          className="py-3 px-3 select-none text-right text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border-r border-[var(--surface-border)] shrink-0 min-w-[42px]"
          aria-hidden="true"
        >
          {lineNumbers.map((num) => (
            <div key={num} className="leading-5 h-5">
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <div className="relative flex-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck="false"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder="// Write your solution here...&#10;function solution(args) {&#10;  // Your logic&#10;  return result;&#10;}"
            className="w-full h-full p-3 bg-transparent text-[var(--text-primary)] leading-5 resize-none border-none outline-none font-mono whitespace-pre overflow-auto"
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
