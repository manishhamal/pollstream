-- Drop existing function if it exists
DROP FUNCTION IF EXISTS increment_vote_count();

-- Create a function to increment vote count
CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment the vote_count for the option that was voted on
  UPDATE options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that fires after a vote is inserted
DROP TRIGGER IF EXISTS trigger_increment_vote_count ON votes;
CREATE TRIGGER trigger_increment_vote_count
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION increment_vote_count();
