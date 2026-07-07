
-- Allow anonymous (signup page) to read departments and job titles
DROP POLICY IF EXISTS "deps select all" ON public.departments;
CREATE POLICY "deps select all" ON public.departments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "jt read all" ON public.job_titles;
CREATE POLICY "jt read all" ON public.job_titles FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.departments TO anon;
GRANT SELECT ON public.job_titles TO anon;
