CREATE OR REPLACE FUNCTION public.create_message_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.notifications (user_id, type, content, related_id)
  values (
    new.recipient_id,
    'message',
    new.content,
    new.id
  );
  return new;
end;
$function$
