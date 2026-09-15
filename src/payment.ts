export type PaymentChallenge = {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: "application/json" };
  accepts: Array<{
    scheme: "exact";
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
  }>;
};

export function createPaymentChallenge(baseUrl: string): PaymentChallenge {
  return {
    x402Version: 2,
    resource: {
      url: `${baseUrl}/v1/provider/quote`,
      description: "Bond-backed fresh market quote",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: process.env.X402_NETWORK || "eip155:1952",
        asset: process.env.USDT0_ADDRESS || "0x0000000000000000000000000000000000000000",
        amount: process.env.X402_PRICE_ATOMIC || "10000",
        payTo: process.env.X402_PAY_TO || "0x0000000000000000000000000000000000000000",
        maxTimeoutSeconds: 300,
      },
    ],
  };
}

export function encodePaymentRequired(challenge: PaymentChallenge): string {
  return Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
}
