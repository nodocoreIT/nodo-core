UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "medico"}'::jsonb                   
  WHERE email = 'medico@nodocore.com';          