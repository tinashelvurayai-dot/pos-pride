import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function hasUnlock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem("manager_unlock") === "true" ||
      localStorage.getItem("cashier_unlock") === "true"
    );
  } catch {
    return false;
  }
}

function AuthGate() {
  const { session, loading } = useAuth();
  const unlocked = hasUnlock();
  // Offline / unlocked-by-code path: don't wait for network auth.
  if (unlocked) return <Outlet />;
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!session) return <Navigate to="/" />;
  return <Outlet />;
}
