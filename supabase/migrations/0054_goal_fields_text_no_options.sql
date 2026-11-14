-- TG1: a free-text field holds no list of values (the build review of TG0). fieldProblem (src/modules/tags/rules.ts)
-- refuses one already, so nothing the app sends relies on this check; it ships with TG1 rather than a merge ahead.
-- Runs as faro_owner with search_path faro (supabase/README.md). Safe to run twice: the check is dropped and made again.
alter table faro.goal_fields drop constraint if exists goal_fields_text_no_options;
alter table faro.goal_fields add constraint goal_fields_text_no_options check (kind = 'list' or jsonb_array_length(options) = 0);
