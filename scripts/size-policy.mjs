// The size policy as a pure verdict, so a test can hold it without
// fetching chezz-classic: narrative (main) is tracked and never fails on
// size; classic's published artifact has a soft target that only warns
// and a hard cap that fails (hf7y/chezz#90, hf7y-estate/chezz#150).
export const SOFT_TARGET_BYTES = 50_000;
export const HARD_CAP_BYTES = 100_000;

export function sizeVerdict({ narrativeBytes, classicArtifactBytes }) {
  const log = [
    `check-size: index1.html (narrative) is ${narrativeBytes} bytes ` +
      `(tracking only — no byte limit on the narrative build)`,
    `check-size: classic artifact (built + stripped) is ` +
      `${classicArtifactBytes} bytes (ENFORCED: soft target ${SOFT_TARGET_BYTES}, hard cap ${HARD_CAP_BYTES})`,
  ];
  const warnings = [];
  const errors = [];
  if (classicArtifactBytes > HARD_CAP_BYTES) {
    errors.push(
      `check-size: classic's built artifact is over the ${HARD_CAP_BYTES}-byte hard cap ` +
        `by ${classicArtifactBytes - HARD_CAP_BYTES} bytes. Do NOT trim to fit -- ` +
        `file an issue (\`gh issue create --repo hf7y-estate/chezz\`) to raise the threshold.`
    );
  } else if (classicArtifactBytes > SOFT_TARGET_BYTES) {
    warnings.push(
      `check-size: classic artifact is over the ${SOFT_TARGET_BYTES}-byte soft target ` +
        `by ${classicArtifactBytes - SOFT_TARGET_BYTES} bytes`
    );
  }
  return { ok: errors.length === 0, log, warnings, errors };
}
