# Prompts para o Claude Code — Selo

Use na ordem. Todos assumem `CLAUDE.md` e `TASKS.md` na raiz do repositório.

---

## Prompt 1 — Adaptar o projeto que já existe (use primeiro se você já começou algo)

```
Leia CLAUDE.md e TASKS.md inteiros antes de qualquer coisa. Eles definem o projeto
a partir de agora: o Selo é um REGISTRO de faturas, não um financiador (sem pool,
sem empréstimo).

Este repositório já tem código de uma versão anterior. Não apague, mova nem
reescreva nada ainda. Faça só isto:

1. Crie a branch `dev` a partir do estado atual e trabalhe nela.
2. Liste o que existe: programas Anchor, contas, instruções, testes, pacotes,
   telas, scripts e dependências, com as versões instaladas.
3. Para cada item, classifique em uma tabela:
   - MANTER (já serve ao CLAUDE.md como está)
   - ADAPTAR (serve com mudanças; diga quais)
   - REMOVER (contradiz o CLAUDE.md, ex.: pool, LP, cálculo de adiantamento)
   - FALTA (exigido pelo CLAUDE.md e inexistente)
4. Aponte qualquer chave privada, .env ou keypair commitado no histórico.
5. Diga quais tarefas do TASKS.md já estão cumpridas pelo código existente e em
   que dia do plano estamos de fato.
6. Proponha a ordem das mudanças, a menor possível, para chegar ao critério de
   pronto do dia atual.

Pare e espere minha aprovação antes de editar qualquer arquivo.
```

---

## Prompt 2 — Começar do zero (use se não houver código)

```
Leia CLAUDE.md e TASKS.md inteiros. Estamos no Dia 0. Trabalhe na branch `dev`.
Execute as tarefas do Dia 0 em ordem, uma por vez, rodando build e testes depois
de cada uma. Não comece o Dia 1 até o critério de pronto do Dia 0 passar.
Se algo no CLAUDE.md estiver desatualizado (versão do Anchor, comando que mudou,
API do Wallet Adapter), pare e me diga antes de seguir.
```

---

## Prompt 3 — Executar um dia do plano (use a cada dia)

```
Leia CLAUDE.md e a seção do Dia [N] do TASKS.md. Execute as tarefas desse dia em
ordem. Depois de cada tarefa: rode os testes, marque [x] no TASKS.md e me diga
em uma linha o que mudou. Se uma tarefa travar por mais de 45 minutos, pare,
explique o bloqueio e sugira qual corte pré-aprovado do TASKS.md aplicar.
No fim do dia, rode o critério de pronto e me mostre o resultado real.
```

---

## Prompt 4 — Revisão antes de gravar (Dia 4)

```
Atue como um jurado técnico da Colosseum revisando este repositório pela primeira
vez. Sem editar nada:
1. Rode os testes e o fluxo dos cinco momentos do CLAUDE.md Seção 2 contra a
   devnet e diga o que falhou.
2. Leia o README como alguém de fora: em 60 segundos dá para entender o problema,
   rodar o projeto e ver o checkInvoice()?
3. Procure segredos commitados e erros crus do Anchor aparecendo na UI.
4. Liste as 5 perguntas mais difíceis que um jurado faria e se o README ou o
   pitch já respondem cada uma.
Entregue uma lista priorizada do que corrigir em menos de 4 horas.
```
