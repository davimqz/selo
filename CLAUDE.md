# CLAUDE.md — Selo: o registro global que impede financiar a mesma fatura duas vezes

Contexto permanente do projeto para qualquer sessão do Claude Code neste repositório. Leia antes de tocar em qualquer módulo. O passo a passo está em `TASKS.md`; os prompts de trabalho estão em `docs/prompts.md`.

Data de referência: 06/10/2026. Entrega do hackathon (Colosseum Crypto World's Fair, trilha Solana): **12/10/2026** — confira horário e fuso na plataforma, não assuma.

## 1. O que este projeto é

**Selo é um registro público e neutro de faturas na Solana. Antes de financiar uma fatura, qualquer financiador consulta o Selo; se ela já estiver financiada por outro, a segunda operação é bloqueada.**

- **O problema:** recebíveis são financiados por credores que não se enxergam. A mesma fatura pode ser cedida a dois financiadores, ou uma fatura inventada pode ser financiada várias vezes. No colapso da First Brands, a acusação alega faturas falsas e garantias empenhadas duas ou três vezes, com bilhões em perdas para credores.
- **O que o Selo faz:** cada fatura vira uma conta derivada do hash canônico dos seus dados. Selar a mesma fatura de novo falha. Um financiador "trava" a fatura ao financiá-la; um segundo financiador que tentar travar é rejeitado e vê quem já financiou.
- **O que o Selo NÃO é:** não é um financiador, não tem pool, não empresta dinheiro, não concorre com protocolos de crédito. **Protocolos de crédito e factorings são clientes do Selo, não concorrentes.**
- **Por que Solana:** consulta e travamento custam frações de centavo e confirmam em menos de um segundo, então dá para registrar faturas pequenas e checar em tempo real no fluxo de crédito.

**Escopo desta versão:** demo funcional em devnet. Nada de mainnet, nada de dinheiro real.

## 2. Regra de ouro: 6 dias, escopo congelado

Critério para qualquer dúvida: **isso aparece no vídeo de demo ou nos testes que provam a demo?** Se não, não entra.

A demo tem exatamente cinco momentos:

1. O fornecedor sela uma fatura (só o hash vai on-chain).
2. O comprador atesta que a fatura é real e devida.
3. O **Financiador A** consulta, vê "livre" e trava a fatura.
4. O **Financiador B** tenta travar a mesma fatura e é **rejeitado**, vendo "já financiada por A em DD/MM".
5. Alguém tenta selar a mesma fatura digitada de outro jeito (minúsculas, espaços) e é **rejeitado**.

Os momentos 4 e 5 vendem o projeto e não podem falhar no vídeo.

## 3. Stack técnica

| Camada | Escolha | Por quê |
|---|---|---|
| Programa on-chain | Rust + Anchor (versão estável atual — confira, não fixe de memória) | Padrão do ecossistema; o IDL gera o cliente TS. |
| Testes | Testes TypeScript do Anchor no validador local (ou LiteSVM se o setup for rápido) | Iteração em segundos. |
| SDK | `packages/sdk` em TypeScript: hash canônico, cliente do programa, função `checkInvoice()` | É o que um financiador integra. Faz parte do produto, não é detalhe. |
| Frontend | Next.js (App Router, TypeScript) no Vercel Hobby | Gratuito, deploy em minutos. |
| Carteira | Solana Wallet Adapter (Phantom) | Caminho mais curto. |
| RPC | Helius devnet (free tier) | A RPC pública da devnet sofre limite de taxa na hora errada. |
| Token de taxa | Mint de teste `USDC-dev` (6 decimais) criado por script | Para cobrar a taxa de travamento na demo. Rotulado como teste em toda a UI. |

## 4. Contas do programa (Anchor)

Todas as PDAs guardam o `bump`. Valores em `u64` (unidades mínimas), cálculos intermediários em `u128` com `checked_*`.

| Conta | Seeds | Campos principais |
|---|---|---|
| `Config` | `["config"]` | `admin`, `treasury`, `fee_mint`, `lock_fee` (valor fixo por travamento), `paused`, `bump` |
| `Lender` | `["lender", lender_pubkey]` | `name` (até 32 bytes), `active`, `locks_count` |
| `Seal` | `["seal", invoice_hash]` | `invoice_hash`, `supplier`, `buyer`, `face_amount`, `currency` (3 bytes ISO 4217), `due_ts`, `status`, `buyer_attested`, `lender`, `locked_at`, `created_at`, `bump` |

`status`: `Sealed → Locked → Released`, ou `Sealed → Cancelled`. `buyer_attested` é uma flag independente que só o comprador liga. Nenhuma outra transição é válida.

## 5. Hash canônico: o que faz o "uma vez só" funcionar

Duas pessoas registrando a mesma fatura precisam chegar ao mesmo hash. A normalização é especificada, versionada e testada:

```
v1|<id fiscal do comprador, só letras e dígitos, maiúsculas>|<id fiscal do fornecedor, idem>|<número da fatura, trim + maiúsculas + espaços internos removidos>|<valor em unidades mínimas, inteiro>|<moeda ISO 4217>|<vencimento AAAA-MM-DD>
```

`invoice_hash = sha256(string acima, UTF-8)`.

- O prefixo `v1|` permite evoluir o formato sem colidir com hashes antigos.
- **Não salgar o hash:** um sal por usuário impediria dois financiadores de detectarem a mesma fatura, que é o objetivo.
- **Limitações (estão no README e no pitch se perguntarem):** identificadores fiscais têm pouca entropia, então o hash não é sigilo forte contra quem já conhece as partes. O Selo só detecta duplicidade **entre quem consulta o registro** — por isso o valor cresce com cada financiador que adere. O selo não substitui o contrato de cessão.
- On-chain só vão `face_amount`, `currency` e `due_ts` em claro (necessários para o financiador decidir); nada de nomes, descrições ou documentos.

## 6. Instruções

| # | Instrução | Quem assina | Verificações essenciais |
|---|---|---|---|
| 1 | `initialize` | admin | `lock_fee` dentro de limite; mint com 6 decimais |
| 2 | `register_lender(name)` / `set_lender_active` | admin | nome não vazio |
| 3 | `seal_invoice(hash, buyer, face, currency, due_ts)` | fornecedor | `init` da PDA (**a duplicata falha aqui**); `face > 0`; `due_ts` no futuro; não pausado |
| 4 | `attest_invoice` | comprador | `Seal.buyer == signer`; estado `Sealed` ou `Locked` |
| 5 | `lock_invoice` | financiador | financiador registrado e ativo; estado `Sealed`; **`buyer_attested == true`**; cobra `lock_fee` em `fee_mint` para `treasury`; grava `lender` e `locked_at` |
| 6 | `release_invoice` | o mesmo financiador | estado `Locked`; `Seal.lender == signer` (marca a fatura como paga/encerrada) |
| 7 | `cancel_seal` | fornecedor | só em `Sealed` |
| 8 | `set_paused` | admin | — |

Quando `lock_invoice` falha por estado `Locked`, o erro customizado precisa carregar informação útil e o SDK precisa traduzi-lo: "já financiada por <nome do financiador> em <data>".

Emita um evento Anchor por instrução de estado (`InvoiceSealed`, `InvoiceAttested`, `InvoiceLocked`, `InvoiceReleased`, `InvoiceCancelled`). Uma tentativa rejeitada não gera evento, porque a transação falha inteira; ela aparece só na tela e no log do SDK.

## 7. SDK (`packages/sdk`)

- `canonicalize(invoice)` e `invoiceHash(invoice)` — puras, com vetores de teste.
- `checkInvoice(connection, invoice | hash)` → `{ status: 'free' | 'sealed' | 'locked' | 'released' | 'cancelled', lender?, lockedAt?, attested }`. **É a chamada que um financiador coloca no fluxo de crédito; o pitch mostra ela.**
- Builders das instruções da Seção 6 e tradução de erros do programa para mensagens legíveis.

## 8. Frontend (quatro telas)

| Rota | Quem usa | O que faz |
|---|---|---|
| `/fornecedor` | fornecedor | formulário da fatura → hash calculado no navegador → selar; lista dos seus selos |
| `/comprador` | comprador | faturas seladas contra ele → "Atestar" |
| `/financiador` | financiador | cola os dados da fatura → consulta → "Financiar (travar)". Na demo, duas carteiras: Financiador A e Financiador B |
| `/verificar` | qualquer pessoa | dados ou hash → estado público da fatura. Página do registro aberto |

Faixa "Devnet — tokens de teste" em todas as telas. Nenhum erro cru do Anchor aparece para o usuário.

## 9. Modelo de negócio (para o pitch e o README)

- Receita: **taxa por fatura travada**, paga pelo financiador. Na demo é um valor fixo em `USDC-dev`.
- Premissa de preço (não é dado de mercado): 5 pontos-base do valor de face por travamento.
- Referência de tamanho: o factoring global movimentou cerca de €4,04 trilhões em 2025 (FCI). Se 1% desse volume passar pelo Selo a 5 bps, são cerca de €20 milhões por ano.
- Por que o financiador paga: a taxa custa menos que uma única perda por dupla cessão, e o registro fica mais valioso a cada financiador que adere (efeito de rede).

## 10. Regras fixas (não reabrir sem motivo novo)

- **Nunca mainnet, nunca dinheiro real, nunca prometer rendimento.**
- **Sem token próprio, sem pool, sem empréstimo.** Se surgir a tentação de "adicionar um pool", releia a Seção 1.
- **Nenhuma chave privada no repositório.** `.gitignore` cobre keypairs (`*.json` fora de `target/idl`), `.env*`, `node_modules`, `target`.
- **Repositório público** (open-source é critério de avaliação da Colosseum).
- **Sem push automático na `main` e sem modo de permissões irrestrito** neste projeto: trabalhe numa branch e faça merge quando os testes passarem.
- O projeto é global: nenhuma jurisdição específica é citada no produto, no README ou no pitch.

## 11. Testes obrigatórios antes do vídeo

1. Selar a mesma fatura duas vezes → falha, inclusive com formatação diferente.
2. Financiador B travando fatura já travada por A → falha com erro traduzível.
3. Travar sem atestação do comprador → falha.
4. Assinante errado em cada instrução → falha.
5. `release_invoice` só pelo financiador que travou.
6. Taxa de travamento chega à `treasury` com o valor exato.
7. Financiador inativo não trava; pausa bloqueia selar e travar.
8. Vetores do hash canônico em `packages/sdk`.

## 12. Estrutura de pastas

```
programs/selo/   # programa Anchor
packages/sdk/    # hash canônico, checkInvoice, cliente
app/             # Next.js
scripts/         # mint USDC-dev, initialize, registrar financiadores, semear demo
tests/           # testes do programa
docs/            # pitch.md, prompts.md, roteiro da demo
```

## 13. Materiais de submissão

- Pitch em vídeo de no máximo 3 minutos (`docs/pitch.md`).
- Vídeo técnico com os cinco momentos da Seção 2, se o formulário pedir.
- README: o problema em 3 linhas, como rodar, Program ID na devnet, link do app, exemplo de uso do `checkInvoice()` e as limitações da Seção 5.
- Conferir no formulário as regras de elegibilidade antes de submeter.
