-- Add admin role column to users metadata
-- This will be stored in the auth.users table's raw_user_meta_data

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = user_id 
    AND (
      raw_user_meta_data->>'is_admin' = 'true'
      OR email = 'manishml.dev@gmail.com'  -- Replace with your actual email
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policy for polls deletion (only admins can delete)
DROP POLICY IF EXISTS "Admins can delete any poll" ON polls;
CREATE POLICY "Admins can delete any poll" ON polls
  FOR DELETE
  USING (is_admin(auth.uid()));
