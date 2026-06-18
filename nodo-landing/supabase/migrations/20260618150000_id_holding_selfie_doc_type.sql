-- Allow id_holding_selfie doc type for professional node onboarding

alter table nodo_core.registration_verification_docs
  drop constraint if exists registration_verification_docs_doc_type_check;

alter table nodo_core.registration_verification_docs
  add constraint registration_verification_docs_doc_type_check
  check (doc_type in ('id_photo', 'id_holding_selfie', 'selfie', 'credit_card', 'debit_card', 'payment_proof', 'other'));
