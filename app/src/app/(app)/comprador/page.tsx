"use client";

import type { Address } from "@solana/kit";
import {
  type SealEntry,
  SealStatus,
  getAttestInvoiceInstruction,
} from "@selo/sdk";
import { useState } from "react";
import { type OutcomeState, Outcome } from "@/components/Outcome";
import { PageHeader } from "@/components/PageHeader";
import { RequireWallet } from "@/components/RequireWallet";
import { SealList } from "@/components/SealList";
import { readable, sendSeloTx } from "@/lib/tx";

export default function BuyerPage() {
  const [outcome, setOutcome] = useState<OutcomeState>({ kind: "idle" });

  return (
    <div>
      <PageHeader step={2} title="Invoices addressed to you">
        Attest that an invoice is real and due. Lenders can only finance
        invoices their buyer has attested.
      </PageHeader>

      <RequireWallet role="buyer">
        {(signer, account) => (
          <section className="space-y-4">
            <SealList
              by={{ buyer: account.address as Address }}
              action={(seal: SealEntry, reload) =>
                !seal.data.buyerAttested &&
                (seal.data.status === SealStatus.Sealed ||
                  seal.data.status === SealStatus.Locked) && (
                  <button
                    type="button"
                    className="btn btn-primary px-3 py-1 text-sm"
                    disabled={outcome.kind === "busy"}
                    onClick={async () => {
                      setOutcome({ kind: "busy", text: "Attesting…" });
                      try {
                        const signature = await sendSeloTx(signer, [
                          getAttestInvoiceInstruction({
                            buyer: signer,
                            seal: seal.address,
                          }),
                        ]);
                        setOutcome({
                          kind: "ok",
                          text: "Attested. Lenders now see this invoice as confirmed by its buyer.",
                          signature,
                        });
                        reload();
                      } catch (err) {
                        setOutcome({ kind: "rejected", text: readable(err) });
                      }
                    }}
                  >
                    Attest
                  </button>
                )
              }
            />
            <Outcome state={outcome} />
          </section>
        )}
      </RequireWallet>
    </div>
  );
}
