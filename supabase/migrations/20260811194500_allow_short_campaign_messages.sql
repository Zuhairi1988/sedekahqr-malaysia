alter table public.emergency_campaign
  drop constraint if exists emergency_campaign_message_check;

alter table public.emergency_campaign
  add constraint emergency_campaign_message_check
  check (char_length(message) between 3 and 360);
