
import { gh, ghJson } from "../core/gh.mjs";

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


export function listDiscussions(owner, repo, limit = 100) {
  const query = "query($owner:String!,$repo:String!,$limit:Int!){repository(owner:$owner,name:$repo){discussions(first:$limit){nodes{id number title url}}}}";
  return ghJson([
    "api", "graphql", "-f", `query=${query}`,
    "-F", `owner=${owner}`, "-F", `repo=${repo}`, "-F", `limit=${limit}`,
    "--jq", ".data.repository.discussions.nodes",
  ]);
}

export function createDiscussion(owner, repo, title, body, categoryName, options = {}) {
  const { labels = [] } = options;
  const repoId = repositoryId(owner, repo);
  const catId = categoryId(owner, repo, categoryName);
  
  const mutation = `mutation($repoId:ID!,$catId:ID!,$title:String!,$body:String!,$labels:[String!]!){createDiscussion(input:{repositoryId:$repoId,categoryId:$catId,title:$title,body:$body,labels:$labels}){discussion{id number url}}}`;
  
  const result = gh([
    "api", "graphql", "-f", `mutation=${mutation}`,
    "-F", `repoId=${repoId}`,
    "-F", `catId=${catId}`,
    "-F", `title=${title}`,
    "-F", `body=${body}`,
    "-F", `labels=${JSON.stringify(labels)}`,
    "--jq", ".data.createDiscussion.discussion",
  ]);
  
  return JSON.parse(result);
}

export function commentOnDiscussion(owner, repo, number, body) {
  const discussionId = discussionNodeId(owner, repo, number);
  const mutation = "mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{id url}}}";
  return JSON.parse(gh([
    "api", "graphql", "-f", `mutation=${mutation}`,
    "-F", `id=${discussionId}`,
    "-F", `body=${body}`,
    "--jq", ".data.addDiscussionComment.comment",
  ]));
}

export function listComments(owner, repo, number, limit = 20) {
  const query = "query($owner:String!,$repo:String!,$num:Int!,$limit:Int!){repository(owner:$owner,name:$repo){discussion(number:$num){comments(first:$limit){nodes{id url body author{login}}}}}";
  return JSON.parse(gh([
    "api", "graphql", "-f", `query=${query}`,
    "-F", `owner=${owner}`,
    "-F", `repo=${repo}`,
    "-F", `num=${number}`,
    "-F", `limit=${limit}`,
    "--jq", ".data.repository.discussion.comments.nodes",
  ]));
}

export function deleteDiscussion(owner, repo, number) {
  const discussionId = discussionNodeId(owner, repo, number);
  const mutation = "mutation($id:ID!){deleteDiscussion(input:{id:$id}){discussion{id}}}";
  return JSON.parse(gh([
    "api", "graphql", "-f", `mutation=${mutation}`,
    "-F", `id=${discussionId}`,
    "--jq", ".data.deleteDiscussion.discussion",
  ]));
}

export function updateDiscussion(owner, repo, number, title, body) {
  const discussionId = discussionNodeId(owner, repo, number);
  const mutation = "mutation($id:ID!,$title:String!,$body:String!){updateDiscussion(input:{id:$id,title:$title,body:$body}){discussion{id number url}}}";
  return JSON.parse(gh([
    "api", "graphql", "-f", `mutation=${mutation}`,
    "-F", `id=${discussionId}`,
    "-F", `title=${title}`,
    "-F", `body=${body}`,
    "--jq", ".data.updateDiscussion.discussion",
  ]));
}
