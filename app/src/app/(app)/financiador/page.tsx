"use client";

import type { Address, TransactionSigner } from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMaybeToken,
  findAssociatedTokenPda,
} from "@solana-program/token";
import {
  type InvoiceCheck,
  USDC_DECIMALS,
  checkInvoice,
  fetchConfig,
  fetchMaybeLender,
  findBuyerRecordByTaxId,
  findConfigPda,
  findLenderPda,
  getLockInvoiceInstructionAsync,
} from "@selo/sdk";
import { useEffect, useState } from "react";
import { InvoiceLookup, type InvoiceRef } from "@/components/InvoiceLookup";
import { InvoiceStatus } from "@/components/InvoiceStatus";
import { type OutcomeState, Outcome } from "@/components/Outcome";
import { PageHeader } from "@/components/PageHeader";
import { RequireWallet } from "@/components/RequireWallet";
import { rpc } from "@/lib/config";
import { readable, sendSeloTx } from "@/lib/tx";

export default function LenderPage() {
  return (
    <div>
      <PageHeader step={3} title="Check before you finance">
        Look the invoice up in Selo. If it is free and attested by its buyer,
        lock it: from then on every other lender sees it as financed by you, and
        their lock is rejected.
      </PageHeader>
      <RequireWallet role="lender">
        {(signer, address) => <LenderDesk signer={signer} wallet={address} />}
      </RequireWallet>
    </div>
  );
}

interface Desk {
  name?: string;
  active: boolean;
  balance: bigint;
  fee: bigint;
  feeMint: Address;
  treasury: Address;
  token: Address;
}

const UNIT = 10 ** USDC_DECIMALS;
const usdcDev = (v: bigint) =>
  `${(Number(v) / UNIT).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC-dev`;

function LenderDesk({
  signer,
  wallet,
}: {
  signer: TransactionSigner;
  wallet: Address;
}) {
  const [desk, setDesk] = useState<Desk | null>();
  const [lookup, setLookup] = useState<{
    ref: InvoiceRef;
    check: InvoiceCheck;
  }>();
  const [outcome, setOutcome] = useState<OutcomeState>({ kind: "idle" });

  const [deskVersion, setDeskVersion] = useState(0);
  const loadDesk = () => setDeskVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    readDesk(wallet).then((d) => live && setDesk(d));
    return () => {
      live = false;
    };
  }, [wallet, deskVersion]);

  async function lock() {
    if (!lookup || !desk || typeof lookup.ref === "string") return;
    setOutcome({ kind: "busy", text: "Locking…" });
    try {
      const signature = await sendSeloTx(
        signer,
        [
          await getLockInvoiceInstructionAsync({
            lenderAuthority: signer,
            seal: lookup.check.seal,
            // The verified company named on the invoice: the program checks
            // it is the wallet that attested.
            buyerRecord: await findBuyerRecordByTaxId(lookup.ref.buyerTaxId),
            feeMint: desk.feeMint,
            lenderToken: desk.token,
            treasury: desk.treasury,
          }),
        ],
        lookup.ref,
      );
      setOutcome({
        kind: "ok",
        text: `Locked. This invoice is now registered as financed by ${desk.name}.`,
        signature,
      });
    } catch (err) {
      setOutcome({ kind: "rejected", text: readable(err) });
    }
    setLookup({ ref: lookup.ref, check: await checkInvoice(rpc, lookup.ref) });
    loadDesk();
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-x-10 gap-y-3 py-4 text-sm">
        {desk === undefined && <span className="text-muted">Loading…</span>}
        {desk === null && (
          <span className="text-stamp">
            Could not read the registry configuration.
          </span>
        )}
        {desk && (
          <>
            <span>
              <span className="text-muted block text-xs">Lender</span>
              {desk.name ? (
                <strong>{desk.name}</strong>
              ) : (
                <span className="text-stamp">not registered in Selo</span>
              )}
              {desk.name && !desk.active && (
                <span className="text-stamp"> (inactive)</span>
              )}
            </span>
            <span>
              <span className="text-muted block text-xs">Balance</span>
              {usdcDev(desk.balance)}
            </span>
            <span>
              <span className="text-muted block text-xs">
                Lock fee per invoice
              </span>
              {usdcDev(desk.fee)}
            </span>
          </>
        )}
      </div>

      <InvoiceLookup
        onResult={(ref, check) => {
          setLookup({ ref, check });
          setOutcome({ kind: "idle" });
        }}
      />

      {lookup && (
        <section className="space-y-4">
          <InvoiceStatus check={lookup.check} />
          {lookup.check.status !== "free" && typeof lookup.ref === "string" && (
            <p className="text-muted text-sm">
              To finance, look the invoice up by its data: the lock checks the
              buyer&apos;s verified identity against the tax ID on the invoice.
            </p>
          )}
          {lookup.check.status !== "free" && typeof lookup.ref !== "string" && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!desk || outcome.kind === "busy"}
              onClick={lock}
            >
              Finance (lock invoice)
            </button>
          )}
          <Outcome state={outcome} />
        </section>
      )}
    </div>
  );
}

async function readDesk(wallet: Address): Promise<Desk | null> {
  try {
    const config = await fetchConfig(rpc, (await findConfigPda())[0]);
    const [lenderPda] = await findLenderPda({ lenderAuthority: wallet });
    const lender = await fetchMaybeLender(rpc, lenderPda);
    const [token] = await findAssociatedTokenPda({
      owner: wallet,
      mint: config.data.feeMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const account = await fetchMaybeToken(rpc, token);
    return {
      name: lender.exists ? lender.data.name : undefined,
      active: lender.exists && lender.data.active,
      balance: account.exists ? account.data.amount : 0n,
      fee: config.data.lockFee,
      feeMint: config.data.feeMint,
      treasury: config.data.treasury,
      token,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
