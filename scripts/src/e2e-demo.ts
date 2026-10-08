/**
 * Runs the five demo moments (CLAUDE.md section 2) against a real cluster
 * through the app's own transaction code (app/src/lib/tx.ts): simulate first,
 * sign, send, confirm, and translate rejections. The browser adds only the
 * wallet popup on top of this path.
 *
 * Uses four throwaway keypairs saved in scripts/wallets/<cluster>/ (gitignored)
 * and registers them as "E2E Lender A/B" so they never mix with the demo's
 * Phantom lenders. Each run uses a fresh invoice number, so it can run again.
 *
 * Usage: pnpm e2e-demo [runs]     (default 1)
 * Env: RPC_URL, WALLET_PATH (admin = upgrade authority).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type KeyPairSigner, generateKeyPairSigner } from "@solana/kit";
import {
  type Invoice,
  checkInvoice,
  fetchConfig,
  findBuyerRecordByTaxId,
  findConfigPda,
  getAttestInvoiceInstruction,
  getLockInvoiceInstructionAsync,
  getSealInvoiceInstructionAsync,
  listSeals,
  sealArgs,
} from "@selo/sdk";
import { cluster, loadKeypair, rpc, rpcUrl } from "./lib";
import { ataOf } from "./mint";
import { seedDemo } from "./seed-demo";

/** The e2e buyer's company: never the app's sample one, which the demo buyer holds. */
const E2E_BUYER = { taxId: "E2E BUYER 001", name: "E2E Buyer" };

// The app reads its RPC from NEXT_PUBLIC_RPC_URL; point it at ours.
process.env.NEXT_PUBLIC_RPC_URL = rpcUrl;
const { sendSeloTx, readable } = await import("../../app/src/lib/tx");

const walletsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "wallets",
  cluster,
);

async function wallet(name: string): Promise<KeyPairSigner> {
  const file = join(walletsDir, `${name}.json`);
  if (!existsSync(file)) {
    mkdirSync(walletsDir, { recursive: true });
    const signer = await generateKeyPairSigner(true);
    const secret = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", signer.keyPair.privateKey),
    ).slice(-32);
    const pub = new Uint8Array(
      await crypto.subtle.exportKey("raw", signer.keyPair.publicKey),
    );
    writeFileSync(file, JSON.stringify([...secret, ...pub]));
  }
  return loadKeypair(file);
}

function check(cond: unknown, what: string) {
  if (!cond) throw new Error(`FAILED: ${what}`);
  console.log(`  ok  ${what}`);
}

async function expectRejected(p: Promise<unknown>, pattern: RegExp) {
  try {
    await p;
  } catch (err) {
    const message = readable(err);
    console.log(`      → "${message}"`);
    return pattern.test(message);
  }
  return false;
}

async function runOnce(
  run: number,
  w: Record<"supplier" | "buyer" | "lenderA" | "lenderB", KeyPairSigner>,
) {
  const config = await fetchConfig(rpc, (await findConfigPda())[0]);
  const stamp = Date.now().toString(36).toUpperCase();
  const due = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const invoice: Invoice = {
    supplierTaxId: "DE 811 907 980",
    buyerTaxId: E2E_BUYER.taxId,
    number: `E2E-${stamp}`,
    amount: "1250000",
    currency: "USD",
    dueDate: due,
  };
  console.log(`\nRun ${run}: invoice ${invoice.number}`);

  // 1. Supplier seals.
  check(
    (await checkInvoice(rpc, invoice)).status === "free",
    "invoice is free",
  );
  await sendSeloTx(
    w.supplier,
    [
      await getSealInvoiceInstructionAsync({
        supplier: w.supplier,
        buyer: w.buyer.address,
        ...sealArgs(invoice),
      }),
    ],
    invoice,
  );
  const sealed = await checkInvoice(rpc, invoice);
  check(sealed.status === "sealed", "1. supplier sealed it");
  const mine = await listSeals(rpc, { supplier: w.supplier.address });
  check(
    mine.some((s) => s.address === sealed.seal),
    "   listed under the supplier",
  );

  // 2. Buyer attests.
  const toAttest = await listSeals(rpc, { buyer: w.buyer.address });
  check(
    toAttest.some((s) => s.address === sealed.seal),
    "   listed under the buyer",
  );
  const buyerRecord = await findBuyerRecordByTaxId(invoice.buyerTaxId);
  await sendSeloTx(w.buyer, [
    getAttestInvoiceInstruction({
      buyer: w.buyer,
      seal: sealed.seal,
      buyerRecord,
    }),
  ]);
  const attested = await checkInvoice(rpc, invoice);
  check(
    attested.attested && attested.buyer?.verification === "verified",
    "2. verified buyer attested it",
  );

  // 3. Lender A checks and locks.
  const lock = async (lender: KeyPairSigner) =>
    sendSeloTx(
      lender,
      [
        await getLockInvoiceInstructionAsync({
          lenderAuthority: lender,
          seal: sealed.seal,
          buyerRecord,
          feeMint: config.data.feeMint,
          lenderToken: await ataOf(lender.address, config.data.feeMint),
          treasury: config.data.treasury,
        }),
      ],
      invoice,
    );
  await lock(w.lenderA);
  const locked = await checkInvoice(rpc, invoice);
  check(
    locked.status === "locked" && locked.lender?.name === "E2E Lender A",
    "3. lender A locked it",
  );

  // 4. Lender B is rejected and told who financed it and when.
  check(
    await expectRejected(
      lock(w.lenderB),
      /^Already financed by E2E Lender A on \d{2} \w{3} \d{4}\./,
    ),
    "4. lender B rejected with lender name and date",
  );

  // 5. The same invoice typed differently is rejected.
  const retyped: Invoice = {
    ...invoice,
    supplierTaxId: "de811907980",
    buyerTaxId: "e2e-buyer-001",
    number: `  e2e-${stamp.toLowerCase()} `,
  };
  check(
    await expectRejected(
      (async () =>
        sendSeloTx(
          w.supplier,
          [
            await getSealInvoiceInstructionAsync({
              supplier: w.supplier,
              buyer: w.buyer.address,
              ...sealArgs(retyped),
            }),
          ],
          retyped,
        ))(),
      /already registered in Selo/,
    ),
    "5. re-typed duplicate seal rejected",
  );
}

async function main() {
  const runs = Number(process.argv[2] || "1");
  const w = {
    supplier: await wallet("supplier"),
    buyer: await wallet("buyer"),
    lenderA: await wallet("lenderA"),
    lenderB: await wallet("lenderB"),
  };
  await loadKeypair(); // admin must exist
  await seedDemo(
    {
      lenderA: w.lenderA.address,
      lenderB: w.lenderB.address,
      supplier: w.supplier.address,
      buyer: w.buyer.address,
    },
    ["E2E Lender A", "E2E Lender B"],
    false,
    E2E_BUYER,
  );
  for (let i = 1; i <= runs; i++) await runOnce(i, w);
  console.log(`\nAll ${runs} run(s) passed on ${cluster}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
