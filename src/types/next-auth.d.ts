import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Entra Object ID – stabil pro User und Tenant */
      id: string;
      roles: string[];
      tenantId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    oid?: string;
    tid?: string;
    roles?: string[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    oid?: string;
    tid?: string;
    roles?: string[];
  }
}
