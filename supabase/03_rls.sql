-- =====================================================================
--  Controle Financeiro — 03: Row Level Security
--  Rode depois de 02_functions.sql.
--
--  Esta é a camada que realmente protege o dinheiro. A chave anônima do
--  Supabase fica visível no bundle do app (é o esperado), então o que
--  impede alguém de ler os seus lançamentos NÃO é o front-end: é o RLS.
--  Se alguma tabela ficar sem RLS, ela vira pública.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts          enable row level security;
alter table public.categories        enable row level security;
alter table public.transactions      enable row level security;
alter table public.budgets           enable row level security;
alter table public.recurring_rules   enable row level security;

-- ---------------------------------------------------------------- perfis

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------------ casa

create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

-- Permite renomear a casa. Criar/apagar casa só acontece por trigger de
-- cadastro e por join_household(), ambos SECURITY DEFINER.
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- --------------------------------------------------------------- membros

create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- Só dá para tirar você mesmo da casa. Não existe policy de INSERT: entrar
-- numa casa passa obrigatoriamente por join_household(), que valida o código.
create policy household_members_delete_self on public.household_members
  for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------- tabelas de dados financeiros
--
-- Todas seguem o mesmo padrão: você enxerga e mexe apenas nas linhas da sua
-- casa. O USING filtra o que já existe; o WITH CHECK impede que um insert ou
-- update jogue a linha para dentro da casa de outra pessoa.

create policy accounts_all on public.accounts
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy categories_all on public.categories
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy transactions_all on public.transactions
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy budgets_all on public.budgets
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recurring_rules_all on public.recurring_rules
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ----------------------------------------------------------------- grants
--
-- RLS filtra linhas, mas quem decide se o papel pode tocar na tabela é o
-- GRANT. `anon` (usuário não logado) não tem nada a fazer aqui.

revoke all on public.profiles, public.households, public.household_members,
              public.accounts, public.categories, public.transactions,
              public.budgets, public.recurring_rules
  from anon;

grant select, update on public.profiles   to authenticated;
grant select, update on public.households to authenticated;
grant select, delete on public.household_members to authenticated;

grant select, insert, update, delete on
  public.accounts, public.categories, public.transactions,
  public.budgets, public.recurring_rules
  to authenticated;
