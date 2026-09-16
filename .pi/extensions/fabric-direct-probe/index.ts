import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

/** Minimal proof that Fabric can retain one extension tool on Pi's native path. */
export default function fabricDirectProbe(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "fabric_direct_probe",
    label: "Fabric direct probe",
    description: "Return a compact proof payload without using fabric_exec.",
    parameters: Type.Object({
      token: Type.String({ minLength: 1, maxLength: 80 }),
    }),
    async execute(_toolCallId, { token }) {
      const details = { route: "native-extension", token, observedAt: new Date().toISOString() };
      return {
        content: [{ type: "text", text: JSON.stringify({ route: details.route, token }) }],
        details,
      };
    },
  });
}
