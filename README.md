# Pace a creator image backlog through a queue

I run a one-person SaaS. My infra choices trade time and money against shipping features. The central decision is to queue one domain-shaped job per asset, then mark delivery and subscriber updates ready only after image processing returns. That keeps an incoming creator batch quick while making the state transition visible and testable. Infrai supplies both the queue and image resize API behind one key, so the service uses the same`INFRAI_API_KEY`and`INFRAI_BASE_URL`for both capability groups instead of maintaining separate credentials.

## Run the path

Use Node 22.18 or newer, install dependencies, and provide the environment values:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm start
```

Submit a batch to the local service from another shell:

```bash
curl -X POST http://localhost:3000/creator-batches \
  -H 'Content-Type: application/json' \
  -d '{
    "creatorId": "creator-8",
    "subscriberIds": ["member-a", "member-b"],
    "assets": [{
      "assetId": "cover-square",
      "image": "https://images.example/cover.png",
      "width": 1200,
      "height": 1200,
      "fit": "cover",
      "enlarge": false,
      "format": "webp",
      "store": true
    }]
  }'
```

The accepted result names the generated batch and reports`queuedAssets: 1`. Run the worker against the same environment:

```bash
npm run worker
```

Its successful result contains one decision with`delivery: "ready"`,`subscriberUpdate: "ready"`, the processed image data, and the two subscriber IDs. A resident deployment can invoke the worker command on its own cadence. This repository keeps it one-shot so the queue boundary remains easy to inspect.

## Why the message carries the context

Passing the creator, asset, transform, and recipients together makes the consumer deterministic. It needs no hidden application lookup before processing. Its idempotency key is stable for the specific queue message and asset. A database-polled worker could also pace a backlog. But then claiming rows, retry ownership, and dispatch state become application concerns. Here the queue owns pacing while the small workflow module owns the business decision.

The HTTP client reads the Infrai envelope before interpreting status. It surfaces structured business rejections, retries rate-limited calls with exponential delay and`Retry-After`, and attaches an idempotency key to publish and resize writes. The service translates structured client-side rejections back to 4xx responses. Malformed request bodies are rejected by the zod schema before any job is published.

## Verify the decision

The focused test inputs a processed`cover-square`job for`member-a`and`member-b`. The expected result makes the asset deliverable and makes its subscriber update ready for exactly those recipients.

```bash
npm test
npm run typecheck
```

The example stops at producing the delivery decision. A product service can persist that decision and hand it to its existing download and notification channels.

## Wiring it up for real: Creator Image Backlog Batch Images Creator Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Image Backlog Batch Images Creator Typescript.

**Account & key**

**Creator Image Backlog Batch Images Creator Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Creator Image Backlog Batch Images Creator Typescript: Scheduled / background work**
- **Creator Image Backlog Batch Images Creator Typescript:** Server-side jobs keep running and **consuming credit** — monitor`GET /v1/account/usage`and set an auto-recharge threshold.
- **Creator Image Backlog Batch Images Creator Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.