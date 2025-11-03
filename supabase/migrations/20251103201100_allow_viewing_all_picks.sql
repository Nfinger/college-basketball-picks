-- Allow users to view all picks (for simple 2-user setup)
-- This replaces the restrictive policy that only showed own picks

-- Drop the restrictive policy
DROP POLICY "Users can view own picks" ON picks;

-- Create new policy allowing everyone to view all picks
CREATE POLICY "Users can view all picks" ON picks
  FOR SELECT USING (true);
