/* Focus back to a picker's opener once its panel has closed (find spec, section 4: Escape and a choice return to the
   field). It waits a frame, so the opener the closed field draws (Pick's "Change" once something is chosen) is the one
   focused. In that frame a person may already be somewhere else: they clicked or tabbed on, or a fast keyboard (or a
   slow phone) moved on before the frame came. Then focus stays where they put it. Before 15 Nov it was always taken
   back: on a slow page the frame landed after the next field was focused, and the keys meant for it went to the opener
   (U159 cleared “Which part” into the button, so the old part was saved; U109's From panel lost its week box). */
export function focusBackLater(opener: { current: HTMLElement | null }) {
  requestAnimationFrame(() => {
    const now = document.activeElement;
    // The panel that held focus is gone, so focus fell to the page: nothing has taken it since.
    if (now && now !== document.body && now !== document.documentElement) return;
    opener.current?.focus();
  });
}
