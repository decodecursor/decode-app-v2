-- Drop the dead "Model insert own profile" RLS policy on model_profiles.
-- The ambassador signup flow uses the service-role client which bypasses
-- RLS, and no other path inserts model_profiles rows. The policy required
-- users.role = 'Model', a value never assigned by ambassador onboarding,
-- so the policy was never load-bearing. Removing it eliminates dead code
-- rather than adding a role-assignment workaround to justify it.

DROP POLICY IF EXISTS "Model insert own profile" ON public.model_profiles;
