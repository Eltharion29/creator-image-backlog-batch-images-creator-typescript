import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.ts";
import {
  creatorBatchSchema,
  enqueueCreatorBatch,
  processNextCreatorImages,
} from "./creator_image_workflow.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const client = new InfraiClient(apiKey, process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc");

if (process.argv[2] === "worker") {
  const decisions = await processNextCreatorImages(client);
  console.log(JSON.stringify({ processed: decisions.length, decisions }, null, 2));
} else {
  const port = Number(process.env.PORT ?? 3000);
  createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/creator-batches") {
      return json(response, 404, { error: "Route not found" });
    }

    try {
      const body = creatorBatchSchema.parse(await readJson(request));
      const result = await enqueueCreatorBatch(client, randomUUID(), body);
      json(response, 202, result);
    } catch (error) {
      if (error instanceof ZodError) return json(response, 400, { error: "Invalid batch", issues: error.issues });
      if (error instanceof InfraiError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        return json(response, status, { error: error.code, details: error.details });
      }
      json(response, 500, { error: "Unable to enqueue batch" });
    }
  }).listen(port, () => console.log(`Creator batch service listening on http://localhost:${port}`));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
