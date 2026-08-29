/// <reference types="node" />

import { startDiscussion, bash } from './discussions.mjs';

export async function sendMessage(message) {
  const result = await bash({ cmd: 'echo "Sending message: ' + message + '"' });
  return result;
}

export { startDiscussion, bash };
