import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

import type { PrecacheEntry } from "serwist";
declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});
serwist.addEventListeners();
