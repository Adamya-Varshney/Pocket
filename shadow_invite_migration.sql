-- 1. Modify expense_group_members to allow phantom users
ALTER TABLE expense_group_members 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the old function
DROP FUNCTION IF EXISTS invite_user_by_email(UUID, TEXT);

-- 3. Update the RPC function using simple subqueries (no variables)
CREATE OR REPLACE FUNCTION invite_user_by_email(p_group_id UUID, p_email TEXT)
RETURNS void AS $$
BEGIN
  -- Check if they are already in the group to prevent duplicates
  IF EXISTS(
    SELECT 1 FROM expense_group_members 
    WHERE group_id = p_group_id AND member_email = p_email
  ) THEN
     RAISE EXCEPTION 'User is already invited to this group.';
  END IF;

  -- Insert into the ledger.
  -- We do a subquery directly to fetch the user_id if they exist.
  -- If they don't, it naturally inserts NULL, creating the Shadow Member!
  INSERT INTO expense_group_members (group_id, user_id, member_email, role)
  VALUES (
    p_group_id, 
    (SELECT id FROM auth.users WHERE email = p_email LIMIT 1), 
    p_email, 
    'member'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the automated trigger that links shadow members
CREATE OR REPLACE FUNCTION link_shadow_members_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.expense_group_members
  SET user_id = NEW.id
  WHERE member_email = NEW.email AND user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Bind the trigger to auth.users
DROP TRIGGER IF EXISTS trigger_link_shadow_members ON auth.users;
CREATE TRIGGER trigger_link_shadow_members
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.link_shadow_members_on_signup();
