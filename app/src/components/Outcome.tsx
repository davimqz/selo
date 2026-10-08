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
    return (
      <p className="text-muted flex items-center gap-2 text-sm">
        <span className="border-brand inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none" />
        {state.text}
      </p>
    );
  }
  if (state.kind === "rejected") {
    return (
      <div className="stamp" role="alert">
        <div className="text-sm font-semibold">
          Rejected by the Selo program
        </div>
        <div className="mt-1 text-base">{state.text}</div>
      </div>
    );
  }
  return (
    <div className="success" role="status">
      {state.text}
      {state.signature && (
        <>
          {" "}
          <a
            href={explorerTx(state.signature)}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            View transaction ↗
          </a>
        </>
      )}
    </div>
  );
}
