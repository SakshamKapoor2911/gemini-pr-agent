import { StructuredReview, ReviewFinding, LinePatch } from './github-review';
import { TestReceipt } from './sandbox-verifier';

export interface CriticAuditContext {
  scannerIssues: string[];
  testReceipt?: TestReceipt;
  verifiedBadge?: string;
  untrustedInstructionDetected?: boolean;
}

/**
 * Reconciles model review output with deterministic tool receipts.
 * Strictly prevents model sycophancy or self-declared verification claims.
 */
export function reconcileReviewWithEvidence(
  rawReview: StructuredReview,
  context: CriticAuditContext,
): StructuredReview {
  const reconciled: StructuredReview = {
    ...rawReview,
    findings: [...rawReview.findings],
    patches: rawReview.patches.map((p) => ({ ...p })),
  };

  // 1. Incorporate deterministic scanner findings if model missed them
  for (const issue of context.scannerIssues) {
    const alreadyPresent = reconciled.findings.some((f) =>
      f.message.toLowerCase().includes(issue.toLowerCase()) ||
      issue.toLowerCase().includes(f.message.toLowerCase())
    );
    if (!alreadyPresent) {
      const isSql = /sql\s*injection/i.test(issue);
      const isDivZero = /division.*zero/i.test(issue);
      reconciled.findings.push({
        severity: isSql || isDivZero ? 'BLOCKING' : 'WARNING',
        message: issue,
      });
    }
  }

  // 2. Attach empirical harness verification badge
  if (context.verifiedBadge) {
    reconciled.verificationBadge = context.verifiedBadge;
    for (const patch of reconciled.patches) {
      patch.verifiedBadge = context.verifiedBadge;
    }
  } else {
    // Zero-trust: Strip any model-written claims of passing tests
    reconciled.verificationBadge = 'UNVERIFIED (No sandbox test run)';
    for (const patch of reconciled.patches) {
      delete patch.verifiedBadge;
    }
  }

  // 3. Prompt injection detection: if author diff attempted prompt injection, flag it
  if (context.untrustedInstructionDetected) {
    reconciled.findings.unshift({
      ruleId: 'SEC-PROMPT-INJECTION',
      severity: 'BLOCKING',
      message: 'Diff contains adversarial prompt injection attempt in comments. Evaluated as untrusted data.',
    });
  }

  // 4. Invariant Verdict Enforcement:
  const hasBlockingFindings = reconciled.findings.some((f) => f.severity === 'BLOCKING');
  const testFailed = context.testReceipt && (context.testReceipt.exitCode !== 0 || context.testReceipt.failed > 0);

  if (hasBlockingFindings || testFailed) {
    reconciled.verdict = 'REQUEST_CHANGES';
  } else if (reconciled.findings.length === 0) {
    reconciled.verdict = 'APPROVE';
  } else if (!reconciled.verdict) {
    reconciled.verdict = 'COMMENT';
  }

  return reconciled;
}
