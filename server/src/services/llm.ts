import Groq from "groq-sdk";

export interface CandidateProductSummary {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

export interface BuyerSelectionPrompt {
  persona: {
    name: string;
    budget: number;
    goal: string;
    behavior: string;
  };
  candidates: CandidateProductSummary[];
}

export interface BuyerSelectionDecision {
  productId: string;
  reason: string;
}

export type LLMErrorCode =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "AUTH_ERROR"
  | "NOT_CONFIGURED"
  | "GENERIC_ERROR";

export class LLMError extends Error {
  public readonly code: LLMErrorCode;
  public readonly status?: number;
  public readonly friendlyReason: string;

  constructor(message: string, code: LLMErrorCode, status?: number, friendlyReason?: string) {
    super(message);
    this.name = "LLMError";
    this.code = code;
    this.status = status;
    this.friendlyReason = friendlyReason || message;
  }
}

export interface LLMDecisionResult {
  decision: BuyerSelectionDecision;
  provider: "groq";
  model: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}

class LLMSemaphore {
  private maxConcurrent = 2;
  private running = 0;
  private queue: Array<() => void> = [];

  public async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  public release(): void {
    this.running--;
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

export class LLMAdapter {
  private semaphore = new LLMSemaphore();
  private timeoutMs = 8000;
  private maxOutputTokens = 256;

  private getClient(): Groq | null {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      return new Groq({ apiKey: apiKey.trim(), timeout: this.timeoutMs });
    }
    return null;
  }

  public isAvailable(): boolean {
    const apiKey = process.env.GROQ_API_KEY;
    return !!apiKey && apiKey.trim().length > 0;
  }

  public getModel(): string {
    return process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  }

  public classifyError(err: any): LLMError {
    if (err instanceof LLMError) return err;

    const status = err?.status || err?.statusCode;
    const msg = err?.message || String(err);

    if (status === 429 || msg.includes("rate_limit") || msg.includes("429")) {
      return new LLMError(msg, "RATE_LIMIT", 429, "429 rate limit");
    }
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNABORTED")) {
      return new LLMError(msg, "TIMEOUT", 408, "timeout");
    }
    if (status >= 500 && status < 600) {
      return new LLMError(msg, "SERVER_ERROR", status, `server error ${status}`);
    }
    if (status === 401 || status === 403 || msg.includes("invalid_api_key")) {
      return new LLMError(msg, "AUTH_ERROR", status, "authentication error");
    }
    if (!process.env.GROQ_API_KEY) {
      return new LLMError("GROQ_API_KEY not configured", "NOT_CONFIGURED", undefined, "unconfigured API key");
    }

    return new LLMError(msg, "GENERIC_ERROR", status, "request failed");
  }

  /**
   * Compact, single-turn structured product selection.
   * Sends only the essential candidate products and persona criteria.
   * Strictly limits max_tokens to 256 to minimize Groq token budget.
   */
  public async selectProduct(
    input: BuyerSelectionPrompt
  ): Promise<LLMDecisionResult> {
    const client = this.getClient();
    if (!client) {
      throw new LLMError("GROQ_API_KEY is not configured", "NOT_CONFIGURED", undefined, "unconfigured API key");
    }

    const currentModel = this.getModel();

    // Construct ultra-compact JSON prompt
    const systemPrompt = `You are a shopping assistant selecting ONE product for a buyer.
Respond ONLY with a valid JSON object in this exact format:
{"productId":"<id>","reason":"<short reason under 15 words>"}
Do not include markdown fences or any other text.`;

    const userPayload = JSON.stringify({
      persona: {
        name: input.persona.name,
        budget: input.persona.budget,
        goal: input.persona.goal,
        behavior: input.persona.behavior,
      },
      candidates: input.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        stock: c.stock,
      })),
    });

    const estimatedInputTokens = Math.ceil((systemPrompt.length + userPayload.length) / 4);

    await this.semaphore.acquire();

    try {
      // For 429: no retries (fail immediately to fallback to avoid token storm)
      // For 5xx / timeout: at most 1 retry
      let lastError: any = null;

      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }

          const completion = await client.chat.completions.create({
            model: currentModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPayload },
            ],
            temperature: 0.1,
            max_tokens: this.maxOutputTokens,
            response_format: { type: "json_object" },
          });

          const content = completion.choices?.[0]?.message?.content;
          if (!content) {
            throw new LLMError("Empty response from Groq", "GENERIC_ERROR");
          }

          let parsed: any;
          try {
            parsed = JSON.parse(content.trim());
          } catch {
            // Regex fallback for non-strict JSON output
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              parsed = JSON.parse(match[0]);
            } else {
              throw new LLMError("Failed to parse JSON decision from Groq", "GENERIC_ERROR");
            }
          }

          if (!parsed.productId) {
            throw new LLMError("Missing productId in LLM decision", "GENERIC_ERROR");
          }

          // Validate that the chosen productId is actually in the candidate list
          const candidateMatch = input.candidates.find((c) => c.id === parsed.productId);
          if (!candidateMatch) {
            // Pick candidate by name match if productId was mangled
            const nameMatch = input.candidates.find((c) =>
              parsed.reason?.toLowerCase().includes(c.name.toLowerCase())
            );
            if (nameMatch) {
              parsed.productId = nameMatch.id;
            } else {
              // Default to first candidate
              parsed.productId = input.candidates[0].id;
            }
          }

          return {
            decision: {
              productId: parsed.productId,
              reason: String(parsed.reason || "Matches buyer persona specifications").slice(0, 120),
            },
            provider: "groq",
            model: currentModel,
            estimatedInputTokens,
            maxOutputTokens: this.maxOutputTokens,
          };
        } catch (err: any) {
          lastError = err;
          const classified = this.classifyError(err);

          // If rate limited or unconfigured, DO NOT retry — fail immediately to fallback
          if (classified.code === "RATE_LIMIT" || classified.code === "NOT_CONFIGURED" || classified.code === "AUTH_ERROR") {
            throw classified;
          }
        }
      }

      throw this.classifyError(lastError);
    } finally {
      this.semaphore.release();
    }
  }
}

export const llmAdapter = new LLMAdapter();
