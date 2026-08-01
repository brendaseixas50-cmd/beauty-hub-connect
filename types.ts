export type ProductCode = "lu-beauty" | "lu-barber";

export type AccessType =
  | "subscription"
  | "courtesy"
  | "internal-trial"
  | "lifetime"
  | "admin";

export type AccessStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "refunded"
  | "expired"
  | "blocked";

export type AccountRole = "customer" | "admin" | "support";

export type CustomerAccount = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: AccountRole;
};

export type Organization = {
  id: string;
  ownerAccountId: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type ProductAccess = {
  id: string;
  accountId: string;
  organizationId: string;
  productCode: ProductCode;
  accessType: AccessType;
  status: AccessStatus;
  startsAt: string;
  expiresAt?: string;
  source: "manual" | "hotmart" | "kiwify" | "admin";
};

export type PlatformSession = {
  account: CustomerAccount;
  organization: Organization;
  accesses: ProductAccess[];
};
