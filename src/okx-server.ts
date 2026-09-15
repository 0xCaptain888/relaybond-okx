import { createOkxApp } from "./okx-app.js";

const port = Number(process.env.PORT || 8787);
const network = process.env.X402_NETWORK || "eip155:1952";
createOkxApp().listen(port, () => {
  console.log(`RelayBond official OKX x402 endpoint listening on ${port} (${network})`);
});
