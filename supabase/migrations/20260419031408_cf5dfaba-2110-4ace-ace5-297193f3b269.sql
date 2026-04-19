ALTER TABLE public.image_matches
ADD COLUMN IF NOT EXISTS input_hash text;

CREATE INDEX IF NOT EXISTS image_matches_input_hash_idx
ON public.image_matches (input_hash);