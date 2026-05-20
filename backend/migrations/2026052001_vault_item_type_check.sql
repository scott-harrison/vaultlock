-- Restrict vault item types to supported values
ALTER TABLE vault_items
ADD CONSTRAINT vault_items_item_type_check
CHECK (item_type IN ('login', 'note', 'card'));
