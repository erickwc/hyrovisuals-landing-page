-- Keep existing self-service name edits while denying direct role changes.
grant update (display_name) on public.profiles to authenticated;

create policy profiles_self_update
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
