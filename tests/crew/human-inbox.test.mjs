import { strict as assert } from "node:assert";
import { test } from "node:test";
import { acknowledgeHumanRequests, queueHumanRequests } from "../../.pi/extensions/crew/lib/human-inbox-state.mjs";

const roster = { lead: { name: "lead-old-major" }, members: [{ name: "architect-mergio" }] };
const crew = { id: "crew", body: "Finding\n\n---\n@architect-mergio\nsigned" };
const human = { id: "human", url: "https://example.test/comment", body: "Need a developer second opinion", author: { login: "human" }, replyToId: "crew" };

test("nested human replies persist until explicitly acknowledged", () => {
  const queued = queueHumanRequests(roster, [crew, human]);
  assert.deepEqual(queued.pendingHumanRequests, [{ id: "human", url: human.url, body: human.body, author: "human", threadRootId: "crew", replyToId: "crew" }]);
  assert.equal(queueHumanRequests(queued, [crew, human]), queued);
  const acknowledged = acknowledgeHumanRequests(queued, ["human"]);
  assert.deepEqual(acknowledged.pendingHumanRequests, []);
  assert.deepEqual(acknowledged.handledHumanCommentIds, ["human"]);
});
