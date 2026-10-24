import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const testsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const testFiles = fs.readdirSync(testsDir).filter(f => f.startsWith("test_") && f.endsWith(".lua"));

console.log(`Running ${testFiles.length} Lua test suites...\n`);

let passedCount = 0;
for (const file of testFiles) {
  const fullPath = path.join(testsDir, file);
  try {
    const out = execSync(`bun run "${path.join(testsDir, "run_lua.ts")}" "${fullPath}"`, { encoding: "utf-8" });
    console.log(`PASS: ${file}`);
    const resLine = out.split("\n").find(l => l.includes("Results:"));
    if (resLine) console.log(`   ${resLine.trim()}`);
    passedCount++;
  } catch (err: any) {
    console.error(`FAIL: ${file}`);
    console.error(err.stdout || err.message);
    process.exit(1);
  }
}

console.log(`\nALL ${passedCount} TEST SUITES PASSED!`);
