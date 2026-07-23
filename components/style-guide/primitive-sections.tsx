"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Popover } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n";

function Demo({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-md">
      <h3 className="text-body-lg font-medium">{name}</h3>
      <div className="mt-sm">{children}</div>
    </div>
  );
}

export function PrimitiveSections() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [level, setLevel] = useState<string | undefined>();
  const { toast } = useToast();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  return (
    <section aria-labelledby="sg-primitives">
      <h2 id="sg-primitives" className="text-heading font-semibold">{t("styleGuide.sections.primitives.heading")}</h2>
      <div className="mt-md grid gap-md lg:grid-cols-2">
        <Demo name={t("styleGuide.primitives.demo.button")}>
          <div className="flex flex-wrap items-center gap-xs">
            <Button>{t("styleGuide.primitives.button.primary")}</Button>
            <Button variant="secondary">{t("styleGuide.primitives.button.secondary")}</Button>
            <Button variant="outline">{t("styleGuide.primitives.button.outline")}</Button>
            <Button variant="ghost">{t("styleGuide.primitives.button.ghost")}</Button>
            <Button disabled>{t("styleGuide.primitives.button.disabled")}</Button>
            <Button size="sm">{t("styleGuide.primitives.button.small")}</Button>
            <Button size="lg">{t("styleGuide.primitives.button.large")}</Button>
          </div>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.badge")}>
          {/* Variant NAMES, not chrome (D8): each badge demos its own variant
              identifier, the same way PRIMITIVE_COLORS' "--washi-50" etc. stay
              untranslated in token-sections.tsx. */}
          <div className="flex flex-wrap items-center gap-xs">
            <Badge>neutral</Badge>
            <Badge variant="primary">primary</Badge>
            <Badge variant="accent">accent</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="outline">outline</Badge>
          </div>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.skeleton")}>
          <div className="space-y-xs">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.dialog")}>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            {t("styleGuide.primitives.dialog.open")}
          </Button>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title={t("styleGuide.primitives.dialog.title")}
            description={t("styleGuide.primitives.dialog.description")}
            closeLabel={tCommon("a11y.closeDialog")}
          >
            <Button onClick={() => setDialogOpen(false)}>{t("styleGuide.primitives.dialog.done")}</Button>
          </Dialog>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.tabs")}>
          <Tabs defaultValue="one">
            <TabsList aria-label={t("styleGuide.primitives.tabs.ariaLabel")}>
              <TabsTrigger value="one">{t("styleGuide.primitives.tabs.first")}</TabsTrigger>
              <TabsTrigger value="two">{t("styleGuide.primitives.tabs.second")}</TabsTrigger>
            </TabsList>
            <TabsContent value="one">{t("styleGuide.primitives.tabs.firstPanel")}</TabsContent>
            <TabsContent value="two">{t("styleGuide.primitives.tabs.secondPanel")}</TabsContent>
          </Tabs>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.select")}>
          {/* aria-label reuses common.a11y.levelFilter — the same "JLPT level"
              copy already used by the learner-facing level filter. JLPT N5/
              N4/N3 option labels stay untranslated (D8: exam level codes). */}
          <Select
            aria-label={tCommon("a11y.levelFilter")}
            placeholder={t("styleGuide.primitives.select.placeholder")}
            value={level}
            onValueChange={setLevel}
            options={[
              { value: "n5", label: "JLPT N5" },
              { value: "n4", label: "JLPT N4" },
              { value: "n3", label: "JLPT N3", disabled: true },
            ]}
          />
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.tooltip")}>
          <Tooltip content={t("styleGuide.primitives.tooltip.content")}>
            <Button variant="outline">{t("styleGuide.primitives.tooltip.trigger")}</Button>
          </Tooltip>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.popover")}>
          <Popover trigger={<Button variant="outline">{t("styleGuide.primitives.popover.trigger")}</Button>}>
            <p className="text-body">{t("styleGuide.primitives.popover.content")}</p>
          </Popover>
        </Demo>

        <Demo name={t("styleGuide.primitives.demo.toast")}>
          <div className="flex flex-wrap gap-xs">
            <Button
              variant="outline"
              onClick={() => toast({ title: t("styleGuide.primitives.toast.savedTitle"), variant: "success" })}
            >
              {t("styleGuide.primitives.toast.success")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: t("styleGuide.primitives.toast.failedTitle"),
                  description: t("styleGuide.primitives.toast.failedDescription"),
                  variant: "danger",
                })
              }
            >
              {t("styleGuide.primitives.toast.danger")}
            </Button>
          </div>
        </Demo>
      </div>
    </section>
  );
}
