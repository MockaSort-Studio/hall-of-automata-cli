import { Type } from "typebox";
import * as discussions from "./index.ts";

const S = Type.String;
const I = Type.Integer;
const O = Type.Optional;
const obj = (properties) => Type.Object(properties);

export function registerDiscussionTools(pi) {
  const output = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value) }], details: value,
  });

  const tool = (name, description, parameters, execute) => pi.registerTool({
    name, label: name.replaceAll("_", " "), description, parameters,
    async execute(_id, input) { return output(await execute(input)); },
  });

  tool("github_discussion_comments", "Read comments from a Discussion thread.",
    obj({ owner:S(), repo:S(), discussionNumber:I(), limit:O(I()) }),
    x => discussions.listComments(x.owner,x.repo,x.discussionNumber,x.limit));

  tool("github_discussion_view", "Read canonical Discussion state, including human closure.",
    obj({ owner:S(), repo:S(), discussionNumber:I() }),
    x => discussions.viewDiscussion(x.owner,x.repo,x.discussionNumber));
  
  tool("github_discussions_list", "List repository Discussions.",
    obj({ owner:S(), repo:S(), limit:O(I()) }),
    x => discussions.listDiscussions(x.owner,x.repo,x.limit));
  
  tool("github_discussion_delete", "Permanently delete a Discussion.",
    obj({ owner:S(), repo:S(), discussionNumber:I() }),
    x => discussions.deleteDiscussion(x.owner,x.repo,x.discussionNumber));
}