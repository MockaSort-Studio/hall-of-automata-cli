import { Type } from "typebox";
import * as projects from "./index.ts";

const S = Type.String;
const I = Type.Integer;
const O = Type.Optional;
const obj = (properties) => Type.Object(properties);

export function registerProjectTools(pi) {
  const output = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value) }], details: value,
  });

  const tool = (name, description, parameters, execute) => pi.registerTool({
    name, label: name.replaceAll("_", " "), description, parameters,
    async execute(_id, input) { return output(await execute(input)); },
  });

  tool("github_project_fields", "Read live Project field and option IDs.",
    obj({ org:S(), project:I() }),
    x => projects.getFieldMap(x.org,x.project));
  
  tool("github_project_item_add", "Add an Issue or PR URL to a Project.",
    obj({ org:S(), project:I(), url:S() }),
    x => projects.addItem(x.org,x.project,x.url));
  
  tool("github_project_item_find", "Find a Project item for an Issue.",
    obj({ org:S(), project:I(), issueNumber:I() }),
    x => projects.findItemId(x.org,x.project,x.issueNumber));
  
  tool("github_project_field_set", "Set a single-select Project field.",
    obj({ org:S(), project:I(), itemId:S(), fieldName:S(), valueName:S() }),
    x => projects.setField(x.org,x.project,x.itemId,x.fieldName,x.valueName));
}