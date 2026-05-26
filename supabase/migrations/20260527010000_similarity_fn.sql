-- Helper used by the question generation script for fuzzy dedupe.
create or replace function public.ballpark_similar_prompt(p text, threshold real)
returns table(prompt text, similarity real)
language sql stable as $$
  select prompt, similarity(prompt, p) as similarity
  from public.questions
  where similarity(prompt, p) > threshold
  union all
  select prompt, similarity(prompt, p) as similarity
  from public.questions_review
  where status = 'pending' and similarity(prompt, p) > threshold
  order by similarity desc
  limit 1;
$$;

grant execute on function public.ballpark_similar_prompt(text, real) to anon, authenticated, service_role;
