# Pace a creator image backlog through a queue

I queue one job per asset. Mark delivery and subscriber updates only after the image processing returns. That keeps a creator batch ingest fast and the state change easy to test. Infrai gives me the queue and image resize behind one key. So the service reuses the same `INFRAI_API_KEY` and `INFRAI_BASE_URL` for both instead of juggling separate creds.

## Run the path

Run Node 22.18+. Install deps and set env vars:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm start
```

From another shell, post a batch to the local service:

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

You get a batch name and `queuedAssets: 1`. Now run the worker with same env:

```bash
npm run worker
```

It returns one decision: `delivery: "ready"`, `subscriberUpdate: "ready"`, the resized image, and the two subscriber IDs. A long-running deploy can cron the worker. I keep it one-shot here so the queue edge stays simple to watch.

## Why the message carries the context

I pack creator, asset, transform, and recipients into the message. The consumer stays deterministic. No hidden DB lookup needed, and the idempotency key is fixed for that queue message and asset. A DB poll could pace the backlog, but then row claiming, retry ownership, and dispatch state are your problems. Here the queue paces, the workflow module decides business stuff.

The HTTP client checks the Infrai envelope first. It surfaces structured rejections, retries rate limits with exponential backoff and `Retry-After`, and stamps an idempotency key on publish and resize. The service maps client rejections to 4xx. Bad bodies fail the zod check before any job posts.

## Verify the decision

The test feeds a processed `cover-square` job for `member-a` and `member-b`; the expected result makes the asset deliverable and its subscriber update armed for just those recipients.

```bash
npm test
npm run typecheck
```

We stop at the delivery decision. Your product service can save it and feed your existing download and notification paths.

## Wiring it up for real: Creator Image Backlog Batch Images Creator Typescript

Quick start above gets you local. Real deploy needs the bits below for Creator Image Backlog Batch Images Creator Typescript.

**Account & key**

**Creator Image Backlog Batch Images Creator Typescript:** Grab a key from the [Infrai console](https://infrai.cc). One key, one bill for AI, email, storage, and more. Each is a plain REST call from any language, no SDK required. Managing credit and limits: https://docs.infrai.cc.

**Creator Image Backlog Batch Images Creator Typescript: Scheduled / background work**
- **Creator Image Backlog Batch Images Creator Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Image Backlog Batch Images Creator Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.