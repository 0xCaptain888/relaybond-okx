export type OfficialV2Settlement = {
  mode: "XLAYER_TESTNET";
  status: "SETTLED_AND_VERIFIED";
  chainId: 1952;
  contract: `0x${string}`;
  token: `0x${string}`;
  transactionHash: `0x${string}`;
  explorer: string;
  blockNumber: string;
  recoveryAmountAtomic: string;
  buyer: `0x${string}`;
  primaryProvider: `0x${string}`;
  backupProvider: `0x${string}`;
  balancesBefore: { buyerAtomic: string; backupAtomic: string; primaryBondAtomic: string };
  balancesAfter: { buyerAtomic: string; backupAtomic: string; primaryBondAtomic: string };
  primaryActiveAfter: boolean;
  checks: Record<string, boolean>;
};

export const officialV2Settlement: OfficialV2Settlement = {
  mode: "XLAYER_TESTNET",
  status: "SETTLED_AND_VERIFIED",
  chainId: 1952,
  contract: "0xBa15362E3B52eAD97bB5bD5ce849D73376b8b73f",
  token: "0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c",
  transactionHash: "0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99",
  explorer: "https://www.okx.com/web3/explorer/xlayer-test/tx/0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99",
  blockNumber: "41181054",
  recoveryAmountAtomic: "10000",
  buyer: "0xcb83AF485c066add3eca9041a78Ea7c14e3F15F4",
  primaryProvider: "0x917b04d30478E9405445CfF208eaA9d61e2EC44d",
  backupProvider: "0x3d5462243c7c69914Bfa0d2d4089cef79482ee03",
  balancesBefore: { buyerAtomic: "10000", backupAtomic: "7000000", primaryBondAtomic: "5000000" },
  balancesAfter: { buyerAtomic: "10000", backupAtomic: "7010000", primaryBondAtomic: "4990000" },
  primaryActiveAfter: false,
  checks: {
    receiptSucceeded: true,
    requestMarkedRecovered: true,
    buyerBalanceUnchanged: true,
    backupPaidExactly: true,
    primaryBondDebitedExactly: true,
    primaryActivityMatchesMinimum: true,
    recoveryEventBound: true,
  },
};
