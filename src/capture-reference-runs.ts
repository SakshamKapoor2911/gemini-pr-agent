import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stage3SelfVerifyingFlow } from './agent';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e.message || '';
      const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      const isUnavailable = msg.includes('503') || msg.includes('UNAVAILABLE');

      if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
        let delayMs = 26000;
        const retryMatch = msg.match(/retry in ([0-9.]+)s/i);
        if (retryMatch) {
          delayMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
        }
        console.log(`  [Retry ${attempt}/${maxRetries}] Hit ${isRateLimit ? '429 Rate Limit' : '503 Spike'}. Waiting ${Math.round(delayMs / 1000)}s before retry...`);
        await sleep(delayMs);
      } else {
        throw e;
      }
    }
  }
}

async function capture() {
  const root = join(__dirname, '..');
  const refDir = join(root, 'reference-runs');
  if (!existsSync(refDir)) mkdirSync(refDir, { recursive: true });

  const cases = [
    {
      id: 'case-01',
      file: 'cases/01-buggy-grades.diff',
      title: 'Fix(grades): handle empty scores array with fallback',
      author: 'contributor-dev',
      scenario: 'Buggy grades: 0 / 0 introduced, totalStudents unguarded',
    },
    {
      id: 'case-02',
      file: 'cases/02-clean-grades.diff',
      title: 'Fix(grades): guard against empty scores and non-positive totalStudents',
      author: 'senior-engineer',
      scenario: 'Clean grades: fully guarded zero and empty checks',
    },
    {
      id: 'case-03',
      file: 'cases/03-false-positive-comment.diff',
      title: 'Docs(grades): add policy documentation comment to banner helper',
      author: 'documentation-lead',
      scenario: 'False positive test: policy comment with eval( and / 0 mentions',
    },
    {
      id: 'case-04',
      file: 'cases/04-trojan-sqli-injection.diff',
      title: 'Feat(auth): add user lookup helper with custom permissions',
      author: 'suspicious-actor',
      scenario: 'Trojan PR: dynamic SQL template interpolation + prompt injection comment',
    },
  ];

  console.log('=== Capturing Reference Traces for Workshop Presentation Resilience ===');
  console.log('Using rate-limit-aware runner with 5 RPM pacing (15s delay between cases).\n');

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`[${i + 1}/4] Executing ${c.id.toUpperCase()}: ${c.scenario}...`);
    const diffPath = join(root, c.file);
    const diffContent = readFileSync(diffPath, 'utf8');

    // Clear trace before run
    writeFileSync(join(root, 'tool-trace.jsonl'), '');

    const startTime = Date.now();
    try {
      const review = await runWithRetry(async () => {
        return stage3SelfVerifyingFlow({
          diffContent,
          prTitle: c.title,
          prAuthor: c.author,
        });
      });

      const durationMs = Date.now() - startTime;
      const rawTrace = existsSync(join(root, 'tool-trace.jsonl'))
        ? readFileSync(join(root, 'tool-trace.jsonl'), 'utf8')
        : '';
      const toolCalls = rawTrace
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const record = {
        caseId: c.id,
        scenario: c.scenario,
        model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
        prTitle: c.title,
        prAuthor: c.author,
        durationMs,
        capturedAt: new Date().toISOString(),
        review,
        toolCalls,
      };

      const outPath = join(refDir, `${c.id}.json`);
      writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf8');
      console.log(`  -> SUCCESS (${durationMs}ms): Verdict = ${review.verdict}, Badge = ${review.verificationBadge || 'N/A'}`);
    } catch (e: any) {
      console.error(`  -> FAILED on ${c.id}:`, e.message);
    }

    if (i < cases.length - 1) {
      console.log('  Waiting 15s to respect 5 RPM Free Tier quota...');
      await sleep(15000);
    }
  }

  console.log('\nAll reference runs captured into reference-runs/ successfully.');
}

capture().catch((e) => {
  console.error('Capture runner failed:', e);
  process.exit(1);
});
