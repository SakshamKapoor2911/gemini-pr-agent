/**
 * Genkit Developer UI Server Entrypoint
 * Run with: npm run dev:ui (or npx genkit start)
 * Opens full-screen interactive trace and flow visualizer at http://localhost:4000
 */

export {
  ai,
  staticSecurityAndLintChecker,
  readRepoContext,
  verifyProposedPatch,
  patchFormatter,
  stage1BaselineFlow,
  stage2EvidenceFlow,
  stage3SelfVerifyingFlow,
  stage4AdversarialDeliveryFlow,
} from './agent';
