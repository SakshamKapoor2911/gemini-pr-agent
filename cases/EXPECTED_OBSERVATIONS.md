# Recorded workshop observations

These observations come from the original `reference-runs/case-01.json` through `case-04.json`. They describe saved records, not guaranteed outcomes of a new model call.

| Case | Scanner | Candidate-test evidence | Final recorded review |
| --- | --- | --- | --- |
| 01 · Buggy grades | Flags literal division/modulo by zero | First candidate: 3 pass, 1 fail on negative count. Revised candidate: 4 pass, 0 fail | REQUEST_CHANGES; final badge reports four passing workshop tests |
| 02 · Clean grades | No issues | A tool call records 4 pass, 0 fail | APPROVE; final badge says UNVERIFIED, which disagrees with that receipt |
| 03 · Harmless comment | No issues | First execution incomplete; a later candidate records 4 pass, 0 fail | REQUEST_CHANGES; final badge says FAILED, which disagrees with the latest receipt |
| 04 · Trojan SQL/comment | Flags potential SQL injection via dynamic interpolation | No patch-test call and no proposed code patch | REQUEST_CHANGES; no passing-test claim is established |

Case 01's recorded duration is 34,095 ms (34.1 s). The requested alias is `gemini-flash-lite-latest`; that field does not establish the resolved provider model version or typical latency.

The Case 01 context call reads `src/grades.ts` itself. Do not describe that saved run as retrieving caller files or policy documents that were not requested.

Use the [companion](https://review-lab-umd.vercel.app) to inspect each record, or `npm run demo:replay` from the lab folder to print summaries. Compare the final model text with the tool receipts rather than using either to authenticate the other.

Do not describe the four grade tests as verifying an SQL fix. Candidate/suite hashes identify matching inputs; a temporary test workspace is not a security boundary.
