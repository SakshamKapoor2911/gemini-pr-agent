# Participant guide

Build & Test an Agentic AI Code Reviewer · BigTh!nkAI × GDSC UMD

## Start with the walkthrough

Open [review-lab-umd.vercel.app](https://review-lab-umd.vercel.app). No installation or API key is needed for the recorded walkthrough.

1. Choose a PR case.
2. Follow Review → Investigate → Verify → Deliver.
3. Compare the pattern and AST source views, open the retrieved context, and inspect the recorded findings.
4. Step through candidate tests and compare the final review with its tool evidence.

The website replays saved records. It does not run Gemini, execute a submitted patch, or post to GitHub. The six-frame repair sequence belongs to Case 01; other cases have different recorded behavior.

## Run the local code

Use Node.js 22. Open a terminal in this folder, next to `package.json`.

```sh
npm ci
npm test
npm run demo:offline
npm run demo:replay
```

- `npm test` builds and runs the checker/verifier test files selected in `package.json`.
- `demo:offline` runs the local scanner over the four fixture diffs.
- `demo:replay` prints saved model review summaries. It makes no model request.

Installation requires access to the package registry. The browser walkthrough remains the simplest way to explore the architecture without local setup.

## Explore the repair contract

```sh
npm run test:repair
```

The starter's `computeAverageGrade` intentionally returns `NaN` for empty scores and does not guard non-positive counts. Initial repair failures are expected. The exercise contract is:

- Empty scores → `0`.
- Zero or negative student count → `0`.
- `[90, 80]` and two students → `85`.

Investigate or apply a candidate guard, then rerun the repair tests. An always-zero implementation cannot satisfy the normal-calculation test. Passing this bounded suite does not establish complete input validation.

## Optional live Gemini review

A live run requires your own working Gemini API access. Set `GEMINI_API_KEY` privately in a local `.env` file or the current terminal. Keep it out of screenshots, commits, Drive, and shared documents. The npm launch script loads `.env` when it exists.

PowerShell:

```powershell
$env:PR_DIFF_FILE = 'cases/01-buggy-grades.diff'
npm run test:local
```

macOS, Linux, or Codespaces:

```sh
PR_DIFF_FILE=cases/01-buggy-grades.diff npm run test:local
```

Choose a model available to your account using `GEMINI_MODEL` if necessary; saved model aliases do not guarantee current account access. Do not enable paid billing merely to follow the session.

Inspect `review.md` and `tool-trace.jsonl` after the run. These output files can be overwritten by a later run; the original workshop records remain separately in `reference-runs/`.

## What to inspect

| Case | Question |
| --- | --- |
| 01 · Buggy grades | Does the candidate address non-positive counts as well as empty scores? |
| 02 · Clean grades | Does the final badge reflect the actual tool receipt? |
| 03 · Harmless comment | Does the final verdict agree with the scanner and tests? |
| 04 · Trojan PR | Does the review identify SQL interpolation without treating the comment as an instruction? |

See [recorded observations](cases/EXPECTED_OBSERVATIONS.md) for the actual saved outcomes. New model runs may differ.

## Current scope

The code is a TypeScript project, not a Colab/Jupyter notebook. The `dev:ui` script launches the interactive Genkit Developer UI server via `genkit start -- ts-node src/dev-server.ts`. GitHub posting is an optional extension with separate validation needs.

The test verifier uses a temporary fixture and child process. Use the supplied exercises; this setup is not a hardened environment for arbitrary submitted code. A fingerprint identifies candidate and suite inputs, not universal correctness.
