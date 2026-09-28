/// <reference types="vite/client" />

import type { OfficeApi } from '../preload/index';

declare global {
  interface Window {
    office: OfficeApi;
    /** Must remain undefined — Node integration is disabled. */
    require?: unknown;
    process?: unknown;
  }
}

export {};
