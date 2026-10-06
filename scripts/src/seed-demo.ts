/**
 * Prepares a cluster for the demo. Idempotent: every step checks on-chain
 * state first, so it is safe to run again before each recording.
 *
 *   1. USDC-dev mint (reused from scripts/.<cluster>.json when it exists).
 *   2. initialize: the payer (program upgrade authority) becomes admin; its
 *      USDC-dev account is the treasury; lock fee = LOCK_FEE whole tokens.
 *   3. Registers "Lender A" and "Lender B" (re-activates them if inactive).
 *   4. Tops both lenders up to 1,000 USDC-dev.
 *   5. Tops every demo wallet (lenders, supplier, buyer) up to 0.1 SOL.
 *
 * Usage:
 *   LENDER_A=<wallet> LENDER_B=<wallet> SUPPLIER=<wallet> BUYER=<wallet> \
 *     pnpm seed-demo
 *
 * Env: RPC_URL, WALLET_PATH (payer = upgrade authority), LOCK_FEE (default 1).
 */
import { type Address, address, lamports } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  fetchMaybeConfig,
  fetchMaybeLender,
  findConfigPda,
  findLenderPda,
  findProgramDataAddress,
  getInitializeInstructionAsync,
  getRegisterLenderInstructionAsync,
  getSetLenderActiveInstructionAsync,
} from "@selo/sdk";
import {
  cluster,
  loadKeypair,
  rpc,
  send,
  statePath,
  writeState,
  readState,
} from "./lib";
import {
  UNIT,
  ataOf,
  ensureFeeMint,
  fundPayerOnLocalnet,
  topUpTokens,
} from "./mint";

const LENDER_TOKENS = 1_000n * UNIT;
const WALLET_SOL = lamports(100_000_000n); // 0.1 SOL
const lockFee = BigInt(process.env.LOCK_FEE || "1") * UNIT;

function walletFromEnv(name: string): Address | undefined {
  const value = process.env[name]?.trim();
  return value ? address(value) : undefined;
}

export interface DemoWallets {
  lenderA: Address;
  lenderB: Address;
  supplier?: Address;
  buyer?: Address;
}

export async function seedDemo(
  { lenderA, lenderB, supplier, buyer }: DemoWallets,
  names: [string, string] = ["Lender A", "Lender B"],
  saveToState = true,
) {
  const admin = await loadKeypair();
  await fundPayerOnLocalnet(admin);
  const feeMint = await ensureFeeMint(admin);

  // initialize
  const [configPda] = await findConfigPda();
  const config = await fetchMaybeConfig(rpc, configPda);
  if (config.exists) {
    if (config.data.feeMint !== feeMint) {
      throw new Error(
        `Config already uses fee mint ${config.data.feeMint}, not ${feeMint}. ` +
          `Fix feeMint in ${statePath}.`,
      );
    }
    console.log(`Registry already initialized (admin ${config.data.admin})`);
  } else {
    await send(admin, [
      await getInitializeInstructionAsync({
        admin,
        feeMint,
        treasury: await ataOf(admin.address, feeMint),
        programData: await findProgramDataAddress(),
        lockFee,
      }),
    ]);
    console.log(`Initialized registry, lock fee ${lockFee / UNIT} USDC-dev`);
  }

  // lenders
  for (const [name, wallet] of [
    [names[0], lenderA],
    [names[1], lenderB],
  ] as const) {
    const [pda] = await findLenderPda({ lenderAuthority: wallet });
    const lender = await fetchMaybeLender(rpc, pda);
    if (!lender.exists) {
      await send(admin, [
        await getRegisterLenderInstructionAsync({
          admin,
          lenderAuthority: wallet,
          name,
        }),
      ]);
      console.log(`Registered ${name} (${wallet})`);
    } else {
      if (!lender.data.active) {
        await send(admin, [
          await getSetLenderActiveInstructionAsync({
            admin,
            lender: pda,
            active: true,
          }),
        ]);
        console.log(`Re-activated ${lender.data.name}`);
      }
      console.log(`${lender.data.name} already registered (${wallet})`);
    }
    const minted = await topUpTokens(admin, feeMint, wallet, LENDER_TOKENS);
    if (minted > 0n) console.log(`  + ${minted / UNIT} USDC-dev`);
  }

  // SOL for transaction fees and seal rent
  for (const wallet of [lenderA, lenderB, supplier, buyer]) {
    if (!wallet) continue;
    const { value } = await rpc.getBalance(wallet).send();
    if (value >= WALLET_SOL) continue;
    await send(admin, [
      getTransferSolInstruction({
        source: admin,
        destination: wallet,
        amount: lamports(WALLET_SOL - value),
      }),
    ]);
    console.log(`Topped ${wallet} up to 0.1 SOL`);
  }

  if (saveToState)
    writeState({
      ...readState(),
      config: configPda,
      lenderA,
      lenderB,
      ...(supplier && { supplier }),
      ...(buyer && { buyer }),
    });
  console.log(`Demo ready on ${cluster}. Fee mint: ${feeMint}`);
}

async function main() {
  const lenderA = walletFromEnv("LENDER_A");
  const lenderB = walletFromEnv("LENDER_B");
  if (!lenderA || !lenderB) {
    throw new Error("Set LENDER_A and LENDER_B to the two lenders' wallets.");
  }
  await seedDemo({
    lenderA,
    lenderB,
    supplier: walletFromEnv("SUPPLIER"),
    buyer: walletFromEnv("BUYER"),
  });
}

// Run only as a CLI, not when imported by e2e-demo.
if (process.argv[1] && /seed-demo\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
