import type { Alpine } from "alpinejs";
import { registerFlashnoteStore } from "./modules/flashnote/store";

export default function initAlpine(Alpine: Alpine) {
  registerFlashnoteStore(Alpine);

  if (typeof window !== "undefined") {
    window.Alpine = Alpine;
  }
}
