# TASKS.md — Plano de Execução (06/10 → 12/10/2026)

Organizado por dia: o prazo é a restrição dominante. Marque cada item (`[x]`) ao concluir. Se um dia atrasar, **corte do fim da lista do dia, nunca do critério de pronto**. Regra de decisão: `CLAUDE.md` Seção 2.

---

## Dia 0 — Terça 06/10 · Fundação (ou adaptação do que já existe)

- [x] Se já existe código: rodar o prompt "Adaptar o projeto existente" de `docs/prompts.md` e seguir o plano aprovado antes de qualquer outra tarefa.
- [x] Repositório público no GitHub com as pastas do `CLAUDE.md` Seção 12, trabalhando numa branch (`dev`).
- [x] Programa Anchor `selo` buildando e `anchor test` rodando (mesmo vazio).
- [x] `.gitignore` conforme `CLAUDE.md` Seção 10.
- [ ] RPC devnet da Helius em `.env` (nunca commitado) + `.env.example` documentado.
- [ ] Mandar mensagem para 5-10 pessoas que financiam recebíveis (factorings, fintechs de crédito, protocolos de crédito on-chain, tesourarias): *"Antes de financiar uma fatura, vocês consultariam um registro global que mostra se ela já foi financiada por outro credor?"*

**Critério de pronto**: repositório público, programa buildando, testes rodando.

---

## Dia 1 — Quarta 07/10 · Hash canônico + selo

- [x] `packages/sdk/src/hash.ts`: `canonicalize` e `invoiceHash` exatamente como no `CLAUDE.md` Seção 5.
- [x] Vetores de teste do hash (formatações diferentes → mesmo hash; um campo diferente → hash diferente).
- [x] Contas `Config`, `Lender`, `Seal`; instruções `initialize`, `register_lender`, `set_lender_active`, `seal_invoice`, `cancel_seal`, `set_paused`.
- [x] Teste 1 do `CLAUDE.md` Seção 11 (selar duas vezes falha).

**Critério de pronto**: o teste de selo duplicado passa no validador local.

---

## Dia 2 — Quinta 08/10 · Atestação + travamento + SDK

- [x] Script `scripts/create-mint.ts` (`USDC-dev`, 6 decimais) e mint para as carteiras de teste.
- [x] `attest_invoice`, `lock_invoice` (com cobrança da taxa), `release_invoice`.
- [x] Erro customizado de "já travada" e tradução no SDK ("já financiada por X em DD/MM").
- [x] `checkInvoice()` no SDK.
- [x] Todos os testes do `CLAUDE.md` Seção 11 passando.
- [x] Eventos Anchor nas instruções de estado.

**Critério de pronto**: os cinco momentos da demo passam como teste automatizado, sem frontend.

---

## Dia 3 — Sexta 09/10 · Devnet + frontend

- [ ] `anchor deploy` na devnet; Program ID no README e no `Anchor.toml`.
- [x] `scripts/seed-demo.ts` idempotente: initialize, registra "Lender A" e "Lender B", dá `USDC-dev` aos dois.
- [x] Next.js + Wallet Standard (`@solana/react`) + `packages/sdk`.
- [x] Telas `/fornecedor`, `/comprador`, `/financiador`, `/verificar`.
- [x] Mensagens de erro legíveis; faixa "Devnet — tokens de teste".

**Critério de pronto**: os cinco momentos rodam no navegador contra a devnet, três vezes seguidas sem erro.

---

## Dia 4 — Sábado 10/10 · Publicar e gravar a demo

- [ ] Deploy no Vercel e teste numa janela anônima com outra carteira.
- [ ] README completo (`CLAUDE.md` Seção 13), com trecho de código usando `checkInvoice()`.
- [ ] Atualizar `docs/pitch.md` com a validação real (ou remover a frase de validação).
- [ ] 8 slides do pitch.
- [ ] Gravar o vídeo técnico dos cinco momentos.

**Critério de pronto**: app público funcionando e vídeo técnico gravado.

---

## Dia 5 — Domingo 11/10 · Gravar o pitch e submeter

- [ ] Reconferir os números do pitch e cronometrar (alvo 2:45).
- [ ] Gravar o pitch.
- [ ] Revisar elegibilidade e campos do formulário.
- [ ] **Submeter hoje.** Merge da `dev` na `main` e congelar.

**Critério de pronto**: submissão confirmada na plataforma.

---

## Reserva — Segunda 12/10

- [ ] Só correções que não arrisquem a demo.

---

## Cortes pré-aprovados (nesta ordem)

1. Tela `/comprador` → atestação por script, mostrada no explorer.
2. `release_invoice` → descrita no README como próxima etapa.
3. Cobrança da taxa → travamento gratuito na demo, modelo de taxa só no pitch.
4. Tela `/verificar` → a consulta aparece dentro de `/financiador`.

**Nunca cortar:** selo duplicado rejeitado, segundo financiador rejeitado, deploy na devnet, `checkInvoice()` no SDK.

---

## Depois do hackathon (não fazer antes de 12/10)

- [ ] Atestação do comprador via vault multisig (Squads).
- [ ] Consulta sem carteira, por API HTTP, para financiadores tradicionais.
- [ ] Prova de privacidade mais forte do hash (compromisso com sal compartilhado entre financiadores, ou provas de conhecimento zero).
- [ ] Auditoria do programa e parecer jurídico sobre cessão de crédito por jurisdição.
- [ ] Leitura do registro a partir de outras redes.
