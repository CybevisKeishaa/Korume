# Editing the copy

Every user-visible string lives in `messages/<locale>/<namespace>.json`. These
files are **yours to edit directly** — change the tone, shorten a label, fix a
translation. You do not need to touch any code to do it.

Two things are true at once, and this file exists so you never have to guess
which one you are hitting:

1. **Almost all copy is free.** Labels, descriptions, option names, button
   text, inline hints, empty states. Reword them and the suite stays green.
2. **A small number of sentences carry a promise to the user**, on screens
   where being wrong causes real harm — deleting an account, erasing memory.
   Those are guarded. You can still reword them; the guard just makes you say
   so out loud.

## The rules that apply to every edit

- **Edit both locales, or neither.** `lib/i18n/catalog.test.ts` requires the
  two catalogs to have identical key sets. Adding a key to one alone is the
  one edit that always fails.
- **Keep the `{placeholders}`.** `"{minutes} min"` needs its `{minutes}`;
  dropping it makes the value disappear at runtime.
- Vietnamese is `routing.defaultLocale` — the catalog most users actually
  read. It is not a translation of the English, and it does not have to
  mirror its phrasing.

## What is guarded, and why

Run `npx vitest run messages` to check copy on its own.

| Guard | What it refuses |
| --- | --- |
| `catalog.test.ts` | Keys present in one locale and not the other; broken ICU syntax; a plural missing a branch its locale needs |
| `settings.pin.test.ts` | Copy about **account deletion** that claims the deletion is irreversible or immediate — it is neither, there is a 7-day cancellation window |
| `settings.pin.test.ts` | Copy about **Erase Korume Memory** that stops saying the erase is final, or stops promising that learning progress survives — it IS final, and that promise is the reason it is safe to confirm |
| `*.pin.test.ts` (other namespaces) | Characterization pins from earlier work: the string was extracted from a component and the pin proves the extraction changed nothing |

The two `settings.pin.test.ts` rows pull in opposite directions on purpose:
one forbids a claim that would be false, the other requires a claim that is
true. That is why the deletion dialog and the memory-erase page must never
share copy — the same sentence is a lie on one of them.

## Changing a guarded sentence

A guard checks for a **phrase**, because a claim cannot be checked
mechanically. So:

1. Reword the copy in both locales.
2. Run `npx vitest run messages`.
3. If it goes red, the failure tells you which claim must survive. If your new
   wording still makes that claim, update the expected phrase in
   `settings.pin.test.ts` in the same commit. If it does not, the guard just
   caught a real regression — that is the whole point of it.

Never delete a guard to make a red go away. The forbidden-phrase scans read
the **whole** `settings.json`, deliberately: carving out one block would drop
the protection for every string later nested inside it.

## Why the tests do not pin ordinary labels

Component tests read their labels **from these files**, not from literals typed
into the test:

```ts
import enCatalog from "@/messages/en/settings.json";
const copy = enCatalog.page;

screen.getByRole("radio", { name: copy.difficulty.challenge });
```

A test that hardcoded `"Challenge"` would quietly become a second owner of the
copy: rewording it would fail with `Unable to find an accessible element`,
which says nothing about what changed. Reading from the catalog means the test
asserts what it actually cares about — that the control is named by its own
visible label — and follows you when you edit the words.

Do the same in any new test. Pin a literal only when the literal itself is the
subject: a wire value the server validates, or a wrong word being asserted
absent.
