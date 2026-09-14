import { Type } from "typebox";
import * as pulls from "./index.ts";

const S = Type.String;
const I = Type.Integer;
const O = Type.Optional;
const E = values => Type.Union(values.map(value => Type.Literal(value)));
const obj = (properties) => Type.Object(properties);

export function registerPullRequestTools(pi) {
  const output = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value) }], details: value,
  });

  const tool = (name, description, parameters, execute) => pi.registerTool({
    name, label: name.replaceAll("_", " "), description, parameters,
    async execute(_id, input) { return output(await execute(input)); },
  });

  tool("github_pull_requests_list", "List repository pull requests.",
    obj({ repo:S(), state:O(S()), limit:O(I()) }),
    x => pulls.listPullRequests(x.repo, x.state, x.limit));

  tool("github_pull_request_view", "Read a pull request.",
    obj({ repo:S(), pullNumber:I() }),
    x => pulls.viewPullRequest(x.repo, x.pullNumber));

  tool("github_pull_request_comment", "Post a comment on a pull request.",
    obj({ repo:S(), pullNumber:I(), body:S() }),
    x => pulls.commentOnPullRequest(x.repo, x.pullNumber, x.body));

  tool("github_pull_request_update", "Edit pull request title, body, base branch, or state.",
    obj({ repo:S(), pullNumber:I(), title:O(S()), body:O(S()), base:O(S()), state:O(S()) }),
    x => pulls.updatePullRequest(x.repo, x.pullNumber, x));

  tool("github_pull_request_review", "Approve or request changes on a pull request.",
    obj({ repo:S(), pullNumber:I(), event:E(["approve", "request-changes"]), body:O(S()) }),
    x => pulls.reviewPullRequest(x.repo, x.pullNumber, x.event, x.body));

  tool("github_pull_request_merge", "Merge a pull request.",
    obj({ repo:S(), pullNumber:I(), method:O(E(["merge", "squash", "rebase"])) }),
    x => pulls.mergePullRequest(x.repo, x.pullNumber, x.method));

  tool("github_pull_request_add_label", "Apply labels to a pull request.",
    obj({ repo:S(), pullNumber:I(), labels:Type.Array(S()) }),
    x => pulls.addPullRequestLabels(x.repo, x.pullNumber, x.labels));

  tool("github_pull_request_remove_label", "Remove a label from a pull request.",
    obj({ repo:S(), pullNumber:I(), label:S() }),
    x => pulls.removePullRequestLabel(x.repo, x.pullNumber, x.label));
}
