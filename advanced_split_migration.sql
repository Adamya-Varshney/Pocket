-- Add the JSONB column to support complex Splitwise-level ledger configurations
ALTER TABLE expense_group_transactions
ADD COLUMN IF NOT EXISTS advanced_split JSONB;
