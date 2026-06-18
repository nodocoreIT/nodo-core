/** Contract is archived (operational views hide it; paid history kept). */
export function isArchivedContract(
  contract: { archived_at?: string | null } | null | undefined,
): boolean {
  return contract?.archived_at != null;
}
