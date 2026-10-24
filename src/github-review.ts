export interface LinePatch {
  filePath: string;
  startLine: number;
  endLine?: number;
  explanation: string;
  suggestedCode: string;
  verifiedBadge?: string;
}

export interface ReviewFinding {
  ruleId?: string;
  severity: 'BLOCKING' | 'WARNING' | 'ADVISORY';
  message: string;
  filePath?: string;
  lineNumber?: number;
}

export interface StructuredReview {
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  executiveSummary: string;
  findings: ReviewFinding[];
  patches: LinePatch[];
  verificationBadge?: string;
}

/**
 * Formats a code replacement as an authentic GitHub Markdown suggestion block
 * anchored to diff lines for pulls.createReview.
 */
export function formatGitHubSuggestion(patch: LinePatch): string {
  const lines = [
    `### Suggested change for \`${patch.filePath}\`${patch.startLine ? ` (line ${patch.startLine})` : ''}`,
    '',
    patch.explanation,
    '',
  ];

  if (patch.verifiedBadge) {
    lines.push(`> 🔒 **Harness Verification Badge:** \`${patch.verifiedBadge}\``, '');
  }

  lines.push('```suggestion', patch.suggestedCode.trimEnd(), '```');

  return lines.join('\n');
}

/**
 * Formats the complete agent review into GitHub Action PR comment markdown.
 */
export function formatGitHubReviewMarkdown(review: StructuredReview, modelId = 'gemini-3.5-flash'): string {
  const badgeHeader = review.verificationBadge
    ? `**Verification Status:** \`${review.verificationBadge}\``
    : `**Verification Status:** \`UNVERIFIED (Advisory review)\``;

  const sections: string[] = [
    '## 🤖 BigTh!nkAI Agentic Code Review',
    `*Evaluated with \`${modelId}\` · Zero-Trust Execution Harness*`,
    '',
    `**Verdict:** \`${review.verdict}\``,
    badgeHeader,
    '',
    '### Executive Summary',
    review.executiveSummary,
  ];

  if (review.findings.length > 0) {
    sections.push('', '### Detected Issues & Policy Violations');
    for (const finding of review.findings) {
      const icon = finding.severity === 'BLOCKING' ? '🔴' : finding.severity === 'WARNING' ? '🟡' : 'ℹ️';
      const loc = finding.filePath ? ` (\`${finding.filePath}${finding.lineNumber ? `:${finding.lineNumber}` : ''}\`)` : '';
      sections.push(`- ${icon} **[${finding.severity}]** ${finding.message}${loc}`);
    }
  }

  if (review.patches.length > 0) {
    sections.push('', '### Proposed Code Patches');
    for (const patch of review.patches) {
      sections.push('', formatGitHubSuggestion(patch));
    }
  }

  sections.push(
    '',
    '---',
    '*Note: This review was produced by an automated agent. All verdicts are advisory; merge decisions require human review and green CI checks.*',
  );

  return sections.join('\n');
}
