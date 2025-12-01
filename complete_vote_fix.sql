-- COMPLETE VOTE FIX SCRIPT
-- Run this in your Supabase SQL Editor to fix all voting issues

-- 1. Enable Realtime for the options table (Critical for live updates)
BEGIN;
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

-- 2. Create the increment_vote_count function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment the vote_count for the option that was voted on
  UPDATE public.options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on the votes table
DROP TRIGGER IF EXISTS trigger_increment_vote_count ON public.votes;
CREATE TRIGGER trigger_increment_vote_count
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION increment_vote_count();

-- 4. Fix the revote function (Handles changing votes)
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
  
  -- Find the existing vote
  IF v_user_id IS NOT NULL THEN
    SELECT id, option_id INTO v_vote_id, v_actual_old_option_id
    FROM public.votes
    WHERE poll_id = p_poll_id AND user_id = v_user_id;
  ELSE
    -- Fallback for anonymous (if needed, though ideally we require auth)
    IF p_old_option_id IS NOT NULL THEN
        SELECT id INTO v_vote_id
        FROM public.votes
        WHERE poll_id = p_poll_id AND option_id = p_old_option_id
        ORDER BY created_at DESC LIMIT 1;
        v_actual_old_option_id := p_old_option_id;
    END IF;
  END IF;

  IF v_vote_id IS NOT NULL THEN
    -- Update the vote record
    UPDATE public.votes
    SET option_id = p_new_option_id,
        created_at = timezone('utc'::text, now())
    WHERE id = v_vote_id;
    
    -- Manually adjust counts (Trigger only fires on INSERT)
    UPDATE public.options
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = v_actual_old_option_id;
    
    UPDATE public.options
    SET vote_count = vote_count + 1
    WHERE id = p_new_option_id;
  ELSE
    -- If not found, insert new (Trigger will handle increment)
    INSERT INTO public.votes (poll_id, option_id, user_id)
    VALUES (p_poll_id, p_new_option_id, v_user_id);
  END IF;
END;
$$;

-- 5. Fix the record_vote function (For initial votes via RPC)
CREATE OR REPLACE FUNCTION public.record_vote(
  p_poll_id uuid, 
  p_option_id uuid
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Insert the vote (The trigger defined above will automatically increment vote_count)
  INSERT INTO public.votes (poll_id, option_id, user_id)
  VALUES (p_poll_id, p_option_id, v_user_id);
END;
$$;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.revote(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revote(uuid, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.record_vote(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_vote(uuid, uuid) TO anon;

-- 7. Ensure RLS policies allow viewing options (so Realtime works)
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Options are viewable by everyone" ON public.options;
CREATE POLICY "Options are viewable by everyone" 
ON public.options FOR SELECT 
USING (true);
