-- Update the increment_vote_count function to be SECURITY DEFINER
-- This allows it to bypass RLS and update the options table
-- even if the user doesn't have explicit UPDATE permissions on the options table.
CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment the vote_count for the option that was voted on
  UPDATE options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
