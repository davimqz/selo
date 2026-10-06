"use client";

import type { InvoiceCheck } from "@selo/sdk";
import { useState } from "react";
import { InvoiceLookup } from "@/components/InvoiceLookup";
import { InvoiceStatus } from "@/components/InvoiceStatus";

export default function VerifyPage() {
  const [check, setCheck] = useState<InvoiceCheck>();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Verify an invoice</h1>
        <p className="mt-1 max-w-2xl text-muted">
          The registry is public. Anyone can check whether an invoice is
          registered and whether it is already financed — no wallet needed.
        </p>
      </header>
      <InvoiceLookup onResult={(_, c) => setCheck(c)} />
      {check && <InvoiceStatus check={check} />}
    </div>
  );
}
