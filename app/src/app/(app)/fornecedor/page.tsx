"use client";

import { type Address, isAddress } from "@solana/kit";
import { getSealInvoiceInstructionAsync, sealArgs } from "@selo/sdk";
import { useState } from "react";
import { InvoiceFields } from "@/components/InvoiceFields";
import { type OutcomeState, Outcome } from "@/components/Outcome";
import { PageHeader } from "@/components/PageHeader";
import { RequireWallet } from "@/components/RequireWallet";
import { SealList } from "@/components/SealList";
import { EMPTY_FORM, parseForm } from "@/lib/invoice";
import { readable, sendSeloTx } from "@/lib/tx";

export default function SupplierPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [buyer, setBuyer] = useState("");
  const [outcome, setOutcome] = useState<OutcomeState>({ kind: "idle" });
  const [refresh, setRefresh] = useState(0);
  const parsed = parseForm(form);
  const buyerOk = isAddress(buyer.trim());

  return (
    <div>
      <PageHeader step={1} title="Seal an invoice">
        Your browser turns the invoice into a canonical hash. Only the hash,
        amount, currency and due date go on-chain. The same invoice can be
        sealed only once, however it is typed.
      </PageHeader>

      <RequireWallet role="supplier">
        {(signer, account) => (
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
                onClick={async () => {
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
                    setOutcome({
                      kind: "ok",
                      text: "Invoice sealed. No one else can register it again.",
                      signature,
                    });
                    setRefresh((n) => n + 1);
                  } catch (err) {
                    setOutcome({ kind: "rejected", text: readable(err) });
                  }
                }}
              >
                Seal invoice
              </button>
              <Outcome state={outcome} />
            </section>

            <section className="mt-10 space-y-3">
              <h2 className="text-lg font-semibold">Your seals</h2>
              <SealList
                by={{ supplier: account.address as Address }}
                refresh={refresh}
              />
            </section>
          </>
        )}
      </RequireWallet>
    </div>
  );
}
