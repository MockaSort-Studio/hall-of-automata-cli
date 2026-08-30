import { Type } from "typebox";
import * as discussions from "../../../extensions/github/discussions/index.mjs";
import * as issues from "../../../extensions/github/issues/index.mjs";
import * as projects from "../../../extensions/github/projects/index.mjs";
import * as repo from "../../../extensions/github/core/repo.mjs";

const S = Type.String;
const I = Type.Integer;
const O = Type.Optional;
const obj = (properties) => Type.Object(properties);
const output = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value) }], details: value,
});

export default function (pi) {
  const tool = (name, description, parameters, execute) => pi.registerTool({
    name, label: name.replaceAll("_", " "), description, parameters,
    async execute(_id, input) { return output(await execute(input)); },
  });

  tool("github_discussion_create", "Create the one Discussion for a Crew dispatch.",
    obj({ owner:S(), repo:S(), title:S(), body:S(), category:S() }),
    x => discussions.createDiscussion(x.owner,x.repo,x.title,x.body,x.category));
  tool("github_discussion_comment", "Append to an existing Discussion thread.",
    obj({ owner:S(), repo:S(), number:I(), body:S() }),
    x => discussions.commentOnDiscussion(x.owner,x.repo,x.number,x.body));
  tool("github_discussion_comments", "Read comments from a Discussion thread.",
    obj({ owner:S(), repo:S(), number:I(), limit:O(I()) }),
    x => discussions.listComments(x.owner,x.repo,x.number,x.limit));
  tool("github_discussions_list", "List repository Discussions.",
    obj({ owner:S(), repo:S(), limit:O(I()) }),
    x => discussions.listDiscussions(x.owner,x.repo,x.limit));
  tool("github_discussion_delete", "Permanently delete a Discussion.",
    obj({ owner:S(), repo:S(), number:I() }),
    x => discussions.deleteDiscussion(x.owner,x.repo,x.number));

  tool("github_issue_create", "Create an Issue.",
    obj({ repo:S(), title:S(), bodyFile:S(), labels:O(Type.Array(S())), milestone:O(S()) }),
    x => issues.createIssue(x.repo,x));
  tool("github_issue_view", "Read an Issue.", obj({ repo:S(), number:I() }),
    x => issues.viewIssue(x.repo,x.number));
  tool("github_subissue_add", "Attach a child Issue to a parent.",
    obj({ repo:S(), parentNumber:I(), childNumber:I() }),
    x => issues.addSubIssue(x.repo,x.parentNumber,x.childNumber));
  tool("github_subissues_list", "List a parent Issue's children.",
    obj({ repo:S(), parentNumber:I() }), x => issues.listSubIssues(x.repo,x.parentNumber));
  tool("github_dependency_add", "Mark an Issue as blocked by another Issue.",
    obj({ repo:S(), issueNumber:I(), blockingNumber:I() }),
    x => issues.addBlockedBy(x.repo,x.issueNumber,x.blockingNumber));

  tool("github_project_fields", "Read live Project field and option IDs.",
    obj({ org:S(), project:I() }), x => projects.getFieldMap(x.org,x.project));
  tool("github_project_item_add", "Add an Issue or PR URL to a Project.",
    obj({ org:S(), project:I(), url:S() }), x => projects.addItem(x.org,x.project,x.url));
  tool("github_project_item_find", "Find a Project item for an Issue.",
    obj({ org:S(), project:I(), issueNumber:I() }),
    x => projects.findItemId(x.org,x.project,x.issueNumber));
  tool("github_project_field_set", "Set a single-select Project field.",
    obj({ org:S(), project:I(), itemId:S(), fieldName:S(), valueName:S() }),
    x => projects.setField(x.org,x.project,x.itemId,x.fieldName,x.valueName));
  tool("github_repo_discussions_set", "Enable or disable repository Discussions.",
    obj({ repo:S(), enabled:Type.Boolean() }), x => repo.setDiscussionsEnabled(x.repo,x.enabled));
}
