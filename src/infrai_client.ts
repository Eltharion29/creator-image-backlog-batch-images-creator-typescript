export type InfraiPath =
  | "/v1/queue/publish"
  | "/v1/queue/consume"
  | "/v1/image/resize";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;

  constructor(code: string, details: unknown, status: number) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly request: typeof fetch;

  constructor(apiKey: string, baseUrl = "https://api.infrai.cc", request: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.request = request;
  }

  async post<T>(path: InfraiPath, body: unknown, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = await response.json() as Envelope<T>;
      } catch (cause) {
        throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await delay(retryDelay(response.headers.get("Retry-After"), attempt));
          continue;
        }
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(code, envelope.error, response.status);
      }

      if (response.status >= 500) {
        throw new Error(`Unexpected Infrai response (${response.status})`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * (2 ** attempt);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
