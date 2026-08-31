let developerMode = false;

export function setDeveloperMode(enabled: boolean): void {
  developerMode = enabled;
}

export function isDeveloperMode(): boolean {
  return developerMode;
}
