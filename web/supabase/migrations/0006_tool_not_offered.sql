-- "Confirmed: not offered": things we checked on a vendor's own pages and confirmed a tool
-- doesn't have (for example, no published DPA, or no student accounts). Shown in the scouting
-- report and rewritten at each full recheck. Facts we couldn't confirm stay "Under review" instead.
-- Readable by everyone through the existing tools read policy; only the service key can write.
alter table public.tools
  add column not_offered text[] not null default '{}',
  add constraint tools_not_offered_max check (cardinality(not_offered) <= 12);
