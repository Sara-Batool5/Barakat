import type { Head } from "../i18n/translations";

/** Renders a headline with its accent phrase in the primary green. */
export function Headline({ text }: { text: Head }) {
  return (
    <>
      {text.pre}
      <span className="text-primary">{text.accent}</span>
    </>
  );
}
