# Controle Financeiro

App de controle financeiro pessoal e familiar que se instala na tela inicial do celular e abre em
tela cheia, como um app nativo. Login com e-mail e senha, dados na nuvem, feito para duas pessoas
compartilharem os mesmos lançamentos.

**React + Vite + Tailwind · Supabase (Postgres + Auth + RLS) · PWA · pt-BR**

---

## Colocar no ar em 4 passos

### 1. Instalar

```bash
npm install
```

### 2. Criar o projeto no Supabase

Crie um projeto grátis em [app.supabase.com](https://app.supabase.com). No **SQL Editor**, rode os
arquivos da pasta [`supabase/`](supabase/) **nesta ordem**:

| Arquivo | O que faz |
|---|---|
| [`01_schema.sql`](supabase/01_schema.sql) | Tabelas, índices e as três funções base |
| [`02_functions.sql`](supabase/02_functions.sql) | Triggers, cadastro, fatura do cartão e RPCs |
| [`03_rls.sql`](supabase/03_rls.sql) | **Row Level Security — não pule este** |
| [`04_dados_exemplo.sql`](supabase/04_dados_exemplo.sql) | Opcional: dados de teste |

Em seguida, **Authentication → Sign In / Providers → Email** e desligue **Confirm email**.

Isso **não é opcional na prática**. Com a confirmação ligada, o Supabase tenta enviar um e-mail a
cada cadastro, e o serviço de e-mail embutido do plano grátis só entrega para endereços autorizados
no projeto e permite pouquíssimos envios por hora. O resultado são dois erros que parecem outra
coisa e travam o cadastro:

- `Email address "..." is invalid` — num endereço perfeitamente válido;
- `email rate limit exceeded` — já na segunda tentativa.

Desligando a confirmação, nenhum e-mail é enviado e qualquer endereço funciona. (Se você preferir
manter a confirmação, precisa configurar um SMTP próprio em Project Settings → Authentication →
SMTP Settings.)

### 3. Conectar

Copie `.env.example` para `.env.local` e preencha com a **Project URL** e a **chave pública**, as
duas em **Settings → API Keys**.

O nome da chave pública mudou: projetos novos mostram **Publishable key** (`sb_publishable_…`) e os
antigos mostram **anon public** (`eyJhbGciOi…`). As duas funcionam igual neste app — use a que o seu
painel mostrar. **Nunca** use a chave *secret* / *service_role*: ela ignora o RLS.

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

```bash
npm run dev
```

Se o `.env.local` estiver faltando, o app abre numa tela explicando exatamente o que fazer em vez de
quebrar.

### 4. Publicar na Vercel

```bash
npx vercel
```

Cadastre as duas variáveis de ambiente no painel da Vercel (Settings → Environment Variables) e
refaça o deploy. HTTPS vem automático — e HTTPS é requisito para o PWA instalar.

---

## Instalar na tela inicial

**Android (Chrome):** o app mostra o botão “Instalar” sozinho.

**iPhone (Safari):** o Safari não oferece banner de instalação — é preciso tocar em
**Compartilhar → “Adicionar à Tela de Início”**. O app detecta o iPhone e mostra essa instrução na
tela inicial. Depois de instalado, funciona igual: ícone próprio, splash screen e tela cheia.

---

## Usar a dois

1. Você cria sua conta normalmente.
2. Em **Mais → Família**, copie o código de 6 caracteres (ex.: `A7K2M9`).
3. A outra pessoa cria a conta dela e digita esse código no campo *Código de convite*.

A partir daí vocês veem os mesmos lançamentos, contas, cartões e orçamentos, com identificação de
quem lançou. O código é feito de caracteres sem ambiguidade (sem `0`, `O`, `1`, `I`) porque ele é
ditado em voz alta.

---

## O que o app faz

- **Lançamentos** — despesa, receita e transferência; valor com teclado numérico estilo caixa de
  supermercado; categoria em grade de ícones; marcação de *pago* × *previsto*.
- **Cartão de crédito** — fatura calculada pelo dia de fechamento (compra a partir do dia do
  fechamento cai na fatura seguinte), limite usado e **parcelamento** que distribui a compra pelos
  meses seguintes sem perder centavo.
- **Contas recorrentes** — aluguel, assinaturas e mensalidades lançados sozinhos todo mês como
  previstos.
- **Orçamentos** — limite por categoria, alerta em 80% e 100%, cópia do mês anterior e projeção de
  fechamento no ritmo atual.
- **Relatórios** — evolução de 6/12 meses, comparativo com o mês anterior, ranking de categorias e
  exportação CSV pronta para o Excel em português.
- **Bloqueio** — PIN de 6 dígitos e biometria (Face ID / digital).
- Tema claro e escuro, e sincronização em tempo real entre os dois celulares.

---

## Decisões que valem saber

**Dinheiro é sempre centavo inteiro (`bigint`), nunca decimal.** Em JavaScript `0.1 + 0.2` dá
`0.30000000000000004`; num app financeiro isso vira erro de centavo acumulado no relatório. A
conversão para “R$ 1.234,56” acontece só na hora de exibir. Ver [`src/lib/money.js`](src/lib/money.js).

**Datas do banco são convertidas à mão, sem passar por UTC.** `new Date('2026-07-01')` é interpretado
como meia-noite UTC, que no Brasil é 21h do dia 30 de junho — e o lançamento aparece no mês errado.
Ver `parseData()` em [`src/lib/dates.js`](src/lib/dates.js).

**O RLS é a segurança de verdade.** A chave anônima do Supabase fica visível no bundle, como é
esperado. Quem impede alguém de ler seus lançamentos não é o front-end: são as policies de
[`03_rls.sql`](supabase/03_rls.sql), baseadas numa função `SECURITY DEFINER` que evita a recursão
infinita clássica na policy de `household_members`.

**O PIN é uma tranca, não criptografia.** Ele impede que alguém com seu celular *já desbloqueado*
abra o app. Ele não criptografa nada e não substitui o login. Isso está dito na própria tela de
Segurança, porque a confusão contrária é perigosa.

**As cores dos gráficos foram validadas, não escolhidas no olho.** Receitas × despesas usa **azul ×
vermelho** em vez do clássico verde × vermelho: verde e vermelho medem ΔE 4,1 em deuteranopia — para
cerca de 8% dos homens as duas séries viram a mesma cor. Azul × vermelho mede ΔE 23,8. O verde/vermelho
semântico continua nos valores em texto, onde o sinal `+`/`−` já carrega o significado. A rosca por
categoria é limitada a 6 fatias e a leitura séria acontece no ranking de barras abaixo dela, onde cada
linha tem emoji, nome e valor — a cor nunca é a única forma de identificar algo.

**Transferência não conta como receita nem despesa.** Mover dinheiro entre as suas próprias contas não
é ganhar nem gastar; contá-la infla os dois lados do relatório.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Serve o build — **o service worker só existe aqui**, não no `dev` |
| `npm run verificar` | Testa as funções de dinheiro, datas e agregações |
| `npm run icones` | Regenera ícones e splash screens do PWA |

---

## Como conferir que está tudo certo

```bash
npm run verificar        # 13 verificações: centavos, parcelas, fusos, orçamentos
npm run build && npm run preview
```

No preview, abra o **Lighthouse** (aba PWA) e confirme: manifest válido, service worker registrado,
instalável.

Depois, os testes que só a mão faz:

- **RLS:** crie dois usuários em casas diferentes e confirme que nenhum vê os lançamentos do outro.
  Junte-os pelo código de convite e confirme que ambos passam a ver tudo.
- **Centavos:** lance R$ 0,10 e R$ 0,20 e confira que o total é R$ 0,30. Parcele R$ 100,00 em 3x e
  confira 33,34 + 33,33 + 33,33.
- **Cartão:** com fechamento no dia 25, lance uma compra no dia 24 e outra no dia 26 e confirme que
  caem em faturas diferentes.
- **No aparelho:** instale na tela inicial e confirme tela cheia, ícone, splash, PIN e biometria.

---

## Estrutura

```
supabase/          SQL: schema, funções, RLS e dados de exemplo
scripts/           Geração de ícones e verificação das funções puras
src/
  lib/             money · dates · pin · supabase · resumo (regras puras)
  store/           auth · dados (contas/categorias) · ui (tema, mês, toast)
  hooks/           transações · saldos · fatura · orçamentos · recorrentes
  components/      UI, gráficos, shell e navegação
  pages/           Uma tela por arquivo
```

## Ainda não tem (mas cabe depois)

Gravação offline com fila de sincronização · notificações push de contas a vencer · importação de OFX
ou Open Finance · categorização automática · metas de economia.
