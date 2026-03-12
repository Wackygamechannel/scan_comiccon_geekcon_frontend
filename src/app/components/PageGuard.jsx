"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useGlobal } from "@/utils/global";

const isAuthenticated = (user) => !!user?.accessToken;
const isUnauthenticated = (user) => !user?.accessToken;

const conditionMap = {
  isAuthenticated,
  isUnauthenticated,
};

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function PageGuard({ children, condition, redirectPath }) {
  const { user } = useGlobal();
  const isMounted = useIsMounted();

  const shouldRedirect =
    isMounted &&
    (typeof condition === "function"
      ? condition(user)
      : conditionMap[condition]?.(user));

  useEffect(() => {
    if (!isMounted || !shouldRedirect) return;

    window.location.replace(redirectPath);
  }, [isMounted, redirectPath, shouldRedirect]);

  if (!isMounted || shouldRedirect) {
    return null;
  }

  return children;
}
