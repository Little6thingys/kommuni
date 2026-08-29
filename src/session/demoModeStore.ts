let demoMode = false;

export function setDemoMode(enabled: boolean): void {
  demoMode = enabled;
}

export function isDemoMode(): boolean {
  return demoMode;
}
