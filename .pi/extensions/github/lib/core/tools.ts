import { Type } from "typebox";
import * as repo from "./repo.ts";

const S = Type.String;
const O = Type.Optional;
const obj = (properties) => Type.Object(properties);

export function registerCoreTools(pi) {
  const output = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value) }], details: value,
  });

  const tool = (name, description, parameters, execute) => pi.registerTool({
    name, label: name.replaceAll("_", " "), description, parameters,
    async execute(_id, input) { return output(await execute(input)); },
  });

  tool("github_repo_discussions_set", "Enable or disable repository Discussions.",
    obj({ repo:S(), enabled:Type.Boolean() }),
    x => repo.setDiscussionsEnabled(x.repo,x.enabled));
}