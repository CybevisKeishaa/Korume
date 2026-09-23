import type { SettingsIconKey } from "./settings-icon";
import { SettingsIcon } from "./settings-icon";

/**
 * One control in a `SettingsSection`: icon, label, description, control slot
 * (spec §5).
 *
 * **The label is a `<label htmlFor>` only when the control can take one.**
 * `htmlFor` is optional and the element switches with it: a `Select` and a
 * `Switch` accept an `id`, so their label is a real `<label>` and clicking the
 * text reaches the control. A `SegmentedControl` is a radiogroup and a day
 * picker is a group of buttons — neither is a labelable element, and a
 * `<label for>` pointing at one is silently ignored by browsers while still
 * reading as correct in the source. Those rows pass no `htmlFor`, render a
 * `<span>`, and name their control with `aria-label` instead.
 *
 * `description` is wired to the control through `aria-describedby` by the
 * CALLER, not here — only the caller knows which element the id belongs on.
 * The id is handed back so it cannot drift: `SettingsRow` owns the text and
 * the caller owns the association.
 */
export function SettingsRow({
  icon,
  label,
  description,
  control,
  htmlFor,
  descriptionId,
  children,
}: {
  icon: SettingsIconKey;
  label: string;
  description: string;
  /** The control itself. Rendered at the end of the row. */
  control: React.ReactNode;
  /** The control's `id`, when it is a labelable element. */
  htmlFor?: string;
  descriptionId?: string;
  /** Anything that belongs under the row — a day picker, an inline hint. */
  children?: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className="py-md">
      <div className="flex items-start gap-sm">
        <SettingsIcon name={icon} className="mt-2xs shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Label
            {...(htmlFor ? { htmlFor } : {})}
            className="block text-body font-medium text-foreground"
          >
            {label}
          </Label>
          <p id={descriptionId} className="mt-2xs text-caption text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="shrink-0 ps-sm">{control}</div>
      </div>
      {children}
    </div>
  );
}
