"use client";

import { explorerTx } from "@/lib/config";

export type OutcomeState =
  | { kind: "idle" }
  | { kind: "busy"; text: string }
  | { kind: "ok"; text: string; signature?: string }
  | { kind: "rejected"; text: string };

export function Outcome({ state }: { state: OutcomeState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "busy") {
    return <p className="text-sm text-muted">{state.text}</p>;
  }
  if (state.kind === "rejected") {
    return (
      <div className="stamp" role="alert">
        <div className="text-xs font-semibold tracking-widest uppercase">
          Rejected by the Selo program
        </div>
        <div className="mt-1 text-base font-medium">{state.text}</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-free p-3 text-sm text-free">
      {state.text}
      {state.signature && (
        <>
          {" "}
          <a
            href={explorerTx(state.signature)}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            View transaction ↗
          </a>
        </>
      )}
    </div>
  );
}
