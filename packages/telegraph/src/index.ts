// Telegraph client: drives the official MCP server (@telegraphprotocol/telegraph-protocol-mcp)
// over stdio, so escrow signing / x402 is handled by Telegraph's own code.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const FORECAST_INTENT = "WEATHER_FORECAST_GENERAL";

export interface AskResult {
  answer: unknown;
  intent?: string;
  miner?: unknown;
  cost_usd?: number;
  payment?: unknown;
  warnings?: unknown;
  [k: string]: unknown;
}

export interface Receipt {
  id: string;
  time: string;
  tool: string;
  intent: string;
  params: Record<string, unknown>;
  miner: unknown;
  cost_usd: number | null;
  payment: unknown;
  response_sha256: string;
  response: AskResult;
}

export class TelegraphClient {
  private client = new Client({ name: "workable", version: "0.1.0" });
  private connected = false;

  constructor(private receiptsDir = "data/receipts") {}

  async connect() {
    if (this.connected) return;
    const isWin = process.platform === "win32";
    const transport = new StdioClientTransport({
      command: isWin ? "npx.cmd" : "npx",
      args: ["-y", "@telegraphprotocol/telegraph-protocol-mcp"],
      env: { ...process.env } as Record<string, string>,
    });
    await this.client.connect(transport);
    this.connected = true;
  }

  async close() {
    if (this.connected) await this.client.close();
    this.connected = false;
  }

  /** Call an MCP tool and parse its JSON text output. */
  async call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.connect();
    const res: any = await this.client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
    const text = (res.content ?? []).map((c: any) => c.text ?? "").join("");
    if (res.isError) throw new Error(`${name} failed: ${text}`);
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  }

  findIntents(search?: string) { return this.call("telegraph_find_intents", search ? { search, limit: 50 } : { limit: 200 }); }
  intent(intent: string) { return this.call("telegraph_intent", { intent }); }
  findMiners(intent: string) { return this.call("telegraph_find_miners", { intent }); }
  account() { return this.call("telegraph_account"); }

  /** Paid, autonomous purchase. Saves a receipt for every successful answer. */
  async ask(intent: string, params: Record<string, unknown>, miner?: string): Promise<Receipt> {
    const tool = miner ? "telegraph_ask_miner" : "telegraph_ask";
    const args: Record<string, unknown> = { intent, params };
    if (miner) args.miner = miner;
    const response = await this.call<AskResult>(tool, args);
    const receipt: Receipt = {
      id: randomUUID(),
      time: new Date().toISOString(),
      tool, intent, params,
      // Key mode returns the miner and on-chain receipt hash inside sources[].
      miner: response.miner ?? (response as any).sources?.map((s: any) => ({ ...s.miner, receiptHash: s.receiptHash })) ?? miner ?? null,
      cost_usd: typeof response.cost_usd === "number" ? response.cost_usd : null,
      payment: response.payment ?? null,
      response_sha256: createHash("sha256").update(JSON.stringify(response)).digest("hex"),
      response,
    };
    mkdirSync(this.receiptsDir, { recursive: true });
    writeFileSync(join(this.receiptsDir, `${receipt.time.replace(/[:.]/g, "-")}_${receipt.id}.json`), JSON.stringify(receipt, null, 2));
    return receipt;
  }
}

export function loadReceipts(dir = "data/receipts"): Receipt[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  } catch { return []; }
}
