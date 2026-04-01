"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-[var(--text-secondary)]">{error.message}</p>
        <button
          onClick={() => reset()}
          className="btn-primary px-6 py-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
