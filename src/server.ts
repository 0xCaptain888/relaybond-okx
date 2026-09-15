import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createJudgeEvidence } from "./simulator.js";
import { createPaymentChallenge, encodePaymentRequired } from "./payment.js";
import { verifyDelivery, type VerificationInput } from "./verifier.js";

const port = Number(process.env.PORT || 8787);
const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

function json(response: ServerResponse, status: number, body: unknown, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body, null, 2));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type,payment-signature,x-payment");
  if (request.method === "OPTIONS") return json(response, 204, {});

  try {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { status: "ok", service: "relaybond", phase: "local-foundation" });
    }
    if (request.method === "GET" && request.url === "/v1/demo") {
      return json(response, 200, await createJudgeEvidence());
    }
    if (request.method === "POST" && request.url === "/v1/verify") {
      const body = (await readBody(request)) as VerificationInput;
      return json(response, 200, await verifyDelivery(body));
    }
    if (request.method === "POST" && request.url === "/v1/provider/quote") {
      const payment = request.headers["payment-signature"] || request.headers["x-payment"];
      if (!payment) {
        const challenge = createPaymentChallenge(baseUrl);
        return json(response, 402, challenge, {
          "payment-required": encodePaymentRequired(challenge),
        });
      }
      return json(response, 501, {
        error: "LIVE_PAYMENT_VERIFIER_NOT_CONFIGURED",
        message: "A payment header was received but this local foundation build will not pretend it was verified.",
        next: "Configure the official OKX Payment SDK adapter before public deployment.",
      });
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    return json(response, 400, {
      error: "invalid_request",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, () => {
  console.log(`RelayBond API listening at ${baseUrl}`);
});
