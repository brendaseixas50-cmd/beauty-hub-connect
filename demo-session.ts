import type { PlatformSession } from "./types";

const now = "2026-07-31T12:00:00.000Z";

export const demoSessions = {
  beauty: {
    account: {
      id: "acct-beauty",
      name: "Mariana Costa",
      email: "mariana@demo.luia.studio",
      role: "customer",
    },
    organization: {
      id: "org-beauty",
      ownerAccountId: "acct-beauty",
      name: "Ateliê Bella Beauty",
      slug: "atelie-bella-beauty",
      createdAt: now,
    },
    accesses: [
      {
        id: "access-beauty",
        accountId: "acct-beauty",
        organizationId: "org-beauty",
        productCode: "lu-beauty",
        accessType: "subscription",
        status: "active",
        startsAt: now,
        source: "manual",
      },
    ],
  },
  barber: {
    account: {
      id: "acct-barber",
      name: "Rafael Almeida",
      email: "rafael@demo.luia.studio",
      role: "customer",
    },
    organization: {
      id: "org-barber",
      ownerAccountId: "acct-barber",
      name: "Barbearia Alpha",
      slug: "barbearia-alpha",
      createdAt: now,
    },
    accesses: [
      {
        id: "access-barber",
        accountId: "acct-barber",
        organizationId: "org-barber",
        productCode: "lu-barber",
        accessType: "subscription",
        status: "active",
        startsAt: now,
        source: "manual",
      },
    ],
  },
  both: {
    account: {
      id: "acct-both",
      name: "Conta Lu IA Studio",
      email: "cliente@demo.luia.studio",
      role: "customer",
    },
    organization: {
      id: "org-both",
      ownerAccountId: "acct-both",
      name: "Grupo Studio Prime",
      slug: "studio-prime",
      createdAt: now,
    },
    accesses: [
      {
        id: "access-both-beauty",
        accountId: "acct-both",
        organizationId: "org-both",
        productCode: "lu-beauty",
        accessType: "subscription",
        status: "active",
        startsAt: now,
        source: "manual",
      },
      {
        id: "access-both-barber",
        accountId: "acct-both",
        organizationId: "org-both",
        productCode: "lu-barber",
        accessType: "subscription",
        status: "active",
        startsAt: now,
        source: "manual",
      },
    ],
  },
} satisfies Record<string, PlatformSession>;

export type DemoSessionKey = keyof typeof demoSessions;
