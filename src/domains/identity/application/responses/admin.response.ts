type AdminRecord = {
  _id: unknown;
  roleId: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdBy?: unknown;
  createdAt?: Date;
};

type AdminUserRecord = {
  email?: string;
  isEmailVerified?: boolean;
  createdAt?: Date;
};

type RoleSummary = {
  roleId: string;
  name: string;
  slug: string;
};

export const formatAdminResponse = (
  admin: AdminRecord,
  user?: AdminUserRecord | null,
  role?: RoleSummary
) => ({
  userId: admin._id,
  email: user?.email,
  isEmailVerified: user?.isEmailVerified,
  roleId: admin.roleId,
  role: role ?? null,
  createdAt: user?.createdAt ?? admin.createdAt,
  createdBy: admin.createdBy,
  profile: {
    firstName: admin.firstName ?? null,
    lastName: admin.lastName ?? null,
    phone: admin.phone ?? null,
  },
});
