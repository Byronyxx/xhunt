-- ============================================================================
-- 035_messaging_rls_repair.sql                      [NEW — forward-only repair]
-- ----------------------------------------------------------------------------
-- STATUS      : NEW file written during the recovery audit. NOT an original.
-- PURPOSE     : Repair the XChat RLS from migration 016.
--   F-05 / S-15: policy "conv_members_members_select" on conversation_members
--     queries conversation_members from inside its own policy ->
--     "infinite recursion detected in policy for relation conversation_members"
--     (reproduced on replay). Any browser-client read of conversation_members
--     (src/hooks/useMessages.ts, ConversationList.tsx) fails, and so does every
--     policy that sub-selects it (conversations, messages, reactions, receipts).
--   S-16: "conv_members_insert" lets ANY user insert themselves into ANY
--     conversation (WITH CHECK auth.uid() = user_id) -> read private messages.
--   S-17: "conv_members_update_own" lets a member rewrite their own `role`
--     (-> 'owner') ; "messages_sender_update" has no WITH CHECK so a sender can
--     re-point sender_id / conversation_id.
-- RUN ON      : EXISTING and FRESH database.
-- PREREQS     : Originals 001-030 applied (016 especially).
-- DESTRUCTIVE : NO data change. Policies replaced in the same transaction.
-- IDEMPOTENT  : YES.
-- APP IMPACT  : Browser writes verified in code: messages INSERT (own, member),
--               conversation_members UPDATE last_read_at (own). Conversations
--               and their member rows are created by /api/messages/conversations
--               with createAdminClient() — unaffected. If you add a client-side
--               "join community" feature later, it needs its own policy.
-- VALIDATION  : validation/01_validate_security.sql (S-15..S-17)
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.conversation_members') is null then
    raise exception 'conversation_members missing — originals 016 not applied';
  end if;
end $$;

-- Helpers (SECURITY DEFINER so they read membership without re-entering RLS)
create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid()
  )
$$;

create or replace function public.is_conversation_creator(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.created_by = auth.uid()
  )
$$;

revoke execute on function public.is_conversation_member(uuid)  from public, anon;
revoke execute on function public.is_conversation_creator(uuid) from public, anon;
grant  execute on function public.is_conversation_member(uuid)  to authenticated, service_role;
grant  execute on function public.is_conversation_creator(uuid) to authenticated, service_role;

-- conversation_members --------------------------------------------------------
drop policy if exists "conv_members_members_select" on public.conversation_members;
create policy "conv_members_members_select" on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists "conv_members_insert" on public.conversation_members;
create policy "conv_members_insert" on public.conversation_members
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_conversation_creator(conversation_id));

-- members may only touch their own read-state / mute / key-backup columns
revoke update on public.conversation_members from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'conversation_members'
    and column_name in ('last_read_at', 'is_muted', 'session_key');
  execute format('grant update (%s) on public.conversation_members to authenticated', cols);
end $$;

-- messages ---------------------------------------------------------------------
drop policy if exists "messages_sender_update" on public.messages;
create policy "messages_sender_update" on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

commit;
