import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { join, resolve, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'genkit';

export const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export type TestReceipt = {
  runId: string;
  candidateHash: string;
  suiteHash: string;
  completed: boolean;
  exitCode: number | null;
  passed: number;
  failed: number;
  skipped: number;
  rawOutput: string;
};

export function computeVerificationBadge(
  runId: string,
  candidate: { filePath: string; code: string },
  suiteHash: string,
  expectedTests = 4,
  receipt?: TestReceipt,
): string {
  if (
    !receipt ||
    receipt.runId !== runId ||
    receipt.candidateHash !== fingerprint(candidate) ||
    receipt.suiteHash !== suiteHash
  ) {
    return 'UNVERIFIED';
  }
  if (!receipt.completed || receipt.exitCode === null) return 'INCOMPLETE';
  if (receipt.exitCode !== 0 || receipt.failed > 0) return `FAILED (${receipt.failed} failing tests)`;
  if (expectedTests <= 0 || receipt.passed !== expectedTests || receipt.skipped !== 0) return 'INCOMPLETE';
  return `Passed ${receipt.passed} workshop tests`;
}

function parseTapCounts(rawOutput: string) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const lines = rawOutput.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# pass ')) {
      const match = trimmed.match(/# pass\s+(\d+)/);
      if (match) passed = parseInt(match[1], 10);
    } else if (trimmed.startsWith('# fail ')) {
      const match = trimmed.match(/# fail\s+(\d+)/);
      if (match) failed = parseInt(match[1], 10);
    } else if (trimmed.startsWith('# skipped ')) {
      const match = trimmed.match(/# skipped\s+(\d+)/);
      if (match) skipped = parseInt(match[1], 10);
    }
  }

  return { passed, failed, skipped };
}

export interface VerificationOptions {
  filePath: string;
  proposedCode: string;
  testSuitePath?: string;
  expectedTests?: number;
  projectRoot?: string;
}

export interface VerificationExecutionResult {
  runId: string;
  receipt: TestReceipt;
  verifiedBadge: string;
  passed: number;
  failed: number;
  skipped: number;
}

export function executePatchVerification(options: VerificationOptions): VerificationExecutionResult {
  const root = options.projectRoot || resolve(__dirname, '..');
  const suiteRel = options.testSuitePath || 'src/repair.test.ts';
  const fullSuitePath = resolve(root, suiteRel);

  if (!existsSync(fullSuitePath)) {
    throw new Error(`Test suite not found at: ${fullSuitePath}`);
  }

  const suiteContent = readFileSync(fullSuitePath, 'utf8');
  const suiteHash = createHash('sha256').update(suiteContent).digest('hex');
  const runId = randomUUID();
  const candidate = { filePath: options.filePath, code: options.proposedCode };
  const candidateHash = fingerprint(candidate);

  const sandboxDir = mkdtempSync(join(tmpdir(), 'gemini-pr-sandbox-'));

  try {
    // Stage minimal isolated tree
    cpSync(join(root, 'src'), join(sandboxDir, 'src'), { recursive: true });
    if (existsSync(join(root, 'tsconfig.json'))) {
      cpSync(join(root, 'tsconfig.json'), join(sandboxDir, 'tsconfig.json'));
    }

    // Link node_modules via fast directory junction
    const projectNodeModules = join(root, 'node_modules');
    if (existsSync(projectNodeModules)) {
      symlinkSync(projectNodeModules, join(sandboxDir, 'node_modules'), 'junction');
    }

    // Apply proposed patch to candidate file
    const normTarget = normalize(options.filePath).replace(/\\/g, '/').replace(/^\.?\//, '');
    const targetFileInSandbox = resolve(sandboxDir, normTarget);
    writeFileSync(targetFileInSandbox, options.proposedCode, 'utf8');

    // Run isolated node test runner with 5000ms timeout
    const testProc = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '--test', suiteRel],
      {
        cwd: sandboxDir,
        env: {
          PATH: process.env.PATH,
          NODE_PATH: join(root, 'node_modules'),
        },
        encoding: 'utf8',
        timeout: 5000,
      },
    );

    const completed = !testProc.error;
    const exitCode = testProc.status;
    const rawOutput = (testProc.stdout || '') + (testProc.stderr || '');
    const { passed, failed, skipped } = parseTapCounts(rawOutput);

    const receipt: TestReceipt = {
      runId,
      candidateHash,
      suiteHash,
      completed,
      exitCode,
      passed,
      failed,
      skipped,
      rawOutput,
    };

    const expectedTests = options.expectedTests ?? 4;
    const verifiedBadge = computeVerificationBadge(runId, candidate, suiteHash, expectedTests, receipt);

    return {
      runId,
      receipt,
      verifiedBadge,
      passed,
      failed,
      skipped,
    };
  } finally {
    try {
      rmSync(sandboxDir, { recursive: true, force: true });
    } catch {
      // Ignore temporary cleanup failure on Windows locks
    }
  }
}

export function defineSandboxVerifierTool(
  ai: any,
  traceFn?: (tool: string, input: unknown, output: unknown) => void,
) {
  return ai.defineTool(
    {
      name: 'verifyProposedPatch',
      description:
        'Applies a proposed candidate patch to an isolated sandbox fixture in a temporary directory, runs the real unit test suite (node --test src/repair.test.ts), and derives an empirical, cryptographically bound test receipt.',
      inputSchema: z.object({
        filePath: z.string().describe('Relative path of file to patch (e.g. src/grades.ts)'),
        proposedCode: z.string().describe('The complete proposed replacement source code for the file'),
        testSuitePath: z.string().optional().describe('Optional test suite to run (defaults to src/repair.test.ts)'),
      }),
      outputSchema: z.object({
        runId: z.string(),
        verifiedBadge: z.string(),
        passed: z.number(),
        failed: z.number(),
        skipped: z.number(),
        receipt: z.object({
          runId: z.string(),
          candidateHash: z.string(),
          suiteHash: z.string(),
          completed: z.boolean(),
          exitCode: z.number().nullable(),
          passed: z.number(),
          failed: z.number(),
          skipped: z.number(),
          rawOutput: z.string(),
        }),
      }),
    },
    async (input: { filePath: string; proposedCode: string; testSuitePath?: string }) => {
      const result = executePatchVerification(input);
      if (traceFn) traceFn('verifyProposedPatch', input, result);
      return result;
    },
  );
}
