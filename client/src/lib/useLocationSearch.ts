import { useEffect, useState } from "react";

const LOCATION_SEARCH_CHANGE = "zar-location-search-change";

let activeSubscribers = 0;
let originalPushState: History["pushState"] | null = null;
let originalReplaceState: History["replaceState"] | null = null;

function readSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

function emitLocationSearchChange() {
  window.dispatchEvent(new Event(LOCATION_SEARCH_CHANGE));
}

function patchHistory() {
  if (typeof window === "undefined" || originalPushState || originalReplaceState) return;

  originalPushState = window.history.pushState;
  originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(
    ...args: Parameters<History["pushState"]>
  ) {
    const result = originalPushState!.apply(this, args);
    emitLocationSearchChange();
    return result;
  } as History["pushState"];

  window.history.replaceState = function replaceState(
    ...args: Parameters<History["replaceState"]>
  ) {
    const result = originalReplaceState!.apply(this, args);
    emitLocationSearchChange();
    return result;
  } as History["replaceState"];
}

function restoreHistory() {
  if (typeof window === "undefined") return;
  if (originalPushState) window.history.pushState = originalPushState;
  if (originalReplaceState) window.history.replaceState = originalReplaceState;
  originalPushState = null;
  originalReplaceState = null;
}

export function useLocationSearch(): string {
  const [search, setSearch] = useState(readSearch);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    activeSubscribers += 1;
    patchHistory();

    const update = () => setSearch(readSearch());

    window.addEventListener("popstate", update);
    window.addEventListener(LOCATION_SEARCH_CHANGE, update);
    update();

    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(LOCATION_SEARCH_CHANGE, update);
      activeSubscribers -= 1;
      if (activeSubscribers <= 0) restoreHistory();
    };
  }, []);

  return search;
}
