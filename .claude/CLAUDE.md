# Selo — carta de crédito programável em Solana

## Contexto
Projeto para o Colosseum Crypto World's Fair (track Solana + pool geral + track Superteam Brasil).
Submissão até 12/out/2026 23:59 (Brasília). Tudo que não aparece no demo é secundário.

Problema: US$ 2,5 tri de déficit de trade finance (ADB 2025); 40% dos pedidos de PMEs recusados;
principal motivo de recusa é falta de liquidez em dólar, não risco de crédito. Fraude recorrente de
duplo penhor de documentos (Hin Leong, Qingdao).

Produto: escrow em USDC liberado por atestações de embarque, com registro on-chain que impede
financiar o mesmo documento (B/L, invoice, CPR) duas vezes, e adiantamento de financiador pago
em cascata na liquidação.

Cenário do demo: soja do Mato Grosso → importador em Roterdã, com lote EUDR atestado.

## Atores
- Exportador (seller), Comprador (buyer), Financiador (financier), Atestador (inspetora, armador, compliance EUDR).

## Fluxo on-chain (programa Anchor)
1. `create_deal`: seller + buyer + valor + mint USDC + marcos + atestadores aceitos + vencimento.
2. `fund_escrow`: buyer deposita USDC num vault PDA do deal.
3. `register_document`: cria PDA com seeds ["doc", sha256(tipo || emissor || número || salt)].
   Se a PDA já existe, a transação falha → duplo penhor impossível. Guarda só o hash e o deal vinculado.
4. `attest_milestone`: atestador autorizado assina um marco (INSPECTED, SHIPPED, EUDR_COMPLIANT, DELIVERED).
   A autorização do atestador vem de uma credencial do Solana Attestation Service (SAS) ou, no fallback, de uma allowlist no deal.
5. `advance`: financiador adianta até `max_advance_bps` do valor ao seller, exigindo documento registrado + marco SHIPPED.
6. `settle`: com DELIVERED atestado, o vault paga o financiador (principal + taxa) e depois o saldo ao seller.
7. `refund` / `cancel`: se o vencimento passa sem DELIVERED, devolve ao buyer conforme regras.

## Stack
- Programa: Rust + Anchor (versão estável mais recente), SPL Token (USDC mock mint na devnet/localnet).
- Testes do programa: TypeScript com LiteSVM ou anchor-bankrun para testes rápidos + `anchor test` para integração.
- Frontend: Next.js (App Router) + TypeScript + Tailwind + Solana wallet adapter. Três telas:
  /exporter, /financier, /attester (mobile-first). Mais uma /deal/[id] com linha do tempo dos eventos.
- Atestações: Solana Attestation Service (verificar SDK e endereços em attest.solana.com antes de integrar).
- Câmbio: Pyth (BRL/USD) só para exibição e cálculo de referência; nunca bloquear o fluxo se falhar.
- Deploy: devnet. Nada em mainnet.

## Regras de trabalho
- Antes de codar cada fase: escreva um plano curto em `docs/plan.md` e espere meu OK se houver decisão de arquitetura.
- Escopo mínimo que faz o demo funcionar. Se algo não aparece no roteiro do demo, vira item em `docs/roadmap.md`.
- Toda instrução do programa tem teste de caminho feliz e de falha (sobretudo: duplo registro, atestador não autorizado,
  adiantamento acima do limite, settle sem DELIVERED, reentrância/contas trocadas).
- Checklist de segurança Anchor em cada instrução: signers, has_one/constraints, seeds e bumps canônicos,
  checagem de mint e owner das token accounts, overflow com checked_math, fechamento de contas.
- Commits pequenos e descritivos. Não commitar chaves. `.env.example` sempre atualizado.
- Quando não souber uma API (SAS, Pyth, versões), consulte a documentação oficial em vez de supor.
- Escreva código e docs em inglês (os jurados são internacionais); fale comigo em português.

## Entregáveis finais
- Repositório público com README (problema, solução, arquitetura, como rodar, program ID na devnet).
- `docs/architecture.md` com diagrama (Mermaid) de contas e fluxo.
- `docs/demo-script.md`: roteiro do vídeo técnico de 2–3 min.
- `docs/pitch-script.md`: roteiro do vídeo de pitch de até 3 min.
- Script `scripts/seed-demo.ts` que cria o cenário completo na devnet em um comando.
- Deploy do frontend (Vercel) apontando para a devnet.

## Roteiro do demo (o "momento aha")
1. Exportador cria o deal e registra o B/L.
2. Segundo financiador tenta financiar o mesmo B/L → erro on-chain visível na UI.
3. Inspetora atesta SHIPPED pelo celular → adiantamento cai na carteira do exportador em < 1 s.
4. Comprador confirma DELIVERED → escrow paga financiador e saldo ao exportador automaticamente.