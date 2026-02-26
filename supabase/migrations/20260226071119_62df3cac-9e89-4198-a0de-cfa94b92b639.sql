
-- Severity enum
CREATE TYPE public.zone_severity AS ENUM ('GREEN', 'YELLOW', 'RED');

-- Mission status enum
CREATE TYPE public.mission_status AS ENUM ('OPEN', 'IN_PROGRESS', 'CLEANED');

-- Media kind enum
CREATE TYPE public.media_kind AS ENUM ('BEFORE', 'AFTER');

-- Difficulty enum
CREATE TYPE public.difficulty_level AS ENUM ('EASY', 'MODERATE', 'HARD');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User stats table
CREATE TABLE public.user_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  weekly_points INTEGER NOT NULL DEFAULT 0,
  monthly_points INTEGER NOT NULL DEFAULT 0
);

-- Zones table
CREATE TABLE public.zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 200,
  severity public.zone_severity NOT NULL DEFAULT 'GREEN'
);

-- Missions table
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  title TEXT,
  status public.mission_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mission media table
CREATE TABLE public.mission_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  kind public.media_kind NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Detections table
CREATE TABLE public.detections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_media_id UUID NOT NULL REFERENCES public.mission_media(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  bbox_x DOUBLE PRECISION NOT NULL,
  bbox_y DOUBLE PRECISION NOT NULL,
  bbox_w DOUBLE PRECISION NOT NULL,
  bbox_h DOUBLE PRECISION NOT NULL
);

-- Mission analysis table
CREATE TABLE public.mission_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  items_before INTEGER NOT NULL DEFAULT 0,
  items_after INTEGER NOT NULL DEFAULT 0,
  improvement_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  co2_saved_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  waste_diverted_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty public.difficulty_level NOT NULL DEFAULT 'EASY'
);

-- Points log table
CREATE TABLE public.points_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User stats policies
CREATE POLICY "Stats are viewable by everyone" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "Users can update own stats" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Zones policies (public read)
CREATE POLICY "Zones are viewable by everyone" ON public.zones FOR SELECT USING (true);

-- Missions policies
CREATE POLICY "Missions are viewable by everyone" ON public.missions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create missions" ON public.missions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own missions" ON public.missions FOR UPDATE USING (auth.uid() = creator_id);

-- Mission media policies
CREATE POLICY "Media is viewable by everyone" ON public.mission_media FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upload media" ON public.mission_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.missions WHERE id = mission_id AND creator_id = auth.uid())
);

-- Detections policies
CREATE POLICY "Detections are viewable by everyone" ON public.detections FOR SELECT USING (true);
CREATE POLICY "System can insert detections" ON public.detections FOR INSERT WITH CHECK (true);

-- Mission analysis policies
CREATE POLICY "Analysis is viewable by everyone" ON public.mission_analysis FOR SELECT USING (true);
CREATE POLICY "System can insert analysis" ON public.mission_analysis FOR INSERT WITH CHECK (true);

-- Points log policies
CREATE POLICY "Points are viewable by everyone" ON public.points_log FOR SELECT USING (true);
CREATE POLICY "System can insert points" ON public.points_log FOR INSERT WITH CHECK (true);

-- Storage bucket for mission images
INSERT INTO storage.buckets (id, name, public) VALUES ('mission-images', 'mission-images', true);

CREATE POLICY "Mission images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'mission-images');
CREATE POLICY "Authenticated users can upload mission images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mission-images' AND auth.role() = 'authenticated');

-- Trigger function for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
