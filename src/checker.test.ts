import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSnippet, validateDiff, MAX_DIFF_BYTES, stripCommentsAndStrings, checkAstSecurity } from './checker';
import { computeAverageGrade } from './grades';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

test('flags literal zero but allows positive and decimal divisors', () => {
  assert.equal(checkSnippet('answer = 1 / 0').hasErrors, true);
  assert.equal(checkSnippet('answer = 1 % 0').hasErrors, true);
  for (const code of ['answer = 1 / 2', 'answer = 1 / 0.5', 'answer = 1 / 01', 'answer = 1 + 1']) {
    assert.equal(checkSnippet(code).hasErrors, false);
  }
});

test('flags dynamic evaluation and bare exception patterns', () => {
  assert.equal(checkSnippet('eval(user_input)').hasErrors, true);
  assert.equal(checkSnippet('except:').hasErrors, true);
});

test('ignores eval and division patterns inside comments and string literals', () => {
  assert.equal(checkSnippet('const label = "Policy check: eval( is forbidden";').hasErrors, false);
  assert.equal(checkSnippet('// Note: avoid eval(rawInput) and never divide by / 0').hasErrors, false);
  assert.equal(checkSnippet("# don't call eval(x)").hasErrors, false);
  assert.equal(checkSnippet('/* eval(forbidden) and / 0 */').hasErrors, false);
  assert.equal(checkSnippet('const url = "https://example.com"; eval(userInput);').hasErrors, true);
});

test('AST scanner catches SQL injection in template literals and concatenations', () => {
  const sqliTemplate = 'const query = `SELECT * FROM users WHERE email = \'${userEmail}\'`;';
  const sqliResult = checkSnippet(sqliTemplate);
  assert.equal(sqliResult.hasErrors, true);
  assert.match(sqliResult.detectedIssues[0], /SQL injection/i);

  const sqliConcat = "const query = 'SELECT * FROM users WHERE email = ' + userEmail;";
  const concatResult = checkSnippet(sqliConcat);
  assert.equal(concatResult.hasErrors, true);
  assert.match(concatResult.detectedIssues[0], /SQL injection/i);
});

test('AST scanner allows safe parameterized SQL queries and non-SQL templates', () => {
  const safeParamQuery = 'const query = `SELECT * FROM users WHERE email = $1`;';
  assert.equal(checkSnippet(safeParamQuery).hasErrors, false);

  const safeQuestionMark = "const query = 'SELECT * FROM users WHERE email = ?';";
  assert.equal(checkSnippet(safeQuestionMark).hasErrors, false);

  const nonSqlTemplate = 'const greeting = `Hello, ${userName}!`;';
  assert.equal(checkSnippet(nonSqlTemplate).hasErrors, false);
});

test('demonstrates baseline behavior before student exercise', () => {
  assert.equal(checkSnippet('return total / totalStudents').hasErrors, false);
  assert.equal(computeAverageGrade([90, 80], 2), 85);
});

test('rejects empty and oversized input by UTF-8 byte count', () => {
  assert.throws(() => validateDiff(' '), /empty/);
  assert.throws(() => validateDiff('x'.repeat(MAX_DIFF_BYTES + 1)), /exceeds/);
  assert.throws(() => validateDiff('é'.repeat(MAX_DIFF_BYTES)), /exceeds/);
  assert.equal(validateDiff('+answer = 1 + 1'), '+answer = 1 + 1');
});

test('CLI fails clearly without credentials and makes no API request', () => {
  const result = spawnSync(process.execPath, [join(__dirname, 'agent.js')], {
    env: { ...process.env, GEMINI_API_KEY: '' }, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set GEMINI_API_KEY/);
});
