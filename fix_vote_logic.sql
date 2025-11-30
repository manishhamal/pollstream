-- 1. Add unique constraint to prevent multiple votes per user per poll
-- This ensures data integrity at the database level
ALTER TABLE public.votes 
ADD CONSTRAINT votes_poll_id_user_id_key UNIQUE (poll_id, user_id);

-- 2. Drop the flawed revote function
DROP FUNCTION IF EXISTS public.revote(uuid, uuid, uuid);

-- 3. Create the corrected revote function
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
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Validate inputs
  IF p_poll_id IS NULL OR p_new_option_id IS NULL THEN
    RAISE EXCEPTION 'Poll ID and New Option ID must be provided';
  END IF;

  -- If user is logged in, find their specific vote
  IF v_user_id IS NOT NULL THEN
    SELECT id, option_id INTO v_vote_id, v_actual_old_option_id
    FROM public.votes
    WHERE poll_id = p_poll_id AND user_id = v_user_id;
  ELSE
    -- For anonymous users (if supported), we might need to rely on the passed old_option_id
    -- But ideally, we should only allow revoting for logged-in users or use a different mechanism
    -- For now, we'll try to find a vote matching the old criteria if provided
    IF p_old_option_id IS NOT NULL THEN
        SELECT id INTO v_vote_id
        FROM public.votes
        WHERE poll_id = p_poll_id AND option_id = p_old_option_id
        ORDER BY created_at DESC LIMIT 1;
        v_actual_old_option_id := p_old_option_id;
    END IF;
  END IF;

  -- If we found a vote, update it
  IF v_vote_id IS NOT NULL THEN
    -- Update the vote record
    UPDATE public.votes
    SET option_id = p_new_option_id,
        created_at = timezone('utc'::text, now())
    WHERE id = v_vote_id;
    
    -- Manually adjust counts (since trigger only fires on INSERT)
    -- Decrement old option count
    UPDATE public.options
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = v_actual_old_option_id;
    
    -- Increment new option count
    UPDATE public.options
    SET vote_count = vote_count + 1
    WHERE id = p_new_option_id;
  ELSE
    -- If no existing vote found, treat as a new vote (should be caught by unique constraint if logged in)
    INSERT INTO public.votes (poll_id, option_id, user_id)
    VALUES (p_poll_id, p_new_option_id, v_user_id);
    -- Trigger will handle increment
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.revote(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revote(uuid, uuid, uuid) TO anon;
