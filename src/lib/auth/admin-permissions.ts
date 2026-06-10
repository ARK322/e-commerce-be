import type { AdminRole } from '../../db/auth/admin.model';

export const canManageSellers = (_role: AdminRole) => true;

export const canListAdmins = (_role: AdminRole) => true;

export const canCreateAdminRole = (creatorRole: AdminRole, targetRole: AdminRole) => {
  if (creatorRole === 'owner') {
    return true;
  }

  return creatorRole === 'helper' && targetRole === 'helper';
};

export const canDeleteAdmin = (actorRole: AdminRole) => actorRole === 'owner';
