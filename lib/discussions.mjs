/// <reference types="node" />

import { bash } from './executor.mjs';

export async function startDiscussion(topic) {
  const result = await bash({ cmd: 'echo "Starting discussion: ' + topic + '"' });
  return result;
}

export { bash };
