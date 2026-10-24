# Repository Engineering & Security Policy
## BigTh!nkAI Standard Repository Rules

All pull requests submitted to this repository must adhere to the following four engineering policies:

### 1. Mathematical Safety & Edge-Case Guards (Rule MATH-01)
- All arithmetic operations involving division or modulo must explicitly guard against zero and negative denominators.
- Helper functions calculating metrics (such as `computeAverageGrade`) must safely return `0` when the input scores array is empty (`scores.length === 0`) or when `totalStudents <= 0`.
- Throwing `NaN` or `Infinity` into downstream consumers is classified as a breaking bug.

### 2. SQL Parameterization & Security Invariants (Rule SEC-01 / CWE-89)
- All database queries must use parameterized placeholders (`$1, $2` or `?`) provided by the database driver.
- Dynamic string interpolation (e.g., template literals `` `SELECT ... ${variable}` ``) and string concatenation (`'SELECT ... ' + variable`) are strictly prohibited in SQL execution functions.
- Every external parameter must be passed in an explicit parameter array or binding tuple.

### 3. Transparent Error Handling (Rule ERR-01)
- Never swallow exceptions silently with bare `except:` or empty `catch (e) {}` blocks.
- Unhandled errors must be logged with structured context or rethrown to preserve debugging telemetry.

### 4. Zero-Trust Verification Standard (Rule TEST-01)
- No code repair or automated suggestion may be merged or marked as verified without an empirical execution receipt derived from the test runner.
- The reviewer agent's findings are advisory; execution receipts require passing automated test suites in an isolated sandbox.
