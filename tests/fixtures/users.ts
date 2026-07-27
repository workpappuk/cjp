export const TEST_USERS = {
  admin: {
    email: "admin@test.threadforge.dev",
    name: "Admin User",
    role: "admin",
    isAdmin: true,
  },
  user: {
    email: "user@test.threadforge.dev",
    name: "Standard User",
    role: "user",
    isAdmin: false,
  },
  expired: {
    email: "expired@test.threadforge.dev",
    name: "Expired Session User",
    role: "user",
    isAdmin: false,
  },
} as const;
