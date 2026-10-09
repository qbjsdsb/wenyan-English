/** Global study keys must yield to controls, dialogs and input methods. */
export function ignoresStudyKey(event: KeyboardEvent): boolean {
  const target = event.target
  return event.isComposing || event.keyCode === 229 || event.repeat ||
    (target instanceof HTMLElement && Boolean(target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="switch"], [role="slider"], [role="tab"], [data-study-controls]',
    )))
}
