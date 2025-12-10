"use client";

import { useUser } from "@/providers/UserContext";
import AITextLoading from "@/components/ui/AITextLoading";

export default function GlobalLoadingWrapper({ children }: { children: React.ReactNode }) {
  const { loading, authCompleted } = useUser();

  // Show loading until auth check is complete
  if (loading || !authCompleted) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <AITextLoading />
      </div>
    );
  }

  return <>{children}</>;
}
