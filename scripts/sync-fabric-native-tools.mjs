import { readFileSync, writeFileSync } from "node:fs";
import { crewNativeToolNames, withCrewNativeToolVisibility } from "../.pi/extensions/crew/lib/native-tools.mjs";

const path = ".pi/fabric.json";
const config = JSON.parse(readFileSync(path, "utf8"));
const next = withCrewNativeToolVisibility(config);
writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Fabric-native Crew tools: ${crewNativeToolNames().join(", ")}`);
