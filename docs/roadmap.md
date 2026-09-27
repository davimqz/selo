# Selo — roadmap

Items outside the demo. The MVP scope is in [`plan.md`](plan.md).

## Documents
- **Issuer-confirmed registration (anti-squatting):** the carrier / eBL platform (or the CNPJ holder)
  co-signs or attests the registration, so a third party who knows a B/L number cannot register it
  first.
- **Issuer-provided salt:** a salt issued with the document (e.g. by the eBL platform) keeps the hash
  deterministic while making B/L numbers unguessable.

## Settlement and risk
- Dispute window / arbiter / attester replacement, so funds cannot stay locked if a required
  post-shipment attester disappears.
- Syndicated advances (several financiers per deal).
- Attester staking and slashing.

## Tokens and liquidity
- Token-2022 receivables with a transfer hook (tradable, compliant claims on the settlement flow).
  The escrow stays on classic SPL Token until extensions (transfer fee, hook, permanent delegate) are
  handled explicitly.
- PayFi pools that fund advances.
- BRL off-ramp for exporters via a PSAV (Brazilian virtual-asset service provider).
