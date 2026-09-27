# Selo — architecture

> Draft. The account diagram and flow (Mermaid) are completed in Phase 5; the program design lives in
> [`plan.md`](plan.md) until then.

## Document hash canonicalization

The `DocumentRecord` PDA `["doc", doc_hash]` is the anti-double-pledge lock: a document can be
registered once, ever. That only works if **every client derives the same hash for the same
document**, so the canonical form is part of the protocol. The on-chain program only sees the hash;
the reference implementation is `sdk/src/doc-hash.ts` and is shared by tests, scripts and the app.

### Version

`selo:doc:v1`. Any change to the rules below needs a new domain string (`v2`), because it changes
every hash.

### Fields

| Field | B/L (`doc_type = 0`) | Commercial invoice (`1`) / CPR (`2`) |
| --- | --- | --- |
| `issuer` | Carrier **SCAC** code: uppercase, whitespace removed, must match `^[A-Z]{2,4}$` | Issuer **CNPJ**: remove whitespace, `.`, `/`, `-`; must be exactly 14 digits |
| `number` | Uppercase; remove whitespace, `-` and `.`; must match `^[A-Z0-9/]{1,64}$` | same |

Anything that does not match after normalization is rejected (the client refuses to hash it). Only
ASCII survives, so there is no Unicode normalization question.

### Preimage and hash

```
preimage = "selo:doc:v1"            (11 bytes, ASCII)
        || u8  doc_type
        || u8  len(issuer) || issuer (ASCII)
        || u8  len(number) || number (ASCII)
doc_hash = sha256(preimage)
```

Length prefixes prevent boundary shifting (`"MAE" + "U123"` ≠ `"MAEU" + "123"`). There is no per-user
salt in v1: a free salt would let the same document hash differently and re-open double pledging.

### Test vectors (`tests/doc-hash.test.ts`)

| Input | Canonical | Note |
| --- | --- | --- |
| B/L, `MAEU`, `"MAEU-123 456"` | issuer `MAEU`, number `MAEU123456` | same hash as `maeu` / `"maeu123456"` |
| CNPJ `12.345.678/0001-90` | `12345678000190` | invoice / CPR issuer |
| B/L `MAEU` / `MAEU-123 456` | `sha256 = 750efa0bd35c9b6bbfadda160686e46c3d35d18bdc0c897e91c2ce3cfde1f568` | pinned, cross-checked with `node:crypto` |

### Trust model

- The program cannot verify canonicalization. A seller could register a non-canonical hash of a
  document; that record would not block the canonical one.
- Mitigation in v1: the **financier's client recomputes the canonical hash** from the B/L it is shown
  and passes that record to `advance`, which checks it is this deal's B/L. A non-canonical
  registration therefore cannot be financed.
- Known limits, both on the roadmap: a third party who knows a B/L number could register it first
  (squatting) → issuer-confirmed registration; B/L numbers are guessable, so "this B/L is on Selo"
  leaks → issuer-provided salt.
