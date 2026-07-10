-- Drop the check constraint that restricts property_type to a fixed enum.
-- property_type is now a free-text field so users can create custom types.
alter table nodo_inmo.properties
  drop constraint if exists properties_property_type_check;
