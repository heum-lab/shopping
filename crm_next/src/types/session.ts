export type AdminLevel = 1 | 2 | 3;

export type SessionData = {
  adminIdx: number;
  adminId: string;
  adminName: string;
  adminLevel: AdminLevel;
  adminAgencyIdx: number;
  adminSellerIdx: number;
};

export const emptySession = (): Partial<SessionData> => ({});
