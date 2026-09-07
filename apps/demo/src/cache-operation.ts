/** UI 状态更新前即获取互斥，确保双击不会发起两次清理。 */
export function createCacheOperation() {
  let busy = false;
  return {
    get busy() { return busy; },
    async run(actions: { cancel(): void; wait(): Promise<unknown>; dispose(): Promise<void>; clear(): Promise<void> }): Promise<boolean> {
      if (busy) return false;
      busy = true;
      try { actions.cancel(); await actions.wait(); await actions.dispose(); await actions.clear(); return true; }
      finally { busy = false; }
    },
  };
}
