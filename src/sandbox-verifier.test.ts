import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executePatchVerification, computeVerificationBadge, fingerprint, TestReceipt } from './sandbox-verifier';

test('sandbox verifier executes passing patch and computes verified badge', () => {
  const passingGradesCode = `
export function computeAverageGrade(scores: number[], totalStudents: number): number {
  if (totalStudents <= 0 || scores.length === 0) {
    return 0;
  }
  const total = scores.reduce((sum, score) => sum + score, 0);
  return total / totalStudents;
}
`;

  const result = executePatchVerification({
    filePath: 'src/grades.ts',
    proposedCode: passingGradesCode,
    testSuitePath: 'src/repair.test.ts',
    expectedTests: 4,
  });

  assert.equal(result.passed, 4);
  assert.equal(result.failed, 0);
  assert.equal(result.verifiedBadge, 'Passed 4 workshop tests');
  assert.equal(result.receipt.completed, true);
  assert.equal(result.receipt.exitCode, 0);
});

test('sandbox verifier detects failing patch and derives failure badge', () => {
  // Hardcoded zero cheat fails the normal-path test (85 === 85)
  const failingCheatCode = `
export function computeAverageGrade(scores: number[], totalStudents: number): number {
  return 0;
}
`;

  const result = executePatchVerification({
    filePath: 'src/grades.ts',
    proposedCode: failingCheatCode,
    testSuitePath: 'src/repair.test.ts',
    expectedTests: 4,
  });

  assert.equal(result.failed, 1);
  assert.equal(result.passed, 3);
  assert.equal(result.verifiedBadge, 'FAILED (1 failing tests)');
  assert.notEqual(result.receipt.exitCode, 0);
});

test('computeVerificationBadge rejects tampered or mismatched hashes', () => {
  const candidate = { filePath: 'src/grades.ts', code: 'return 0;' };
  const mockReceipt: TestReceipt = {
    runId: 'run-123',
    candidateHash: fingerprint(candidate),
    suiteHash: 'hash-abc',
    completed: true,
    exitCode: 0,
    passed: 4,
    failed: 0,
    skipped: 0,
    rawOutput: 'ok',
  };

  // Valid receipt
  assert.equal(computeVerificationBadge('run-123', candidate, 'hash-abc', 4, mockReceipt), 'Passed 4 workshop tests');

  // Mismatched runId
  assert.equal(computeVerificationBadge('run-999', candidate, 'hash-abc', 4, mockReceipt), 'UNVERIFIED');

  // Mismatched candidate code
  const alteredCandidate = { filePath: 'src/grades.ts', code: 'return 42;' };
  assert.equal(computeVerificationBadge('run-123', alteredCandidate, 'hash-abc', 4, mockReceipt), 'UNVERIFIED');

  // Mismatched suite hash
  assert.equal(computeVerificationBadge('run-123', candidate, 'hash-xyz', 4, mockReceipt), 'UNVERIFIED');
});
