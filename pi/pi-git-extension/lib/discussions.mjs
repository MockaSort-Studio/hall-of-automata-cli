import { gh, ghJson } from "./gh.mjs";

function repositoryId(owner, repo) {
  const query = "query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){id}}";
  return gh([
    "api", "graphql", "-f", `query=${query}`,
    "-F", `owner=${owner}`, "-F", `repo=${repo}`,
    "--jq", ".data.repository.id",
  ]);
}

function categoryId(owner, repo, categoryName) {
  const query = "query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){discussionCategories(first:20){nodes{id name}}}}";
  const categories = ghJson([
    "api", "graphql", "-f", `query=${query}`,
    "-F", `owner=${owner}`, "-F", `repo=${repo}`,
    "--jq", ".data.repository.discussionCategories.nodes",
  ]);
  const match = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!match) throw new Error(`Unknown discussion category "${categoryName}"`);
  return match.id;
}

function discussionNodeId(owner, repo, number) {
  const query = "query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){discussion(number:$num){id}}}";
  return gh([
    "api", "graphql", "-f", `query=${query}`,
    "-F", `owner=${owner}`, "-F", `repo=${repo}`, "-F", `num=${number}`,
    "--jq", ".data.repository.discussion.id",
  ]);
}

// Repository/category ids are resolved live on every call — same
// no-local-mirror discipline as project.mjs, no cache.
export function createDiscussion(owner, repo, title, body, categoryName) {
  const repoId = repositoryId(owner, repo);
  const catId = categoryId(owner, repo, categoryName);
  const mutation = "mutation($repoId:ID!,$catId:ID!,$title:String!,$body:String!){createDiscussion(input:{repositoryId:$repoId,categoryId:$catId,title:$title,body:$body}){discussion{id number url}}}";
  return gh([
    "api", "graphql", "-f", `query=${mutation}`,
    "-F", `repoId=${repoId}`, "-F", `catId=${catId}`,
    "-F", `title=${title}`, "-F", `body=${body}`,
    "--jq", ".data.createDiscussion.discussion",
  ]);
}

export function commentOnDiscussion(owner, repo, number, body) {
  const discussionId = discussionNodeId(owner, repo, number);
  const mutation = "mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{id url}}}";
  return gh([
    "api", "graphql", "-f", `query=${mutation}`,
    "-F", `id=${discussionId}`, "-F", `body=${body}`,
    "--jq", ".data.addDiscussionComment.comment",
  ]);
}

export function listComments(owner, repo, number, limit = 20) {
  const query = "query($owner:String!,$repo:String!,$num:Int!,$limit:Int!){repository(owner:$owner,name:$repo){discussion(number:$num){comments(first:$limit){nodes{id url body author{login}}}}}}";
  return gh([
    "api", "graphql", "-f", `query=${query}`,
    "-F", `owner=${owner}`, "-F", `repo=${repo}`, "-F", `num=${number}`, "-F", `limit=${limit}`,
    "--jq", ".data.repository.discussion.comments.nodes",
  ]);
}

export function deleteDiscussion(owner, repo, number) {
  const discussionId = discussionNodeId(owner, repo, number);
  const mutation = "mutation($id:ID!){deleteDiscussion(input:{id:$id}){discussion{id}}}";
  return gh([
    "api", "graphql", "-f", `query=${mutation}`,
    "-F", `id=${discussionId}`,
    "--jq", ".data.deleteDiscussion.discussion",
  ]);
}
