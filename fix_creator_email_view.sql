-- Drop the existing view if it exists
DROP VIEW IF EXISTS polls_with_creator;

-- Create a security definer function to access auth.users
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated, anon;

-- Recreate the view using the function
CREATE OR REPLACE VIEW polls_with_creator AS
SELECT 
  p.*,
  get_user_email(p.creator_id) as creator_email
FROM polls p;

-- Grant access to the view
GRANT SELECT ON polls_with_creator TO authenticated, anon;
