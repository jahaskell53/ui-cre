CREATE OR REPLACE FUNCTION public.link_system_account_profile(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
    insert into profiles (id, full_name, is_admin)
    values (user_id, 'OpenMidmarket', false)
    on conflict (id) do update
    set full_name = 'OpenMidmarket';
end;
$function$
