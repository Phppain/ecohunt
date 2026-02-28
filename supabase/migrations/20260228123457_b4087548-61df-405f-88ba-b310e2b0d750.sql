
-- Add help mission fields to missions table
ALTER TABLE public.missions 
  ADD COLUMN IF NOT EXISTS waste_category TEXT,
  ADD COLUMN IF NOT EXISTS severity_color TEXT CHECK (severity_color IN ('ORANGE', 'RED')),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS volunteers_needed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_estimate TEXT,
  ADD COLUMN IF NOT EXISTS tools_needed TEXT[],
  ADD COLUMN IF NOT EXISTS cleanup_progress_pct DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_help_request BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS before_photo_url TEXT;

-- Mission participants table for joining missions
CREATE TABLE IF NOT EXISTS public.mission_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contribution_pct DOUBLE PRECISION DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  UNIQUE(mission_id, user_id)
);

ALTER TABLE public.mission_participants ENABLE ROW LEVEL SECURITY;

-- Everyone can see participants
CREATE POLICY "Participants viewable by everyone" ON public.mission_participants
  FOR SELECT USING (true);

-- Auth users can join
CREATE POLICY "Auth users can join missions" ON public.mission_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own participation
CREATE POLICY "Users can update own participation" ON public.mission_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can leave missions
CREATE POLICY "Users can leave missions" ON public.mission_participants
  FOR DELETE USING (auth.uid() = user_id);
