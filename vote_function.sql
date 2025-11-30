-- Drop existing function if it exists (to ensure clean recreation)
DROP FUNCTION IF EXISTS public.record_vote(uuid, uuid);

-- Create a function to record a vote and increment the count atomically
CREATE OR REPLACE FUNCTION public.record_vote(
  p_poll_id uuid, 
  p_option_id uuid
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  IF p_poll_id IS NULL OR p_option_id IS NULL THEN
    RAISE EXCEPTION 'All parameters must be provided';
  END IF;

  -- Insert the vote (the trigger will automatically increment vote_count)
  INSERT INTO public.votes (poll_id, option_id)
  VALUES (p_poll_id, p_option_id);
  
  -- Note: vote_count is incremented by the trigger increment_vote_count()
  -- No need to manually increment here to avoid double counting
END;
$$;

-- Grant execute permission to authenticated and anon users (required for Supabase RPC)
GRANT EXECUTE ON FUNCTION public.record_vote(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_vote(uuid, uuid) TO anon;
