/// <reference types="node" />

import { execSync } from 'node:child_process';

/**
 * Context-aware bash executor
 * Detects Fabric context and falls back to Node.js child_process
 * Returns normalized {ok, output, error} format
 */
export function bash(command, options = {}) {
  // Detect Fabric context
  if (typeof pi !== 'undefined') {
    try {
      // Use pi.bash in Fabric
      const result = pi.bash({ cmd: command, ...options });
      
      // Normalize pi.bash return format to {ok, output, error}
      if (result && typeof result === 'object') {
        if (result.ok !== undefined) {
          return {
            ok: result.ok,
            output: result.output || '',
            error: result.error || null
          };
        }
        return {
          ok: true,
          output: result.output || result.stdout || '',
          error: result.error || result.stderr || null
        };
      }
      
      return {
        ok: true,
        output: String(result),
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        output: err.stdout || '',
        error: err.message || String(err)
      };
    }
  } else {
    // Fall back to Node.js child_process
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        ...options
      });
      return {
        ok: true,
        output: output || '',
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        output: err.stdout || '',
        error: err.stderr || err.message || String(err)
      };
    }
  }
}
