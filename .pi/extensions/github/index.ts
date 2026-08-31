import { Type } from "typebox";
import * as discussions from "./lib/discussions/index.ts";
import * as issues from "./lib/issues/index.ts";
import * as projects from "./lib/projects/index.ts";
import * as repo from "./lib/core/repo.ts";
import * as labels from "./lib/labels/index.ts";

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

  tool("github_discussion_comments", "Read comments from a Discussion thread.",
    obj({ owner:S(), repo:S(), discussionNumber:I(), limit:O(I()) }),
    x => discussions.listComments(x.owner,x.repo,x.discussionNumber,x.limit));
  tool("github_discussions_list", "List repository Discussions.",
    obj({ owner:S(), repo:S(), limit:O(I()) }),
    x => discussions.listDiscussions(x.owner,x.repo,x.limit));
  tool("github_discussion_delete", "Permanently delete a Discussion.",
    obj({ owner:S(), repo:S(), discussionNumber:I() }),
    x => discussions.deleteDiscussion(x.owner,x.repo,x.discussionNumber));

  tool("github_issue_create", "Create an Issue.",
    obj({ repo:S(), title:S(), bodyFile:S(), labels:O(Type.Array(S())), milestone:O(S()) }),
    x => issues.createIssue(x.repo,x));
  tool("github_issue_view", "Read an Issue.", obj({ repo:S(), issueNumber:I() }),
    x => issues.viewIssue(x.repo,x.issueNumber));
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

  tool("github_label_list", "List all labels in a repository.",
    obj({ repo:S() }),
    x => labels.listLabels(x.repo));
  tool("github_label_create", "Create a new label in a repository.",
    obj({ repo:S(), name:S(), color:S(), description:O(S()) }),
    x => labels.createLabel(x.repo,x.name,x.color,x.description));
  tool("github_label_update", "Update an existing label's color or description.",
    obj({ repo:S(), name:S(), color:O(S()), description:O(S()) }),
    x => labels.updateLabel(x.repo,x.name,x.color,x.description));
  tool("github_issue_add_label", "Add one or more labels to an Issue.",
    obj({ repo:S(), issueNumber:I(), labels:Type.Array(S()) }),
    x => labels.addLabels(x.repo,x.issueNumber,x.labels));

  tool("github_issues_list", "List repository Issues, optionally filtered by state, labels, or milestone.",
    obj({ repo:S(), state:O(S()), labels:O(Type.Array(S())), milestone:O(S()), limit:O(I()) }),
    x => issues.listIssues(x.repo,x.state,x.labels,x.milestone,x.limit));
  tool("github_dependency_list", "Read open blockers for an Issue (GET blocked_by).",
    obj({ repo:S(), issueNumber:I() }),
    x => issues.listDependencies(x.repo,x.issueNumber));
  tool("github_issue_comment", "Post a status comment on an Issue.",
    obj({ repo:S(), issueNumber:I(), body:S() }),
    x => issues.commentOnIssue(x.repo,x.issueNumber,x.body));
  tool("github_issue_update", "Edit Issue fields: title, body, milestone, or state.",
    obj({ repo:S(), issueNumber:I(), title:O(S()), body:O(S()), milestone:O(S()), state:O(S()) }),
    x => issues.updateIssue(x.repo,x.issueNumber,x));
  tool("github_issue_remove_label", "Remove a specific label from an Issue.",
    obj({ repo:S(), issueNumber:I(), label:S() }),
    x => issues.removeLabel(x.repo,x.issueNumber,x.label));
}
