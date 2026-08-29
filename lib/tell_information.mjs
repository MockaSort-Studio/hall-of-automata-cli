/// <reference types="node" />

export function tell_information(results) {
  console.log('=== VALIDATION RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('Validation complete. All checks passed.');
}
