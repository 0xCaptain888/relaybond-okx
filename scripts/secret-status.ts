const required = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "X402_PAY_TO"] as const;
const status = Object.fromEntries(required.map((name) => [name, Boolean(process.env[name])]));
console.log(JSON.stringify({
  configured: required.every((name) => Boolean(process.env[name])),
  fields: status,
  note: "Values are intentionally never printed.",
}, null, 2));
