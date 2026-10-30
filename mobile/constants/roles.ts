export const ROLE_GUEST = 0;
export const ROLE_MEMBER = 1;
export const ROLE_MODERATOR = 3;
export const ROLE_ADMIN = 4;
export const ROLE_SUPER_ADMIN = 5;

export const isSuperAdmin = (roleId?: number | string) => Number(roleId) === ROLE_SUPER_ADMIN;
export const isAdmin = (roleId?: number | string) => Number(roleId) >= ROLE_ADMIN;
export const isModerator = (roleId?: number | string) => Number(roleId) >= ROLE_MODERATOR;
