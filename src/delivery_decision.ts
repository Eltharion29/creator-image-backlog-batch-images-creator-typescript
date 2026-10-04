export type DeliverableImageJob = {
  assetId: string;
  subscriberIds: string[];
};

export type DeliveryDecision = {
  assetId: string;
  delivery: "ready";
  subscriberUpdate: "ready";
  processedImage: unknown;
  recipients: string[];
};

export function decideDelivery(
  job: DeliverableImageJob,
  processedImage: unknown,
): DeliveryDecision {
  return {
    assetId: job.assetId,
    delivery: "ready",
    subscriberUpdate: "ready",
    processedImage,
    recipients: [...job.subscriberIds],
  };
}
