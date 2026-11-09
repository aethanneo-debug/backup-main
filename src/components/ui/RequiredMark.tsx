/** The required mark beside a label: a star on screen, the word for a screen reader. Shared by Add Training Need (12ad,
 * 12ae) and the justification fields a training outside the TDP gives (SeminarTdpFields.tsx). */
export function RequiredMark() {
  return (
    <>
      <span className="text-rose-600" aria-hidden="true"> *</span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
