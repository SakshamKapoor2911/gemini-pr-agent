import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkSnippet } from './checker';

const caseFiles = [
  'cases/01-buggy-grades.diff',
  'cases/02-clean-grades.diff',
  'cases/03-false-positive-comment.diff',
  'cases/04-trojan-sqli-injection.diff',
];

const isReplayMode = process.argv.includes('--replay');

if (isReplayMode) {
  console.log('=== OFFLINE DETERMINISTIC REPLAY MODE ===');
  console.log('Replaying authentic recorded reference traces from reference-runs/.\n');

  for (let i = 1; i <= 4; i++) {
    const caseId = `case-0${i}`;
    const tracePath = join(__dirname, '..', 'reference-runs', `${caseId}.json`);
    if (existsSync(tracePath)) {
      const traceData = JSON.parse(readFileSync(tracePath, 'utf8'));
      console.log(`\n--- [REPLAY] ${caseId.toUpperCase()}: ${traceData.scenario} ---`);
      console.log(`Model: ${traceData.model || 'gemini-3.5-flash'} | Latency: ${traceData.durationMs || 1200}ms`);
      console.log(`Verdict: ${traceData.review?.verdict}`);
      console.log(`Verification Badge: ${traceData.review?.verificationBadge || 'N/A'}`);
      console.log(`Findings: ${traceData.review?.findings?.length || 0} detected`);
      for (const f of traceData.review?.findings || []) {
        console.log(`  - [${f.severity}] ${f.message}`);
      }
    } else {
      console.log(`[REPLAY] ${caseId}: Reference trace not found at ${tracePath}`);
    }
  }
} else {
  console.log('=== OFFLINE DUAL-PATH SCANNER DEMO ===');
  console.log('Deterministic local analysis (no network/API required).\n');

  for (const relPath of caseFiles) {
    const fullPath = join(__dirname, '..', relPath);
    if (!existsSync(fullPath)) {
      console.log(JSON.stringify({ caseFile: relPath, status: 'NOT_FOUND' }));
      continue;
    }
    const diff = readFileSync(fullPath, 'utf8');
    const result = checkSnippet(diff);
    console.log(
      JSON.stringify(
        {
          caseFile: relPath,
          hasErrors: result.hasErrors,
          detectedIssues: result.detectedIssues,
        },
        null,
        2,
      ),
    );
  }
}
