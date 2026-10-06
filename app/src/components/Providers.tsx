"use client";

import { SelectedWalletAccountContextProvider } from "@solana/react";
import { SolanaSignTransaction } from "@solana/wallet-standard-features";
import type { UiWallet } from "@wallet-standard/react";

const STORAGE_KEY = "selo:selected-wallet-account";

const stateSync = {
  getSelectedWallet: () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  storeSelectedWallet: (key: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {}
  },
  deleteSelectedWallet: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
};

/** Only wallets that can sign Solana transactions (Phantom, Solflare, ...). */
const filterWallets = (wallet: UiWallet) =>
  wallet.features.includes(SolanaSignTransaction);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SelectedWalletAccountContextProvider
      filterWallets={filterWallets}
      stateSync={stateSync}
    >
      {children}
    </SelectedWalletAccountContextProvider>
  );
}
