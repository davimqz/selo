"use client";

import { type Address, type TransactionSigner, isAddress } from "@solana/kit";
import { getSealInvoiceInstructionAsync, sealArgs } from "@selo/sdk";
import { useState } from "react";
import { useDemo } from "@/components/Demo";
import { InvoiceFields } from "@/components/InvoiceFields";
import { type OutcomeState, Outcome } from "@/components/Outcome";
import { PageHeader } from "@/components/PageHeader";
import { RequireWallet } from "@/components/RequireWallet";
import { SealList } from "@/components/SealList";
import { EMPTY_FORM, parseForm } from "@/lib/invoice";
import { readable, sendSeloTx } from "@/lib/tx";

export default function SupplierPage() {
  return (
    <div>
      <PageHeader step={1} title="Seal an invoice">
        Your browser turns the invoice into a canonical hash. Only the hash,
        amount, currency and due date go on-chain. The same invoice can be
        sealed only once, however it is typed.
      </PageHeader>

      <RequireWallet role="supplier">
        {(signer, address) => (
          <SupplierDesk signer={signer} address={address} />
        )}
      </RequireWallet>
    </div>
  );
}

function SupplierDesk({
  signer,
  address,
}: {
  signer: TransactionSigner;
  address: Address;
}) {
  const demo = useDemo();
  const [form, setForm] = useState(EMPTY_FORM);
  const [buyer, setBuyer] = useState(
    () => (demo.active && demo.wallet("buyer")?.signer.address) || "",
  );
  const [outcome, setOutcome] = useState<OutcomeState>({ kind: "idle" });
  const [refresh, setRefresh] = useState(0);
  const parsed = parseForm(form);
  const buyerOk = isAddress(buyer.trim());

  async function seal() {
    if (!parsed.ok) return;
    setOutcome({ kind: "busy", text: "Sealing…" });
    try {
      const signature = await sendSeloTx(
        signer,
        [
          await getSealInvoiceInstructionAsync({
            supplier: signer,
            buyer: buyer.trim() as Address,
            ...sealArgs(parsed.invoice),
          }),
        ],
        parsed.invoice,
      );
      if (demo.active) demo.remember(form);
      setOutcome({
        kind: "ok",
        text: "Invoice sealed. No one else can register it again.",
        signature,
      });
      setRefresh((n) => n + 1);
    } catch (err) {
      setOutcome({ kind: "rejected", text: readable(err) });
    }
  }

  return (
    <>
      <section className="card space-y-4">
        <InvoiceFields
          form={form}
          parsed={parsed}
          onChange={(f) => {
            setForm(f);
            setOutcome({ kind: "idle" });
          }}
        />
        <label className="field">
          Buyer&apos;s wallet (the buyer will attest the invoice)
          <input
            className="font-mono"
            value={buyer}
            placeholder="Buyer's Solana address"
            spellCheck={false}
            onChange={(e) => setBuyer(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!parsed.ok || !buyerOk || outcome.kind === "busy"}
          onClick={seal}
        >
          Seal invoice
        </button>
        <Outcome state={outcome} />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">Your seals</h2>
        <SealList by={{ supplier: address }} refresh={refresh} />
      </section>
    </>
  );
}
