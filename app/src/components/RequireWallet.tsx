"use client";

import type { TransactionModifyingSigner } from "@solana/kit";
import {
  useSelectedWalletAccount,
  useWalletAccountTransactionSigner,
} from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { CHAIN } from "@/lib/config";

type Render = (
  signer: TransactionModifyingSigner,
  account: UiWalletAccount,
) => React.ReactNode;

/** Renders children with a signer for the selected wallet account. */
export function RequireWallet({
  children,
  role,
}: {
  children: Render;
  role: string;
}) {
  const [account] = useSelectedWalletAccount();
  if (!account) {
    return (
      <div className="card text-sm text-muted">
        Connect the {role}&apos;s wallet (top right) to continue.
      </div>
    );
  }
  return (
    <WithSigner key={account.address} account={account}>
      {children}
    </WithSigner>
  );
}

function WithSigner({
  account,
  children,
}: {
  account: UiWalletAccount;
  children: Render;
}) {
  const signer = useWalletAccountTransactionSigner(account, CHAIN);
  return <>{children(signer, account)}</>;
}
