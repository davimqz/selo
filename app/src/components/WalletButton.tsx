"use client";

import { useSelectedWalletAccount } from "@solana/react";
import {
  type UiWallet,
  useConnect,
  useDisconnect,
} from "@wallet-standard/react";
import { useEffect, useRef, useState } from "react";
import { shortAddress } from "@/lib/invoice";

export function WalletButton() {
  const [account, setAccount, wallets] = useSelectedWalletAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`btn ${account ? "btn-ghost font-mono" : "btn-primary"}`}
        onClick={() => setOpen((o) => !o)}
      >
        {account ? shortAddress(account.address) : "Connect wallet"}
      </button>
      {open && (
        <div className="bg-paper absolute right-0 z-40 mt-2 w-72 rounded-xl p-2 shadow-[var(--shadow-raised)]">
          {wallets.length === 0 && (
            <p className="p-2 text-sm text-muted">
              No Solana wallet found. Install Phantom and reload.
            </p>
          )}
          {wallets.map((wallet) => (
            <WalletRow
              key={wallet.name}
              wallet={wallet}
              onPick={(a) => {
                setAccount(a);
                setOpen(false);
              }}
            />
          ))}
          {account && (
            <p className="mt-2 border-t border-line px-2 pt-2 text-xs text-muted">
              To act as another party, switch the account in your wallet and
              connect again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function WalletRow({
  wallet,
  onPick,
}: {
  wallet: UiWallet;
  onPick: (account: UiWallet["accounts"][number] | undefined) => void;
}) {
  const [connecting, connect] = useConnect(wallet);
  const [, disconnect] = useDisconnect(wallet);
  const connected = wallet.accounts.length > 0;

  return (
    <div className="rounded p-1">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-wash"
        disabled={connecting}
        onClick={async () => {
          const accounts = await connect().catch(() => []);
          if (accounts[0]) onPick(accounts[0]);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wallet.icon} alt="" className="h-5 w-5" />
        <span className="flex-1">{wallet.name}</span>
        <span className="text-xs text-muted">
          {connecting ? "…" : connected ? "Reconnect" : "Connect"}
        </span>
      </button>
      {wallet.accounts.map((a) => (
        <button
          key={a.address}
          type="button"
          className="block w-full rounded-md px-2 py-1.5 pl-9 text-left font-mono text-xs hover:bg-wash"
          onClick={() => onPick(a)}
        >
          {shortAddress(a.address)}
        </button>
      ))}
      {connected && (
        <button
          type="button"
          className="block w-full px-2 py-1 pl-9 text-left text-xs text-muted hover:text-ink"
          onClick={() => {
            onPick(undefined);
            disconnect().catch(() => {});
          }}
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
