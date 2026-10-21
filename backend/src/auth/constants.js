export const USER_ROLES = Object.freeze({
  RESIDENT: 'resident',
  COLLABORATOR: 'collaborator',
  ADMIN: 'admin',
});

export const USER_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});

export const ROLE_PERMISSIONS = Object.freeze({
  [USER_ROLES.RESIDENT]: [
    'view_dashboard',
    'view_harvests',
    'reserve_harvest',
    'manage_own_profile',
  ],
  [USER_ROLES.COLLABORATOR]: [
    'view_dashboard',
    'view_harvests',
    'reserve_harvest',
    'manage_own_profile',
    'manage_harvests',
    'manage_reservations',
  ],
  [USER_ROLES.ADMIN]: [
    'view_dashboard',
    'view_harvests',
    'reserve_harvest',
    'manage_own_profile',
    'manage_harvests',
    'manage_reservations',
    'view_users',
    'approve_users',
    'change_user_roles',
    'suspend_users',
    'view_strategic_data',
  ],
});

export const ALL_USER_ROLES = Object.values(USER_ROLES);
export const ALL_USER_STATUSES = Object.values(USER_STATUSES);

export function getPermissionsForRoles(roles = []) {
  return [
    ...new Set(
      roles.flatMap((role) => ROLE_PERMISSIONS[role] || []),
    ),
  ];
}
