-- Support client : autoriser la suppression / modification de ses propres messages
-- et ajouter le statut "pending" (en attente) aux tickets.
-- À exécuter dans le projet Supabase utilisé par l'application.

-- 1) Les auteurs peuvent modifier et supprimer leurs messages ; les admins tous.
drop policy if exists "own support messages update" on public.support_messages;
create policy "own support messages update" on public.support_messages
  for update to authenticated
  using (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "own support messages delete" on public.support_messages;
create policy "own support messages delete" on public.support_messages
  for delete to authenticated
  using (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

grant update, delete on public.support_messages to authenticated;

-- 2) Diffusion temps réel des modifications / suppressions de messages.
alter table public.support_messages replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when duplicate_object then null;
  end;
end $$;
