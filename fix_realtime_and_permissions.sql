-- 1. Enable Realtime for the options table
-- This is critical for users to see updates live without refreshing
BEGIN;
  -- Try to add the table to the publication. 
  -- We use a DO block to avoid errors if it's already added or if the publication doesn't exist in a standard way
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'options'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.options;
    END IF;
  END
  $$;
COMMIT;

-- 2. Force the increment trigger to be SECURITY DEFINER
-- This allows anonymous/non-admin users to increment the count via the trigger
CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Force the revote function to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.revote(
  p_poll_id uuid, 
  p_old_option_id uuid, 
  p_new_option_id uuid
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_vote_id uuid;
  v_actual_old_option_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT id, option_id INTO v_vote_id, v_actual_old_option_id
    FROM public.votes
    WHERE poll_id = p_poll_id AND user_id = v_user_id;
  ELSE
    IF p_old_option_id IS NOT NULL THEN
        SELECT id INTO v_vote_id
        FROM public.votes
        WHERE poll_id = p_poll_id AND option_id = p_old_option_id
        ORDER BY created_at DESC LIMIT 1;
        v_actual_old_option_id := p_old_option_id;
    END IF;
  END IF;

  IF v_vote_id IS NOT NULL THEN
    UPDATE public.votes
    SET option_id = p_new_option_id,
        created_at = timezone('utc'::text, now())
    WHERE id = v_vote_id;
    
    UPDATE public.options
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = v_actual_old_option_id;
    
    UPDATE public.options
    SET vote_count = vote_count + 1
    WHERE id = p_new_option_id;
  ELSE
    INSERT INTO public.votes (poll_id, option_id, user_id)
    VALUES (p_poll_id, p_new_option_id, v_user_id);
  END IF;
END;
$$;
