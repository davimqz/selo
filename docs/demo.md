# Roteiro da demo — Selo na devnet

Os cinco momentos do `CLAUDE.md` Seção 2, rodando no navegador contra a devnet.
Nada aqui usa dinheiro real: SOL de devnet e `USDC-dev` são tokens de teste.

## Estado atual da devnet

| | |
|---|---|
| Program ID | `4zmhCsPLVfk7UEnEgpNfUTCcoXFX2tPbjyJtVit7Mhio` |
| Upgrade authority / admin | `HERNv3AsBwEkM6Zv5yLnuezpVpusLH8pxkP6U58iJiYW` (keypair em `~/.config/solana/id.json` no WSL) |
| Mint `USDC-dev` | `Gj8cs9urnjgy29Nz3k5EQNrJZLbapCDSi55X4SU4xAqv` |
| Taxa de travamento | 1 `USDC-dev` |

Carteiras da demo (registradas pelo `seed-demo`):

| Papel | Endereço |
|---|---|
| Fornecedor | `FsCADJoZuEzBc1CL2sq6vabDiJCMinFjUbpgGwHsLmx1` |
| Comprador | `HEASFybTa9mAU1Hq5HCWBJkoAj2tkMq1icJKMiSfff1H` |
| Lender A | `9KHvoV6iuvNrCY7cjgYctSNhCLs9Y6hMt9xuAo5YgRtS` |
| Lender B | `42GWhAZrqCAXzdGT6PwjbkLtoBniq81qJkU6hNeLt33B` |

As chaves privadas ficam só em `scripts/wallets/demo/` (ignorado pelo git),
com o arquivo `PHANTOM-IMPORT.txt` pronto para importar. Nunca commitar.

## 1. Preparar (uma vez)

1. **RPC:** `.env` com `RPC_URL=<URL devnet da Helius>` e `app/.env.local` com
   `NEXT_PUBLIC_RPC_URL=<mesma URL>`. Modelo em `.env.example`. A RPC pública da
   devnet devolve HTTP 429 no meio da demo — sempre usar a Helius.
2. **Phantom:** para cada carteira de `PHANTOM-IMPORT.txt`, *Adicionar conta →
   Importar chave privada*, com os nomes Supplier, Buyer, Lender A, Lender B.
   Em *Configurações → Configurações de desenvolvedor*, ativar o modo testnet e
   escolher **Solana Devnet**.
3. **Fundos:** `seed-demo` é idempotente; rodar antes de cada gravação repõe SOL
   (0,1 por carteira) e `USDC-dev` (1.000 por financiador):

   ```bash
   LENDER_A=<A> LENDER_B=<B> SUPPLIER=<fornecedor> BUYER=<comprador> pnpm seed-demo
   ```

4. **Checagem automática:** `pnpm e2e-demo 3` roda os cinco momentos 3 vezes
   pelo mesmo código de transação do app, com carteiras próprias
   ("E2E Lender A/B"). Se passar, a devnet e a RPC estão boas.

## 2. Subir o app

```bash
cd app
npx next build && npx next start -p 3000   # mais leve que `next dev`
```

Abrir http://localhost:3000. A faixa "Devnet — test tokens only" deve aparecer
no topo. Para trocar de papel: trocar a conta na Phantom e, no app, *Connect
wallet → Reconnect*.

## 3. Os cinco momentos

Use um número de fatura novo a cada rodada (`INV-2026-0043`, `0044`, …): uma
fatura selada fica no registro para sempre — é esse o ponto.

1. **Fornecedor sela** — conta *Supplier*, `/fornecedor`. *Fill the example
   invoice*, trocar o número, colar o endereço do comprador, **Seal invoice**.
   Mostrar a forma canônica e o hash calculados no navegador: só o hash vai
   on-chain.
2. **Comprador atesta** — conta *Buyer*, `/comprador`. A fatura aparece na
   lista; **Attest**.
3. **Financiador A trava** — conta *Lender A*, `/financiador`. Digitar a fatura
   (ou colar o hash, botão *copy* na lista do fornecedor), **Check registry**:
   "Sealed — not financed", *Buyer attested: Yes*. **Finance (lock invoice)**.
4. **Financiador B é rejeitado** — conta *Lender B*, mesma tela, mesma fatura.
   O status já mostra "Financed by Lender A". Clicar **Finance** mesmo assim:
   carimbo vermelho *"Rejected by the Selo program — Already financed by
   Lender A on DD Mon AAAA. It cannot be financed twice."* A carteira nem chega
   a pedir assinatura: o app simula a transação no programa antes.
5. **Duplicata redigitada é rejeitada** — conta *Supplier*, `/fornecedor`.
   Mesma fatura em minúsculas e com espaços (`de 811 907 980`,
   ` inv-2026-0043 `). O hash é idêntico; **Seal** → *"This invoice is already
   registered in Selo. It cannot be registered twice."*

Opcional para o vídeo: `/verificar` mostra o mesmo estado sem carteira, e o
link *seal account ↗* abre a conta no Solana Explorer.

## Modo demo (sem Phantom)

Para gravar sem trocar de conta na Phantom. O app continua o mesmo e as
transações são reais na devnet; só a assinatura muda: o navegador assina com as
carteiras de `scripts/wallets/demo`.

1. Em `app/.env.local`, acrescentar `SELO_DEMO_MODE=1`.
2. `pnpm --filter app demo` (faz o build e sobe em http://localhost:3000, só no
   127.0.0.1).
3. Na faixa roxa "Demo mode", escolher **Supplier**. Ao trocar de tela, o papel
   acompanha: `/comprador` assina como Buyer e `/financiador` como Lender A,
   com o botão **Lender B** ao lado. **My wallet** volta para a Phantom.

Atalhos que só aparecem no modo demo:

- `/fornecedor`: **New demo invoice** gera um número novo a cada take, e o
  endereço do comprador já vem preenchido.
- `/financiador`: **Use the sealed demo invoice** preenche a última fatura
  selada.
- `/fornecedor`, depois de selar: **Same invoice, typed differently** preenche
  a mesma fatura em minúsculas e com espaços (momento 5).

A rota que entrega as chaves (`/api/demo-wallets`) responde 404 sem a flag,
fora de `localhost` e no Vercel. As chaves nunca entram no repositório nem no
bundle publicado.

## Problemas conhecidos

| Sintoma | Causa e solução |
|---|---|
| `HTTP error (429): Too Many Requests` | RPC pública da devnet. Usar a Helius em `.env` e `app/.env.local`. |
| Deploy: `Data writes to account failed: Max retries exceeded` | RPC pública perdeu escritas. Recuperar o SOL do buffer com `solana program close <buffer> --url devnet --bypass-warning` e repetir com `solana program deploy target/deploy/selo.so --program-id target/deploy/selo-keypair.json --url devnet --max-sign-attempts 100 --with-compute-unit-price 50000`. |
| Servidor do app cai sozinho | Pouca memória no Windows. `wsl --shutdown` (o app não precisa do WSL), fechar abas pesadas, usar `next start` em vez de `next dev`. Se a porta 3000 ficar ocupada, encerrar o processo `node` antigo. |
| "This wallet has no devnet SOL to pay the network fee." | Rodar `seed-demo` de novo. |
| "This lender is not registered in Selo." | A conta conectada não é Lender A/B; conferir a conta na Phantom ou rodar `seed-demo` com o endereço certo. |
| A Phantom não mostra a transação certa / saldo zero | Phantom fora da devnet: ativar o modo testnet e escolher Solana Devnet. |

## Segurança

- A URL da Helius vai para o navegador (`NEXT_PUBLIC_`). Antes do deploy no
  Vercel, restringir a chave ao domínio do app no painel da Helius.
- Chaves das carteiras e do deploy nunca entram no repositório (`.gitignore`
  cobre `wallets/`, `*-keypair.json`, `id.json`, `.env*`).
