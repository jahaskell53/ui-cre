CREATE OR REPLACE FUNCTION public.ensure_system_account_profile()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    system_user_id uuid;
    system_profile_id uuid;
begin
    -- Try to find existing system account user
    select id into system_user_id
    from auth.users
    where email = 'system@openmidmarket.com' or raw_user_meta_data->>'full_name' = 'OpenMidmarket'
    limit 1;

    -- If user exists, ensure profile exists
    if system_user_id is not null then
        insert into profiles (id, full_name, is_admin)
        values (system_user_id, 'OpenMidmarket', false)
        on conflict (id) do update
        set full_name = 'OpenMidmarket';

        return system_user_id;
    end if;

    -- If no user found, return null (user needs to be created manually)
    return null;
end;
$function$
