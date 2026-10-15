import { useEffect, useState } from "react";

/** Expire market badges even when no network request or trade causes a render. */
export function useMarketClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
