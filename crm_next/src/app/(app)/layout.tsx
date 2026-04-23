import AppShell from "@/components/AppShell";
import { getAuthSession } from "@/lib/auth-guard";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  return <AppShell session={session}>{children}</AppShell>;
}
