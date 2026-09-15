export type OkxTicker = {
  symbol: string;
  price: number;
  observedAt: number;
  source: "OKX_MARKET_API";
};

type OkxTickerResponse = {
  code?: string;
  msg?: string;
  data?: Array<{ instId?: string; last?: string; ts?: string }>;
};

export async function fetchOkxTicker(symbol: string): Promise<OkxTicker> {
  if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(symbol)) throw new Error("invalid OKX instrument id");
  const dispatcher = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;
  const response = await fetch(
    `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(symbol)}`,
    { headers: { accept: "application/json", "user-agent": "RelayBond/0.1" }, dispatcher },
  );
  if (!response.ok) throw new Error(`OKX Market API returned HTTP ${response.status}`);
  const payload = (await response.json()) as OkxTickerResponse;
  const ticker = payload.data?.[0];
  const price = Number(ticker?.last);
  const timestamp = Number(ticker?.ts);
  if (payload.code !== "0" || !ticker || !Number.isFinite(price) || !Number.isFinite(timestamp)) {
    throw new Error(`invalid OKX ticker response: ${payload.msg || payload.code || "unknown"}`);
  }
  return {
    symbol: ticker.instId || symbol,
    price,
    observedAt: Math.floor(timestamp / 1000),
    source: "OKX_MARKET_API",
  };
}
import { fetch, ProxyAgent } from "undici";
