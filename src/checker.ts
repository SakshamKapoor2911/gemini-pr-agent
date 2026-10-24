import * as ts from 'typescript';

/**
 * Path 1: Strips comments and string literals so regex patterns
 * (division by zero, eval, exception swallowing) do not trigger false alarms
 * on benign comments, documentation, or string banners.
 */
export function stripCommentsAndStrings(code: string): string {
  return code.replace(
    /"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|`(?:\\.|[^`\\])*`|\/\/.*$|#.*$|\/\*[\s\S]*?\*\//gm,
    (match) => (match.startsWith('//') || match.startsWith('#') || match.startsWith('/*') ? ' ' : '""'),
  );
}

const SQL_VERB_REGEX = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b/i;

/**
 * Path 2: Syntax-Aware AST Security Scanner.
 * Inspects TypeScript AST for SQL injection in template expressions (${...})
 * and binary string concatenations with variables, while safely allowing
 * parameterized queries ($1, $2, ?).
 */
export function checkAstSecurity(code: string): { hasErrors: boolean; detectedIssues: string[] } {
  const detectedIssues: string[] = [];
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile('snippet.ts', code, ts.ScriptTarget.Latest, true);
  } catch {
    return { hasErrors: false, detectedIssues: [] };
  }

  function containsSql(text: string): boolean {
    return SQL_VERB_REGEX.test(text);
  }

  function visit(node: ts.Node) {
    // 1. Template expression containing SQL with interpolated variables
    if (ts.isTemplateExpression(node)) {
      const fullText = node.getText(sourceFile);
      if (containsSql(fullText) && node.templateSpans.length > 0) {
        detectedIssues.push(`Potential SQL injection via dynamic template interpolation: ${fullText.trim().slice(0, 80)}`);
      }
    }

    // 2. Binary concatenation with '+' operator mixing SQL string with non-literal
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const leftText = node.left.getText(sourceFile);
      const rightText = node.right.getText(sourceFile);
      if (
        (containsSql(leftText) && !ts.isStringLiteral(node.right) && !ts.isNoSubstitutionTemplateLiteral(node.right)) ||
        (containsSql(rightText) && !ts.isStringLiteral(node.left) && !ts.isNoSubstitutionTemplateLiteral(node.left))
      ) {
        detectedIssues.push('Potential SQL injection via string concatenation with dynamic variable.');
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { hasErrors: detectedIssues.length > 0, detectedIssues };
}

/**
 * Dual-Path Scanner: Combines Path 1 (comment-scrubbed pattern linting)
 * and Path 2 (AST syntax-aware security checks).
 */
export function checkSnippet(code: string): { hasErrors: boolean; detectedIssues: string[] } {
  // Path 1: Pattern checks on comment/string-scrubbed code
  const cleaned = stripCommentsAndStrings(code);
  const patternIssues: string[] = [];
  if (/\b(?:eval|exec)\s*\(/.test(cleaned)) patternIssues.push('Dynamic code evaluation requires review.');
  if (/(?:\/|%)\s*0(?:\b|$)(?!\.)/.test(cleaned)) patternIssues.push('Literal division/modulo by zero.');
  if (cleaned.includes('except:') || cleaned.includes('catch (e) {}')) patternIssues.push('Exception handling may hide errors.');

  // Path 2: AST security checks on original unscrubbed code
  const astResult = checkAstSecurity(code);

  const detectedIssues = [...patternIssues, ...astResult.detectedIssues];
  return { hasErrors: detectedIssues.length > 0, detectedIssues };
}

export const MAX_DIFF_BYTES = 24000;
export function validateDiff(diff: string): string {
  if (!diff.trim()) throw new Error('PR diff is empty.');
  if (Buffer.byteLength(diff, 'utf8') > MAX_DIFF_BYTES) throw new Error(`PR diff exceeds ${MAX_DIFF_BYTES} bytes. Use a smaller practice PR.`);
  return diff;
}
