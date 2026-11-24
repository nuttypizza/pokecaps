"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Card data couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-neutral-500">
        The database didn&apos;t answer in time. If this keeps happening, check that DATABASE_URL is set in the hosting
        settings.
      </p>
      <button
        onClick={() => retry()}
        className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Try again
      </button>
    </div>
  );
}
