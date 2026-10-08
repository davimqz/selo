"use client";

import type { Address, TransactionSigner } from "@solana/kit";
import {
  useSelectedWalletAccount,
  useWalletAccountTransactionSigner,
} from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { Fragment } from "react";
import { CHAIN } from "@/lib/config";
import { useDemo } from "./Demo";

type Render = (signer: TransactionSigner, address: Address) => React.ReactNode;

/**
 * Renders children with a signer: the selected wallet account, or the demo
 * wallet for this role when demo mode is on.
 */
export function RequireWallet({
  children,
  role,
}: {
  children: Render;
  role: string;
}) {
  const [account] = useSelectedWalletAccount();
  const demo = useDemo();
  if (demo.active) {
    const { signer } = demo.active;
    return (
      <Fragment key={signer.address}>
        {children(signer, signer.address)}
      </Fragment>
    );
  }
  if (!account) {
    return (
      <div className="card flex flex-col items-start gap-1 text-sm">
        <span className="font-medium">Connect a wallet to continue</span>
        <span className="text-muted">
          Use the {role}&apos;s wallet, with Phantom set to Solana Devnet. The
          Connect wallet button is at the top right.
        </span>
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
  return <>{children(signer, account.address as Address)}</>;
}
