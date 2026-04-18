-- Create table to store image match history
CREATE TABLE public.image_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_a_url TEXT NOT NULL,
  image_b_url TEXT NOT NULL,
  instruction JSONB NOT NULL,
  result JSONB NOT NULL,
  overall_similarity NUMERIC,
  verdict TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "image_matches_select_public" ON public.image_matches FOR SELECT USING (true);
CREATE POLICY "image_matches_insert_public" ON public.image_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "image_matches_delete_public" ON public.image_matches FOR DELETE USING (true);

CREATE INDEX idx_image_matches_created_at ON public.image_matches (created_at DESC);