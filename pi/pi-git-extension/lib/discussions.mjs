import { gh } from "./gh.mjs";

function discussionNodeId(owner, repo, number) {
  const query = "query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){discussion(number:$num){id}}}";
  return gh([
    "api", "graphql",
    "-f", `query=${query}`,
    "-F", `owner=${owner}`, "-F", `repo=${repo}`, "-F", `num=${number}`,
    "--jq", ".data.repository.discussion.id",
  ]);
}

export function commentOnDiscussion(owner, repo, number, body) {
  const discussionId = discussionNodeId(owner, repo, number);
  const mutation = "mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{id url}}}";
  return gh([
    "api", "graphql",
    "-f", `query=${mutation}`,
    "-F", `id=${discussionId}`, "-F", `body=${body}`,
    "--jq", ".data.addDiscussionComment.comment",
  ]);
}
