import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gh = args => execFileSync("gh", args, { encoding: "utf8" }).trim();
function ghWithBody(args, body) {
  const dir = mkdtempSync(join(tmpdir(), "crew-")); const file = join(dir, "body.txt");
  writeFileSync(file, body, "utf8");
  try { return gh([...args, "-F", `body=@${file}`]); } finally { rmSync(dir, { recursive:true, force:true }); }
}
function repositoryId(owner, repo) {
  const q="query($o:String!,$r:String!){repository(owner:$o,name:$r){id}}";
  return gh(["api","graphql","-f",`query=${q}`,"-f",`o=${owner}`,"-f",`r=${repo}`,"--jq",".data.repository.id"]);
}
function categoryId(owner, repo, category) {
  const q="query($o:String!,$r:String!){repository(owner:$o,name:$r){discussionCategories(first:20){nodes{id name}}}}";
  const all=JSON.parse(gh(["api","graphql","-f",`query=${q}`,"-f",`o=${owner}`,"-f",`r=${repo}`,"--jq",".data.repository.discussionCategories.nodes"]));
  const match=all.find(item=>item.name.toLowerCase()===category.toLowerCase());
  if(!match) throw new Error(`Unknown discussion category "${category}"`); return match.id;
}
function discussionId(owner,repo,number) {
  const q="query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){discussion(number:$n){id}}}";
  return gh(["api","graphql","-f",`query=${q}`,"-f",`o=${owner}`,"-f",`r=${repo}`,"-F",`n=${number}`,"--jq",".data.repository.discussion.id"]);
}
export const readRoster=path=>JSON.parse(readFileSync(path,"utf8"));
export const writeRoster=(path,roster)=>writeFileSync(path,JSON.stringify(roster,null,2),"utf8");
export function resolveRecipient(roster,to) {
  const member=roster.members.find(item=>item.name===to||item.name.startsWith(`${to}-`)||item.role===to);
  if(!member) throw new Error(`Crew member "${to}" not found. Roster: ${roster.members.map(item=>item.name).join(", ")}`); return member;
}
export function assertSubstantive(message) {
  const text=message.replace(/https?:\/\/\S+/g,"").replace(/@\S+/g,"").trim();
  if(text.length<8) throw new Error("Crew messages must contain a substantive instruction, question, or finding; a URL alone is not enough.");
}
export function signedBody(roster,from,message,signature) {
  const senders=[roster.lead,...roster.members].filter(Boolean);
  if(!senders.some(member=>member.name===from)) throw new Error(`Unknown Crew sender "${from}"`);
  assertSubstantive(message);
  if(!signature?.trim()||signature.trim().length<6) throw new Error("Crew posts require the sender's completed persona signature.");
  return `${message}\n\n${signature.trim()}`;
}
export function createKickoff(roster,title,body,category="General") {
  const repoId=repositoryId(roster.owner,roster.repo), catId=categoryId(roster.owner,roster.repo,category);
  const q="mutation($r:ID!,$c:ID!,$t:String!,$body:String!){createDiscussion(input:{repositoryId:$r,categoryId:$c,title:$t,body:$body}){discussion{number url}}}";
  return JSON.parse(ghWithBody(["api","graphql","-f",`query=${q}`,"-f",`r=${repoId}`,"-f",`c=${catId}`,"-f",`t=${title}`,"--jq",".data.createDiscussion.discussion"],body));
}
export function postComment(roster,body) {
  const id=discussionId(roster.owner,roster.repo,roster.discussionNumber);
  const q="mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{url}}}";
  return JSON.parse(ghWithBody(["api","graphql","-f",`query=${q}`,"-f",`id=${id}`,"--jq",".data.addDiscussionComment.comment"],body));
}
