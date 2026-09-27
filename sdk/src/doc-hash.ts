/**
 * Canonical document hash (spec: docs/architecture.md#document-hash-canonicalization).
 *
 * The on-chain registry stores only this hash, and the PDA ["doc", hash] is the
 * anti-double-pledge lock, so every client MUST derive it the same way.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { DocType } from "./constants";

export const DOC_HASH_DOMAIN = "selo:doc:v1";

export interface DocumentFields {
  docType: DocType;
  /** B/L: carrier SCAC code. Invoice / CPR: issuer CNPJ. */
  issuer: string;
  /** Document number as printed. */
  number: string;
}

const NUMBER_RE = /^[A-Z0-9/]{1,64}$/;
const SCAC_RE = /^[A-Z]{2,4}$/;
const CNPJ_RE = /^\d{14}$/;

export class InvalidDocumentFieldError extends Error {}

/** Uppercase; drop whitespace, hyphens and dots. */
export function canonicalNumber(raw: string): string {
  const value = raw.toUpperCase().replace(/[\s.-]/g, "");
  if (!NUMBER_RE.test(value)) {
    throw new InvalidDocumentFieldError(`invalid document number: "${raw}"`);
  }
  return value;
}

/** B/L → SCAC (2–4 letters, uppercase). Invoice / CPR → CNPJ, digits only. */
export function canonicalIssuer(docType: DocType, raw: string): string {
  if (docType === DocType.BillOfLading) {
    const scac = raw.toUpperCase().replace(/\s/g, "");
    if (!SCAC_RE.test(scac)) {
      throw new InvalidDocumentFieldError(`invalid SCAC code: "${raw}"`);
    }
    return scac;
  }
  if (docType === DocType.CommercialInvoice || docType === DocType.Cpr) {
    const cnpj = raw.replace(/[\s./-]/g, "");
    if (!CNPJ_RE.test(cnpj)) {
      throw new InvalidDocumentFieldError(`invalid CNPJ: "${raw}"`);
    }
    return cnpj;
  }
  throw new InvalidDocumentFieldError(`unknown document type: ${docType}`);
}

/** Byte preimage: domain || u8 type || u8 len || issuer || u8 len || number. */
export function docHashPreimage(fields: DocumentFields): Uint8Array {
  const enc = new TextEncoder();
  const domain = enc.encode(DOC_HASH_DOMAIN);
  const issuer = enc.encode(canonicalIssuer(fields.docType, fields.issuer));
  const number = enc.encode(canonicalNumber(fields.number));
  const out = new Uint8Array(
    domain.length + 1 + 1 + issuer.length + 1 + number.length,
  );
  let o = 0;
  out.set(domain, o);
  o += domain.length;
  out[o++] = fields.docType;
  out[o++] = issuer.length;
  out.set(issuer, o);
  o += issuer.length;
  out[o++] = number.length;
  out.set(number, o);
  return out;
}

export function docHash(fields: DocumentFields): Uint8Array {
  return sha256(docHashPreimage(fields));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
