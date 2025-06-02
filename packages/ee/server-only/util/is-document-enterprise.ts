import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';

export type IsUserEnterpriseOptions = {
  userId: number;
  teamId?: number;
};

/**
 * Whether the user is enterprise, or has permission to use enterprise features on
 * behalf of their team.
 *
 * It is assumed that the provided user is part of the provided team.
 */
export const isUserEnterprise = ({
  userId: _userId,
  teamId: _teamId,
}: IsUserEnterpriseOptions): boolean => {
  if (!IS_BILLING_ENABLED()) {
    return true; // Allow enterprise features when billing is disabled (development mode)
  }

  // Always return true to make all users Enterprise by default
  return true;
};
