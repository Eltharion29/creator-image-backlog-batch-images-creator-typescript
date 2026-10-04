import assert from "node:assert/strict";
import test from "node:test";
import { decideDelivery } from "../src/delivery_decision.ts";

test("a processed creator asset becomes deliverable to its subscribers", () => {
  const job = {
    batchId: "launch-17",
    creatorId: "creator-8",
    assetId: "cover-square",
    subscriberIds: ["member-a", "member-b"],
    image: "https://images.example/cover.png",
    width: 1200,
    height: 1200,
    fit: "cover",
    enlarge: false,
    format: "webp",
    store: true,
  };

  assert.deepEqual(decideDelivery(job, { id: "processed-cover" }), {
    assetId: "cover-square",
    delivery: "ready",
    subscriberUpdate: "ready",
    processedImage: { id: "processed-cover" },
    recipients: ["member-a", "member-b"],
  });
});
