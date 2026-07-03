-- Client-measured flow timings (click → paint) uploaded by the perf HUD.
-- Written by apps/web/lib/perf/flow.ts; analyzed per step in docs/perf-plan.md.
CREATE TABLE ind_perf_samples (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  build      text NOT NULL DEFAULT '',   -- NEXT_PUBLIC_BUILD_TIME of the deploy
  step       text NOT NULL DEFAULT '',   -- perf-plan step tag (S0, S1, …)
  flow       text NOT NULL,              -- e.g. epark-twelve, study-hub, cold:home
  ms         integer NOT NULL,
  device     text NOT NULL DEFAULT '',   -- phone | desktop
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_perf_samples_step_flow ON ind_perf_samples(step, flow);

ALTER TABLE ind_perf_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_samples: insert own"
  ON ind_perf_samples FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "perf_samples: select own"
  ON ind_perf_samples FOR SELECT USING (auth.uid() = user_id);
