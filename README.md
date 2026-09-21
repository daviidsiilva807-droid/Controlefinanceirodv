# Controle Financeiro

App de controle financeiro pessoal que se instala na tela inicial do celular e abre em tela cheia,
como um app nativo. Login com e-mail e senha, dados na nuvem.

**Cada conta é uma ilha.** Lançamentos, contas, cartões e orçamentos pertencem a um único usuário e
mais ninguém enxerga — nem outro usuário, nem o administrador. Existe um papel de **admin**, que vê
apenas a lista de pessoas cadastradas (nome, e-mail e data) e pode enviar mensagens para a caixa de
entrada delas. Nada financeiro.

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
| [`05_migracao_emprestimos_notificacoes.sql`](supabase/05_migracao_emprestimos_notificacoes.sql) | Migration segura para projeto já existente |

Se o projeto já está em uso, execute apenas o arquivo [`05_migracao_emprestimos_notificacoes.sql`](supabase/05_migracao_emprestimos_notificacoes.sql)
para adicionar empréstimos e notificações sem apagar os dados existentes. Não execute novamente o
`01_schema.sql` ou `03_rls.sql` completos em um banco já configurado.

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
VITE_VAPID_PUBLIC_KEY=cole_aqui_a_chave_publica
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

### Notificações de faturas

Depois de executar o SQL, gere um par de chaves VAPID e publique a função de envio:

```bash
npx web-push generate-vapid-keys
supabase functions deploy enviar-notificacoes
```

Configure `VITE_VAPID_PUBLIC_KEY` na Vercel. Nos secrets da Edge Function, configure `VAPID_EMAIL`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `CRON_SECRET`. A chave privada deve existir somente nos
secrets do Supabase, nunca no frontend.

Por fim, crie um job diário no Supabase Cron para chamar `enviar-notificacoes` com o header
`Authorization: Bearer <CRON_SECRET>`. No app, acesse **Mais → Notificações** e ative o recebimento
no celular. O Service Worker mostra os avisos mesmo quando o PWA estiver fechado.

---

## Instalar na tela inicial

**Android (Chrome):** o app mostra o botão “Instalar” sozinho.

**iPhone (Safari):** o Safari não oferece banner de instalação — é preciso tocar em
**Compartilhar → “Adicionar à Tela de Início”**. O app detecta o iPhone e mostra essa instrução na
tela inicial. Depois de instalado, funciona igual: ícone próprio, splash screen e tela cheia.

---

## Contas, papéis e mensagens

**A primeira conta criada no sistema vira administradora.** Cadastre-se antes de qualquer outra
pessoa. Da segunda em diante, todo mundo entra como usuário comum.

O admin ganha o menu **Mais → Administração**, onde vê a lista de usuários e pode enviar uma
mensagem para uma pessoa específica ou para todas de uma vez. A mensagem cai na caixa de entrada do
destinatário e o sino do cabeçalho acende na hora, sem recarregar a página.

**O que o admin NÃO vê:** lançamentos, saldos, cartões, orçamentos ou categorias de ninguém. Isso
não é escolha da interface — as policies do banco não fazem exceção para administrador, então nem
chamando a API direto com o token dele o dado aparece.

Se precisar trocar quem é admin depois, é uma linha no SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'novo-admin@exemplo.com';
update public.profiles set role = 'user'  where email = 'antigo-admin@exemplo.com';
```

Isso só funciona pelo SQL Editor de propósito: o app não tem como alterar o campo `role`, porque o
`GRANT` libera para o client apenas as colunas `display_name` e `emoji`.

---

## O que o app faz

- **Lançamentos** — despesa, receita e transferência; valor com teclado numérico estilo caixa de
  supermercado; categoria em grade de ícones; marcação de *pago* × *previsto*; campo de
  **observações** para anotações longas (aparece como ícone na lista, entra na busca e no CSV).
- **Cartão de crédito** — fatura calculada pelo dia de fechamento (compra a partir do dia do
  fechamento cai na fatura seguinte), limite usado e **parcelamento** que distribui a compra pelos
  meses seguintes sem perder centavo.
- **Contas recorrentes** — aluguel, mensalidades e afins lançados sozinhos todo mês como previstos.
- **Assinaturas** — catálogo das assinaturas ativas (streaming, IA, plano de saúde e mais) com o
  total mensal visível no dashboard. Diferente das contas recorrentes, não lança nada no extrato —
  é só um controle do que está sendo cobrado todo mês.
- **Orçamentos** — limite por categoria, alerta em 80% e 100%, cópia do mês anterior e projeção de
  fechamento no ritmo atual.
- **Relatórios** — evolução de 6/12 meses, comparativo com o mês anterior, ranking de categorias e
  exportação CSV pronta para o Excel em português.
- **Mensagens** — caixa de entrada com sino e contador de não lidas, alimentada pelo administrador.
- **Bloqueio** — PIN de 6 dígitos e biometria (Face ID / digital).
- Tema claro e escuro, e sincronização em tempo real entre os seus aparelhos.

---

## Decisões que valem saber

**Dinheiro é sempre centavo inteiro (`bigint`), nunca decimal.** Em JavaScript `0.1 + 0.2` dá
`0.30000000000000004`; num app financeiro isso vira erro de centavo acumulado no relatório. A
conversão para “R$ 1.234,56” acontece só na hora de exibir. Ver [`src/lib/money.js`](src/lib/money.js).

**Datas do banco são convertidas à mão, sem passar por UTC.** `new Date('2026-07-01')` é interpretado
como meia-noite UTC, que no Brasil é 21h do dia 30 de junho — e o lançamento aparece no mês errado.
Ver `parseData()` em [`src/lib/dates.js`](src/lib/dates.js).

**O RLS é a segurança de verdade.** A chave pública do Supabase fica visível no bundle, como é
esperado. Quem impede alguém de ler seus lançamentos não é o front-end: são as policies de
[`03_rls.sql`](supabase/03_rls.sql). Elas são deliberadamente simples — `user_id = auth.uid()`, sem
função auxiliar e sem exceção para admin — porque regra de isolamento que ninguém consegue ler de
cabeça é regra que ninguém consegue auditar.

**A escalada de privilégio é barrada por `GRANT` de coluna, não por policy.** A policy de UPDATE em
`profiles` permite editar a própria linha, o que incluiria `role`. Por isso o client recebe
`grant update (display_name, emoji)` e nada mais: `role` é intocável de fora do SQL Editor.

**Canal de realtime leva sufixo aleatório no nome.** O `supabase-js` devolve a mesma instância para
um mesmo tópico; dois componentes usando o mesmo hook fariam o segundo chamar `.on()` num canal já
assinado, e o erro derruba a tela inteira. Veja [`src/lib/realtime.js`](src/lib/realtime.js).

**`npm run checar` existe por causa de tela branca.** Um erro de renderização derruba a árvore
inteira do React e a página fica vazia, sem mensagem — o `vite build` não acusa nada disso, porque
ele empacota e sobe feliz com uma variável indefinida no meio. Já aconteceu duas vezes aqui (um
`casaId` esquecido numa refatoração e um `useMemo` depois de um `return` condicional). O ESLint pega
as duas antes de subir, e o [`LimiteDeErro`](src/components/LimiteDeErro.jsx) garante que, se algo
passar, o usuário veja uma mensagem em vez de nada.

**Compra depois do fechamento avisa para onde foi.** Num cartão que fecha dia 25, a compra do dia 26
entra na fatura do mês seguinte. Isso é o correto, mas sem aviso a pessoa lança, não encontra o valor
na aba Cartões e conclui que o app perdeu o lançamento. Por isso o formulário informa a fatura de
destino no momento da compra, e a fatura vazia mostra quanto caiu na próxima.

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
| `npm run checar` | ESLint — pega variável indefinida e hook mal usado |
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

- **Isolamento (o mais importante):** crie duas contas, lance um valor em cada e confirme que
  nenhuma vê o da outra — inclusive a do admin. Vale testar também chamando a API direto:
  `GET /rest/v1/transactions` com o token de um usuário só pode devolver as linhas dele.
- **Escalada de privilégio:** com o token de um usuário comum, tente
  `PATCH /rest/v1/profiles?id=eq.<seu-id>` com `{"role":"admin"}`. Tem que falhar.
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
  lib/             money · dates · pin · supabase · realtime · resumo (regras puras)
  store/           auth · dados (contas/categorias) · ui (tema, mês, toast)
  hooks/           transações · saldos · fatura · orçamentos · recorrentes · assinaturas · mensagens
  components/      UI, gráficos, shell e navegação
  pages/           Uma tela por arquivo
```

## Ainda não tem (mas cabe depois)

Notificação push de verdade (na tela de bloqueio, com o app fechado) · resposta do usuário para o
admin · gravação offline com fila de sincronização · importação de OFX ou Open Finance ·
categorização automática · metas de economia.
