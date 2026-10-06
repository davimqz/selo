/**
 * Sends a Selo transaction from a browser wallet. The transaction is first
 * simulated against the program, so a rejection (duplicate seal, invoice
 * already financed) comes back as a readable message before the wallet ever
 * asks the user to sign. No raw Anchor error reaches the UI.
 */
import {
  type Instruction,
  type TransactionSigner,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SolanaError,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { type Invoice, explainError } from "@selo/sdk";
import { rpc } from "./config";

export class ReadableError extends Error {}

type InvoiceRef = Invoice | string;

/** The custom program error in a simulation/transaction error, if any. */
function customCode(err: unknown): number | undefined {
  const ix = (err as { InstructionError?: [unknown, unknown] })
    ?.InstructionError;
  const custom = (ix?.[1] as { Custom?: number | bigint } | undefined)?.Custom;
  return custom === undefined ? undefined : Number(custom);
}

async function fail(err: unknown, invoice?: InvoiceRef): Promise<never> {
  if (err === "AccountNotFound" || err === "InsufficientFundsForFee") {
    throw new ReadableError(
      "This wallet has no devnet SOL to pay the network fee.",
    );
  }
  const code = customCode(err);
  const asKit =
    code === undefined
      ? err
      : new SolanaError(SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM, {
          code,
          index: 0,
        });
  throw new ReadableError(
    await explainError(asKit, invoice ? { rpc, invoice } : undefined),
  );
}

export async function sendSeloTx(
  signer: TransactionSigner,
  instructions: Instruction[],
  invoice?: InvoiceRef,
): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );

  // 1. Ask the program first: an invalid action never reaches the wallet.
  const simulation = await rpc
    .simulateTransaction(
      getBase64EncodedWireTransaction(compileTransaction(message)),
      { encoding: "base64", replaceRecentBlockhash: true, sigVerify: false },
    )
    .send();
  if (simulation.value.err) await fail(simulation.value.err, invoice);

  // 2. Sign in the wallet and send through our RPC.
  let signature: string;
  try {
    const signed = await signTransactionMessageWithSigners(message);
    signature = getSignatureFromTransaction(signed);
    await rpc
      .sendTransaction(getBase64EncodedWireTransaction(signed), {
        encoding: "base64",
        preflightCommitment: "confirmed",
      })
      .send();
  } catch (err) {
    throw new ReadableError(
      await explainError(err, invoice ? { rpc, invoice } : undefined),
    );
  }

  // 3. Wait for confirmation (about a second on devnet).
  for (let i = 0; i < 60; i++) {
    const { value } = await rpc
      .getSignatureStatuses([signature as never])
      .send();
    const status = value[0];
    if (status?.err) await fail(status.err, invoice);
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return signature;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new ReadableError(
    "The network did not confirm the transaction in time. Check again in a moment.",
  );
}

export function readable(err: unknown): string {
  if (err instanceof ReadableError) return err.message;
  console.error(err);
  return "Something went wrong. Please try again.";
}
