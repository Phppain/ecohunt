
-- Fix overly permissive INSERT policies
DROP POLICY "System can insert detections" ON public.detections;
DROP POLICY "System can insert analysis" ON public.mission_analysis;
DROP POLICY "System can insert points" ON public.points_log;

-- Detections: only mission creators can insert
CREATE POLICY "Mission creators can insert detections" ON public.detections FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mission_media mm
    JOIN public.missions m ON m.id = mm.mission_id
    WHERE mm.id = mission_media_id AND m.creator_id = auth.uid()
  )
);

-- Analysis: only mission creators can insert
CREATE POLICY "Mission creators can insert analysis" ON public.mission_analysis FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.creator_id = auth.uid()
  )
);

-- Points: only for own user
CREATE POLICY "Users can insert own points" ON public.points_log FOR INSERT WITH CHECK (auth.uid() = user_id);
