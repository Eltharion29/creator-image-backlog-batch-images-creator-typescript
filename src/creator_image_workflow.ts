import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";
import { decideDelivery, type DeliveryDecision } from "./delivery_decision.ts";

export { decideDelivery, type DeliveryDecision } from "./delivery_decision.ts";

export const creatorBatchSchema = z.object({
  creatorId: z.string().min(1),
  subscriberIds: z.array(z.string().min(1)).min(1),
  assets: z.array(z.object({
    assetId: z.string().min(1),
    image: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fit: z.string().min(1),
    enlarge: z.boolean(),
    format: z.string().min(1),
    store: z.boolean(),
  })).min(1),
});

export type CreatorBatch = z.infer<typeof creatorBatchSchema>;
export type ImageJob = CreatorBatch["assets"][number] & {
  batchId: string;
  creatorId: string;
  subscriberIds: string[];
};

type QueueReceipt = { id?: string };
type QueueMessage = { message_id: string; payload: ImageJob };
type ConsumeResult = { messages?: QueueMessage[] } | QueueMessage[];
const creatorImageQueue = "creator-image-backlog";

export async function enqueueCreatorBatch(
  client: InfraiClient,
  batchId: string,
  batch: CreatorBatch,
): Promise<{ batchId: string; queuedAssets: number; receipts: QueueReceipt[] }> {
  const receipts = await Promise.all(batch.assets.map((asset) => {
    const payload: ImageJob = {
      ...asset,
      batchId,
      creatorId: batch.creatorId,
      subscriberIds: batch.subscriberIds,
    };
    return client.post<QueueReceipt>(
      "/v1/queue/publish",
      { queue: creatorImageQueue, payload },
      `creator-batch:${batchId}:${asset.assetId}`,
    );
  }));

  return { batchId, queuedAssets: receipts.length, receipts };
}

export async function processNextCreatorImages(
  client: InfraiClient,
  maxMessages = 10,
): Promise<DeliveryDecision[]> {
  const consumed = await client.post<ConsumeResult>(
    "/v1/queue/consume",
    { queue: creatorImageQueue, max_messages: maxMessages, visibility_timeout: 120 },
  );
  const messages = Array.isArray(consumed) ? consumed : consumed.messages ?? [];

  return Promise.all(messages.map(async ({ message_id, payload }) => {
    const processedImage = await client.post<unknown>(
      "/v1/image/resize",
      {
        image: payload.image,
        width: payload.width,
        height: payload.height,
        fit: payload.fit,
        enlarge: payload.enlarge,
        format: payload.format,
        store: payload.store,
      },
      `creator-image:${message_id}:${payload.assetId}`,
    );
    return decideDelivery(payload, processedImage);
  }));
}
