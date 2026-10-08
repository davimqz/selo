"use client";

import type { InvoiceCheck } from "@selo/sdk";
import { useState } from "react";
import { InvoiceLookup } from "@/components/InvoiceLookup";
import { InvoiceStatus } from "@/components/InvoiceStatus";
import { PageHeader } from "@/components/PageHeader";

export default function VerifyPage() {
  const [check, setCheck] = useState<InvoiceCheck>();

  return (
    <div>
      <PageHeader title="Verify an invoice">
        The registry is public. Anyone can check whether an invoice is
        registered and whether it is already financed. No wallet needed.
      </PageHeader>
      <div className="space-y-6">
        <InvoiceLookup onResult={(_, c) => setCheck(c)} />
        {check && <InvoiceStatus check={check} />}
      </div>
    </div>
  );
}
