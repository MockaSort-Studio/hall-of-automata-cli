import { Type } from "typebox";
import {
  createDiscussion,
  commentOnDiscussion,
  listComments,
  listDiscussions,
  deleteDiscussion,
} from "./index.mjs";

function result(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], details: value };
}

export default function (pi) {
  pi.registerTool({
    name: "github_discussion_create",
    label: "GitHub Discussion: create",
    description: "Create the single GitHub Discussion for a Crew dispatch.",
    parameters: Type.Object({
      owner: Type.String(), repo: Type.String(), title: Type.String(),
      body: Type.String(), category: Type.String(),
    }),
    async execute(_id, input) {
      return result(await createDiscussion(input.owner, input.repo, input.title, input.body, input.category));
    },
  });

  pi.registerTool({
    name: "github_discussion_comment",
    label: "GitHub Discussion: comment",
    description: "Append an agent finding or kickoff update to the existing Crew Discussion.",
    parameters: Type.Object({
      owner: Type.String(), repo: Type.String(), number: Type.Integer(), body: Type.String(),
    }),
    async execute(_id, input) {
      return result(await commentOnDiscussion(input.owner, input.repo, input.number, input.body));
    },
  });

  pi.registerTool({
    name: "github_discussion_comments",
    label: "GitHub Discussion: read comments",
    description: "Read the existing Crew Discussion thread before acting or reviewing.",
    parameters: Type.Object({
      owner: Type.String(), repo: Type.String(), number: Type.Integer(),
    }),
    async execute(_id, input) {
      return result(await listComments(input.owner, input.repo, input.number));
    },
  });
  pi.registerTool({
    name: "github_discussions_list",
    label: "GitHub Discussions: list",
    description: "List Discussions in a GitHub repository.",
    parameters: Type.Object({
      owner: Type.String(), repo: Type.String(), limit: Type.Optional(Type.Integer()),
    }),
    async execute(_id, input) {
      return result(await listDiscussions(input.owner, input.repo, input.limit));
    },
  });

  pi.registerTool({
    name: "github_discussion_delete",
    label: "GitHub Discussion: delete",
    description: "Permanently delete one GitHub Discussion by number.",
    parameters: Type.Object({
      owner: Type.String(), repo: Type.String(), number: Type.Integer(),
    }),
    async execute(_id, input) {
      return result(await deleteDiscussion(input.owner, input.repo, input.number));
    },
  });

}
