-- RLS already limits this grant to each signed-in user's own profile.
grant select on public.profiles to authenticated;
