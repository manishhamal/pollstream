-- Drop existing function if it exists (to ensure clean recreation)
DROP FUNCTION IF EXISTS public.revote(uuid, uuid, uuid);

-- Create a function to handle revoting (decrement old option, increment new option)
-- This function must be in the public schema for Supabase RPC calls
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
  v_vote_id uuid;
BEGIN
  -- Validate inputs
  IF p_poll_id IS NULL OR p_old_option_id IS NULL OR p_new_option_id IS NULL THEN
    RAISE EXCEPTION 'All parameters must be provided';
  END IF;

  -- Find the most recent vote for this poll with the old option
  -- This handles anonymous voting where we can't identify the specific user
  SELECT id INTO v_vote_id
  FROM public.votes
  WHERE poll_id = p_poll_id 
    AND option_id = p_old_option_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If we found a vote record, update it to the new option
  IF v_vote_id IS NOT NULL THEN
    UPDATE public.votes
    SET option_id = p_new_option_id,
        created_at = timezone('utc'::text, now())
    WHERE id = v_vote_id;
    
    -- Since we're UPDATING (not inserting), the trigger won't fire
    -- So we need to manually adjust the vote counts
    UPDATE public.options
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = p_old_option_id;
    
    UPDATE public.options
    SET vote_count = vote_count + 1
    WHERE id = p_new_option_id;
  ELSE
    -- Fallback: If no vote record found (shouldn't happen in normal revote flow)
    -- Insert new vote and let trigger handle the increment
    INSERT INTO public.votes (poll_id, option_id)
    VALUES (p_poll_id, p_new_option_id);
    -- Trigger will increment new_option_id, but we still need to decrement old
    UPDATE public.options
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = p_old_option_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated and anon users (required for Supabase RPC)
GRANT EXECUTE ON FUNCTION public.revote(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revote(uuid, uuid, uuid) TO anon;
