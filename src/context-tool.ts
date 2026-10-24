import { existsSync, readFileSync } from 'node:fs';
import { resolve, normalize, join, relative } from 'node:path';
import { z } from 'genkit';

export const ALLOWED_CONTEXT_FILES = [
  'src/grades.ts',
  'sample-bugs/02_security_injection.ts',
  'REPO_POLICY.md',
  'package.json',
];

export interface ContextResult {
  filePath: string;
  content: string;
  status: 'SUCCESS' | 'FORBIDDEN' | 'NOT_FOUND';
  error?: string;
}

export function fetchRepoContext(requestedPath: string, projectRoot?: string): ContextResult {
  const root = projectRoot || resolve(__dirname, '..');
  const normalizedRequested = normalize(requestedPath).replace(/\\/g, '/').replace(/^\.?\//, '');

  const isAllowed = ALLOWED_CONTEXT_FILES.some((allowed) => {
    const normAllowed = normalize(allowed).replace(/\\/g, '/');
    return normalizedRequested === normAllowed || normalizedRequested.endsWith(normAllowed);
  });

  if (!isAllowed) {
    return {
      filePath: requestedPath,
      content: '',
      status: 'FORBIDDEN',
      error: `Access denied. Model may only inspect bounded files in repository whitelist: ${ALLOWED_CONTEXT_FILES.join(', ')}`,
    };
  }

  // Resolve absolute path and ensure it remains inside root
  const absolutePath = resolve(root, normalizedRequested);
  const rel = relative(root, absolutePath);
  if (rel.startsWith('..') || resolve(absolutePath) !== absolutePath) {
    return {
      filePath: requestedPath,
      content: '',
      status: 'FORBIDDEN',
      error: 'Directory traversal detected.',
    };
  }

  if (!existsSync(absolutePath)) {
    return {
      filePath: requestedPath,
      content: '',
      status: 'NOT_FOUND',
      error: `File not found in repository: ${requestedPath}`,
    };
  }

  const content = readFileSync(absolutePath, 'utf8');
  return {
    filePath: requestedPath,
    content,
    status: 'SUCCESS',
  };
}

export function defineContextTool(ai: any, traceFn?: (tool: string, input: unknown, output: unknown) => void) {
  return ai.defineTool(
    {
      name: 'readRepoContext',
      description: 'Reads bounded file contents from the repository whitelist (e.g. src/grades.ts, REPO_POLICY.md, sample-bugs/02_security_injection.ts) to inspect callers, function signatures, and coding policies.',
      inputSchema: z.object({
        filePath: z.string().describe('Relative path of file to inspect (must be in repository whitelist)'),
      }),
      outputSchema: z.object({
        filePath: z.string(),
        content: z.string(),
        status: z.enum(['SUCCESS', 'FORBIDDEN', 'NOT_FOUND']),
        error: z.string().optional(),
      }),
    },
    async (input: { filePath: string }) => {
      const result = fetchRepoContext(input.filePath);
      if (traceFn) traceFn('readRepoContext', input, result);
      return result;
    },
  );
}
