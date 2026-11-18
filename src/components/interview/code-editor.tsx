"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
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
  Server,
} from "lucide-react";

// Dynamic import of Monaco Editor with SSR disabled
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-xs text-[var(--text-tertiary)] gap-2">
      <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />
      <span>Loading Code Editor...</span>
    </div>
  ),
});

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
  isAssessment?: boolean;
  blockPaste?: boolean;
}

const STARTER_CODE_TEMPLATES: Record<string, string> = {
  javascript: `function solution(input) {
  // Write your JavaScript solution here
  return input;
}`,
  typescript: `function solution(input: any): any {
  // Write your TypeScript solution here
  return input;
}`,
  python: `def solution(input):
    # Write your Python solution here
    return input`,
  java: `public class Solution {
    public static Object solution(Object input) {
        // Write your Java solution here
        return input;
    }
}`,
  cpp: `#include <iostream>
using namespace std;

int solution(int input) {
    // Write your C++ solution here
    return input;
}`,
};

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
  isAssessment = false,
  blockPaste = false,
}: CodeEditorProps) {
  const [output, setOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);

  const [activeBottomTab, setActiveBottomTab] = useState<"console" | "tests" | "history">("console");
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [testResults, setTestResults] = useState<
    Array<{ input: string; expected: string; actual: string; passed: boolean; isHidden?: boolean }>
  >([]);

  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Enforce paste blocking if required by proctoring policy
    if (blockPaste) {
      editor.onKeyDown((e: any) => {
        // Ctrl+V (key code 86) or Cmd+V
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 86) {
          e.preventDefault();
          e.stopPropagation();
          setOutput("[PROCTORING POLICY] Pasting code is restricted in assessment mode. Please type your solution.");
          setHasError(true);
        }
      });
    }
  };

  const handleLanguageSwitch = (newLang: string) => {
    onLanguageChange?.(newLang);
    if (!value.trim() && STARTER_CODE_TEMPLATES[newLang]) {
      onChange(STARTER_CODE_TEMPLATES[newLang]);
    }
  };

  const handleResetStarter = () => {
    const template = STARTER_CODE_TEMPLATES[language] || STARTER_CODE_TEMPLATES.javascript;
    onChange(template);
    setOutput("Editor reset to starter template.");
    setHasError(false);
  };

  // Safe Sandboxed In-Browser Execution via Web Worker
  const handleRunSamples = async () => {
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

      let executableCode = value;
      if (language === "typescript") {
        executableCode = executableCode
          .replace(/(?:interface|type)\s+[A-Za-z0-9_$]+(?:\s*<[^>]+>)?\s*(?:=\s*[^;]+;|{[^}]*})/g, "")
          .replace(/:\s*[A-Za-z0-9_$]+(?:\[\])?(?=[,\)])/g, "")
          .replace(/\):\s*[A-Za-z0-9_$]+(?:\[\])?\s*\{/g, ") {");
      }

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

          function strictEqual(a, b) {
            if (a === b) return true;
            if (typeof a !== typeof b) return false;
            if (a === null || b === null || a === undefined || b === undefined) return a === b;
            if (typeof a === "number") {
              if (isNaN(a) && isNaN(b)) return true;
              return a === b;
            }
            if (typeof a !== "object") return a === b;

            var aIsArr = Array.isArray(a);
            var bIsArr = Array.isArray(b);
            if (aIsArr !== bIsArr) return false;
            if (aIsArr && bIsArr) {
              if (a.length !== b.length) return false;
              for (var i = 0; i < a.length; i++) {
                if (!strictEqual(a[i], b[i])) return false;
              }
              return true;
            }

            var aKeys = Object.keys(a).sort();
            var bKeys = Object.keys(b).sort();
            if (aKeys.length !== bKeys.length) return false;
            for (var k = 0; k < aKeys.length; k++) {
              if (aKeys[k] !== bKeys[k]) return false;
              if (!strictEqual(a[aKeys[k]], b[bKeys[k]])) return false;
            }
            return true;
          }

          function deepEqual(actual, expected) {
            var parsedExpected = expected;
            if (typeof expected === "string") {
              var trm = expected.trim();
              if (
                (trm.startsWith("[") && trm.endsWith("]")) ||
                (trm.startsWith("{") && trm.endsWith("}")) ||
                trm === "true" || trm === "false" || trm === "null" ||
                (!isNaN(Number(trm)) && trm !== "")
              ) {
                try {
                  parsedExpected = JSON.parse(trm);
                } catch(e) {
                  parsedExpected = expected;
                }
              }
            }
            return strictEqual(actual, parsedExpected);
          }

          try {
            var runner = new Function('console',
              '"use strict";\\n' +
              code + '\\n;\\n' +
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
                    if (!Array.isArray(args)) args = [args];

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
          } catch(err) {
            self.postMessage({
              success: false,
              logs: logs,
              error: err.message
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
        setExecutionTime(2000);
        setOutput("Execution timed out after 2000ms. Check for infinite loops or heavy operations.");
        setHasError(true);
        setIsRunning(false);
      }, 2000);

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

          if (evaluatedTests && evaluatedTests.length > 0) {
            setTestResults(evaluatedTests);
            const passedCount = evaluatedTests.filter((r: any) => r.passed).length;
            onTestResultsChange?.({
              passed: passedCount,
              total: evaluatedTests.length,
              results: evaluatedTests,
            });
          }

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
        setOutput(`Runtime Error: ${e.message || "Script execution failed."}`);
        setHasError(true);
        setIsRunning(false);
      };

      worker.postMessage({
        code: executableCode,
        testCases: sampleTestCases.filter((tc) => !tc.isHidden),
        candidateNames,
      });
    } catch (err: any) {
      setOutput(`Failed to run script: ${err.message}`);
      setHasError(true);
      setIsRunning(false);
    }
  };

  const publicTestCases = sampleTestCases.filter((tc) => !tc.isHidden);
  const passedTestsCount = testResults.filter((r) => r.passed).length;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border border-[var(--surface-border)] rounded-xl overflow-hidden shadow-sm">
      {/* ─── Top Toolbar ─── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#333333] select-none text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#cccccc] font-medium">
            <Code2 size={14} className="text-[var(--color-primary)]" />
            <span>Monaco Workspace</span>
          </div>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageSwitch(e.target.value)}
            className="bg-[#1e1e1e] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#444444] focus:outline-none focus:border-[var(--color-primary)]"
            aria-label="Programming Language"
          >
            <option value="javascript">JavaScript (Node.js)</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python 3</option>
            <option value="java">Java 17</option>
            <option value="cpp">C++ (GCC)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetStarter}
            className="flex items-center gap-1 text-[#888888] hover:text-[#cccccc] transition-colors px-2 py-1 rounded hover:bg-[#333333]"
            title="Reset code to starter template"
            aria-label="Reset code to starter template"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>

          <button
            onClick={handleRunSamples}
            disabled={isRunning}
            className="btn btn-primary btn-sm text-xs py-1 px-3 flex items-center gap-1.5"
            title="Execute code in client Web Worker against public sample test cases"
            aria-label="Execute code in Web Worker"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span>Run Samples</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Monaco Editor Container ─── */}
      <div className="flex-1 min-h-[300px] relative">
        <MonacoEditor
          height="100%"
          language={language === "cpp" ? "cpp" : language}
          value={value}
          theme="vs-dark"
          onChange={(newVal) => onChange(newVal || "")}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            tabSize: 2,
            automaticLayout: true,
            // Turn off autocomplete and suggestions in assessment mode
            quickSuggestions: !isAssessment,
            suggestOnTriggerCharacters: !isAssessment,
            snippetSuggestions: isAssessment ? "none" : "inline",
            wordBasedSuggestions: isAssessment ? "off" : "matchingDocuments",
            contextmenu: !blockPaste,
          }}
        />
      </div>

      {/* ─── Bottom Panel: Console / Tests / History ─── */}
      <div className="border-t border-[#333333] bg-[#252526] flex flex-col h-44">
        <div className="flex items-center justify-between px-3 border-b border-[#333333] bg-[#1f1f1f]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveBottomTab("console")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                activeBottomTab === "console"
                  ? "border-[var(--color-primary)] text-white"
                  : "border-transparent text-[#888888] hover:text-[#cccccc]"
              }`}
            >
              <Terminal size={12} />
              <span>Console Output</span>
            </button>

            <button
              onClick={() => setActiveBottomTab("tests")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                activeBottomTab === "tests"
                  ? "border-[var(--color-primary)] text-white"
                  : "border-transparent text-[#888888] hover:text-[#cccccc]"
              }`}
            >
              <Layers size={12} />
              <span>Test Cases</span>
              {testResults.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    passedTestsCount === testResults.length ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-900/60 text-amber-300"
                  }`}
                >
                  {passedTestsCount}/{testResults.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveBottomTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                activeBottomTab === "history"
                  ? "border-[var(--color-primary)] text-white"
                  : "border-transparent text-[#888888] hover:text-[#cccccc]"
              }`}
            >
              <History size={12} />
              <span>Run History</span>
            </button>
          </div>

          {executionTime !== null && (
            <div className="text-[11px] text-[#888888]">Execution: {executionTime}ms</div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-3 overflow-y-auto font-mono text-xs">
          {activeBottomTab === "console" && (
            <div>
              {output === null ? (
                <div className="text-[#666666] italic">Click &quot;Run Samples&quot; to execute your solution in the isolated sandbox.</div>
              ) : (
                <pre
                  className={`whitespace-pre-wrap ${
                    hasError ? "text-[#f87171]" : "text-[#4ade80]"
                  }`}
                >
                  {output}
                </pre>
              )}
            </div>
          )}

          {activeBottomTab === "tests" && (
            <div className="flex flex-col gap-2">
              {publicTestCases.length === 0 ? (
                <div className="bg-[#1e1e1e] p-4 rounded border border-[#333333] text-center text-[#888888] italic text-xs">
                  No automated unit tests configured for this question. Your code and solution architecture will be evaluated by the interviewer.
                </div>
              ) : testResults.length === 0 ? (
                <div className="text-[#888888]">
                  <p className="mb-2">Sample Test Cases configured for this problem:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {publicTestCases.map((tc, idx) => (
                      <div key={idx} className="bg-[#1e1e1e] p-2 rounded border border-[#333333] text-[11px]">
                        <span className="text-[#888888]">Case {idx + 1}: </span>
                        <code>input: {tc.input}</code> → <code>expected: {tc.expectedOutput}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {testResults.map((tr, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border flex items-center justify-between text-[11px] ${
                        tr.passed
                          ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                          : "bg-rose-950/20 border-rose-800/40 text-rose-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {tr.passed ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-rose-400" />}
                        <span>Case {idx + 1}</span>
                        <code className="text-[#aaaaaa]">({tr.input})</code>
                      </div>
                      <div className="text-[10px]">
                        Expected: <code>{tr.expected}</code> | Actual: <code>{tr.actual}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeBottomTab === "history" && (
            <div>
              {runHistory.length === 0 ? (
                <div className="text-[#666666] italic">No local runs recorded yet in this session.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {runHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-1.5 rounded bg-[#1e1e1e] border border-[#333333] text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                            h.status === "SUCCESS"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : "bg-rose-900/60 text-rose-300"
                          }`}
                        >
                          {h.status}
                        </span>
                        <span className="text-[#888888]">{h.timestamp}</span>
                        <span className="text-[#cccccc] truncate max-w-[200px]">{h.output}</span>
                      </div>
                      <span className="text-[#666666] text-[10px]">{h.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
