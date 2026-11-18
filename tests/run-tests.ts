import { runScoringTests } from "./scoring.test";
import { runFollowUpTests } from "./follow-up.test";
import { runInvitationClaimTests } from "./invitation-claim.test";
import { runCodeExecutionTests } from "./code-execution.test";
import { runCodeRunnerTests } from "./code-runner.test";

async function main() {
  console.log("=========================================");
  console.log("  AI Interviewer Test Suite Execution");
  console.log("=========================================\n");

  const start = Date.now();
  try {
    await runScoringTests();
    console.log();
    await runFollowUpTests();
    console.log();
    await runInvitationClaimTests();
    console.log();
    await runCodeExecutionTests();
    console.log();
    await runCodeRunnerTests();
    console.log();

    const elapsed = Date.now() - start;
    console.log("=========================================");
    console.log(`✅ ALL TEST SUITES PASSED (${elapsed}ms)`);
    console.log("=========================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:", error);
    process.exit(1);
  }
}

main();

