/** Query-only policy used by the tag index to divide visible and hidden groups. */
export interface TagVisibilityPolicy {
  isShown(key: string, dayCount: number): boolean
}

/** Adds the user's explicit show/hide choice to the read policy. */
export interface TagVisibilitySettings extends TagVisibilityPolicy {
  setShown(key: string, shown: boolean): void
}
