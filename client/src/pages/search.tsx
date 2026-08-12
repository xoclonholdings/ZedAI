import { useEffect } from "react";

import { useConsoleBrowser } from "@/console/ConsoleBrowserContext";

/** Opens the real Console browser in the shared adaptive content region. */
export default function SearchPage() {
  const { openFullPage } = useConsoleBrowser();

  useEffect(() => {
    openFullPage();
  }, [openFullPage]);

  return null;
}
