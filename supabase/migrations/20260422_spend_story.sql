-- ─────────────────────────────────────────────────────────────────
-- F-02: SPEND STORY — INSIGHTS TABLE
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      date        NOT NULL, -- Monday of the week being analyzed
  pattern_module  text        NOT NULL, -- CategorySpike | WeekdayClustering | NewMerchant
  pattern_data    jsonb       NOT NULL, -- Raw variables for templates
  rendered_text   text        NOT NULL, -- Final substituted string
  feedback        text,                 -- 'up' | 'down'
  delivered_at    timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- Ensure only one insight per user per week
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_week_insight ON public.insights (user_id, week_start);

-- Enable RLS
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "insights_select" ON public.insights;
CREATE POLICY "insights_select" ON public.insights FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insights_update_feedback" ON public.insights;
CREATE POLICY "insights_update_feedback" ON public.insights FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (
  -- Only allow updating the feedback column
  (LOWER(feedback) IN ('up', 'down'))
);

-- Grant access
GRANT ALL ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;
