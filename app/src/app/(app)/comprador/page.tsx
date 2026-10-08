"use client";

import type { Address, TransactionSigner } from "@solana/kit";
import {
  type SealEntry,
  SealStatus,
  getAttestInvoiceInstruction,
  listBuyerRecords,
} from "@selo/sdk";
import { useEffect, useState } from "react";
import { type OutcomeState, Outcome } from "@/components/Outcome";
import { PageHeader } from "@/components/PageHeader";
import { RequireWallet } from "@/components/RequireWallet";
import { SealList } from "@/components/SealList";
import { rpc } from "@/lib/config";
import { readable, sendSeloTx } from "@/lib/tx";

interface Identity {
  record: Address;
  name: string;
}

/** The wallet's active verified identity, null if none, undefined while loading. */
function useBuyerIdentity(wallet?: Address) {
  const [identity, setIdentity] = useState<Identity | null>();
  useEffect(() => {
    if (!wallet) return;
    let live = true;
    listBuyerRecords(rpc, wallet)
      .then((records) => {
        const active = records.find((r) => r.data.active);
        if (live)
          setIdentity(
            active ? { record: active.address, name: active.data.name } : null,
          );
      })
      .catch(() => live && setIdentity(null));
    return () => {
      live = false;
    };
  }, [wallet]);
  return identity;
}

function IdentityCard({ identity }: { identity: Identity | null | undefined }) {
  if (identity === undefined) {
    return <div className="card text-muted py-4 text-sm">Loading…</div>;
  }
  return (
    <div className="card py-4 text-sm">
      <span className="text-muted block text-xs">Verified identity</span>
      {identity ? (
        <strong className="text-free">{identity.name}</strong>
      ) : (
        <span className="text-stamp">
          This wallet is not verified as a company in Selo, so it cannot attest.
          Only wallets that passed identity verification (KYB) can.
        </span>
      )}
    </div>
  );
}

export default function BuyerPage() {
  return (
    <div>
      <PageHeader step={2} title="Invoices addressed to you">
        Attest that an invoice is real and due. Lenders can only finance
        invoices their buyer has attested, and only a buyer whose identity Selo
        verified can attest.
      </PageHeader>

      <RequireWallet role="buyer">
        {(signer, address) => <BuyerDesk signer={signer} address={address} />}
      </RequireWallet>
    </div>
  );
}

function BuyerDesk({
  signer,
  address,
}: {
  signer: TransactionSigner;
  address: Address;
}) {
  const [outcome, setOutcome] = useState<OutcomeState>({ kind: "idle" });
  const identity = useBuyerIdentity(address);

  return (
    <section className="space-y-4">
      <IdentityCard identity={identity} />
      <SealList
        by={{ buyer: address }}
        action={(seal: SealEntry, reload) =>
          !seal.data.buyerAttested &&
          (seal.data.status === SealStatus.Sealed ||
            seal.data.status === SealStatus.Locked) && (
            <button
              type="button"
              className="btn btn-primary px-3 py-1 text-sm"
              disabled={!identity || outcome.kind === "busy"}
              onClick={async () => {
                if (!identity) return;
                setOutcome({ kind: "busy", text: "Attesting…" });
                try {
                  const signature = await sendSeloTx(signer, [
                    getAttestInvoiceInstruction({
                      buyer: signer,
                      seal: seal.address,
                      buyerRecord: identity.record,
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
  );
}
