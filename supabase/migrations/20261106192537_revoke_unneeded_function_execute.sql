-- Restrict internal trigger functions and owner-only resubmission RPC.
-- Trigger functions are invoked by their database triggers, not by direct client RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_players_when_build_approved() from public, anon, authenticated;
revoke execute on function public.notify_studio_when_game_published() from public, anon, authenticated;
-- Resubmission requires a signed-in owner; anonymous callers should not reach the RPC.
revoke execute on function public.resubmit_game(uuid) from anon;
