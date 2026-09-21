-- =====================================================================
--  Controle Financeiro — 03: Row Level Security
--  Rode depois de 02_functions.sql.
--
--  Esta é a camada que realmente isola as contas. A chave pública do
--  Supabase fica visível no bundle do app (é o esperado), então o que
--  impede um usuário de ler os lançamentos do outro NÃO é o front-end:
--  são as policies abaixo. Tabela sem RLS é tabela pública.
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.accounts        enable row level security;
alter table public.categories      enable row level security;
alter table public.transactions    enable row level security;
alter table public.budgets         enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.loans           enable row level security;
alter table public.messages        enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_deliveries enable row level security;

-- ---------------------------------------------------------------- perfis

-- O admin vê a lista de pessoas (nome, e-mail, data de cadastro) para saber
-- para quem mandar mensagem. Isso é TUDO que ele vê — nas tabelas financeiras
-- abaixo não existe nenhuma exceção para admin.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------- dados financeiros: só os seus
--
-- Todas seguem o mesmo padrão, e é o mais simples possível de propósito:
-- `user_id = auth.uid()`. Sem função auxiliar, sem subconsulta, sem exceção
-- para administrador. O USING filtra o que já existe; o WITH CHECK impede que
-- um insert ou update grave a linha no nome de outra pessoa.

create policy accounts_all on public.accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy categories_all on public.categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy transactions_all on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy budgets_all on public.budgets
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy recurring_rules_all on public.recurring_rules
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy subscriptions_all on public.subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy loans_all on public.loans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------- mensagens

-- Você lê o que recebeu; o admin lê o que enviou (para ter histórico).
create policy messages_select on public.messages
  for select to authenticated
  using (to_user_id = auth.uid() or public.is_admin());

-- Não existe policy de INSERT: mandar mensagem passa obrigatoriamente por
-- send_message()/broadcast_message(), que são SECURITY DEFINER e checam o
-- papel. Assim ninguém forja remetente nem escreve na caixa alheia.

-- Marcar como lida. O GRANT de coluna mais abaixo limita o UPDATE a `read_at`,
-- então nem o destinatário consegue reescrever o texto da mensagem.
create policy messages_marcar_lida on public.messages
  for update to authenticated
  using (to_user_id = auth.uid())
  with check (to_user_id = auth.uid());

create policy messages_delete on public.messages
  for delete to authenticated
  using (to_user_id = auth.uid() or public.is_admin());

create policy push_subscriptions_all on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notification_settings_all on public.notification_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------- grants
--
-- RLS filtra linhas; o GRANT decide se o papel pode tocar na tabela e em
-- QUAIS COLUNAS. A restrição por coluna aqui não é detalhe: é ela que impede
-- a escalada de privilégio.

revoke all on public.profiles, public.accounts, public.categories,
              public.transactions, public.budgets, public.recurring_rules,
              public.subscriptions, public.messages, public.push_subscriptions,
              public.notification_settings, public.loans
  from anon, authenticated;

-- Sem isto, qualquer usuário rodaria
--   update profiles set role = 'admin' where id = auth.uid()
-- e viraria administrador sozinho — a policy de UPDATE permite, porque a
-- linha é dele mesmo. Liberando só estas duas colunas, `role` fica intocável
-- pelo client.
grant select                        on public.profiles to authenticated;
grant update (display_name, emoji)  on public.profiles to authenticated;

grant select, insert, update, delete on
  public.accounts, public.categories, public.transactions,
  public.budgets, public.recurring_rules, public.subscriptions, public.loans
  to authenticated;

-- Mensagem: ler, marcar como lida e apagar. Nunca inserir nem editar o texto.
grant select, delete    on public.messages to authenticated;
grant update (read_at)  on public.messages to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.notification_settings to authenticated;
