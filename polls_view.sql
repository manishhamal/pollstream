-- Create a view that joins polls with user emails
CREATE OR REPLACE VIEW polls_with_creator AS
SELECT 
  p.*,
  u.email as creator_email
FROM polls p
LEFT JOIN auth.users u ON p.creator_id = u.id;

-- Grant access to the view
GRANT SELECT ON polls_with_creator TO authenticated, anon;
