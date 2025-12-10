"use client";

import { useUser } from "@/providers/UserContext";

export default function GlobalLoadingWrapper({ children }: { children: React.ReactNode }) {
  const { loading, authCompleted } = useUser();

  // Show loading until auth check is complete
  if (loading || !authCompleted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
      </div>
    );
  }

  return <>{children}</>;
}
