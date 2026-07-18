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

  return (
    <section aria-labelledby="sg-primitives">
      <h2 id="sg-primitives" className="text-heading font-semibold">Primitives</h2>
      <div className="mt-md grid gap-md lg:grid-cols-2">
        <Demo name="Button">
          <div className="flex flex-wrap items-center gap-xs">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </Demo>

        <Demo name="Badge">
          <div className="flex flex-wrap items-center gap-xs">
            <Badge>neutral</Badge>
            <Badge variant="primary">primary</Badge>
            <Badge variant="accent">accent</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="outline">outline</Badge>
          </div>
        </Demo>

        <Demo name="Skeleton">
          <div className="space-y-xs">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Demo>

        <Demo name="Dialog">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Example dialog"
            description="Focus is trapped; Escape and backdrop close it."
          >
            <Button onClick={() => setDialogOpen(false)}>Done</Button>
          </Dialog>
        </Demo>

        <Demo name="Tabs">
          <Tabs defaultValue="one">
            <TabsList aria-label="Example tabs">
              <TabsTrigger value="one">First</TabsTrigger>
              <TabsTrigger value="two">Second</TabsTrigger>
            </TabsList>
            <TabsContent value="one">First panel — arrow keys move selection.</TabsContent>
            <TabsContent value="two">Second panel.</TabsContent>
          </Tabs>
        </Demo>

        <Demo name="Select">
          <Select
            aria-label="JLPT level"
            placeholder="Choose a level"
            value={level}
            onValueChange={setLevel}
            options={[
              { value: "n5", label: "JLPT N5" },
              { value: "n4", label: "JLPT N4" },
              { value: "n3", label: "JLPT N3", disabled: true },
            ]}
          />
        </Demo>

        <Demo name="Tooltip">
          <Tooltip content="Shown on hover and on keyboard focus">
            <Button variant="outline">Focus or hover me</Button>
          </Tooltip>
        </Demo>

        <Demo name="Popover">
          <Popover trigger={<Button variant="outline">Open popover</Button>}>
            <p className="text-body">Interactive floating content.</p>
          </Popover>
        </Demo>

        <Demo name="Toast">
          <div className="flex flex-wrap gap-xs">
            <Button
              variant="outline"
              onClick={() => toast({ title: "Saved", variant: "success" })}
            >
              Success toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Something failed",
                  description: "With a description line.",
                  variant: "danger",
                })
              }
            >
              Danger toast
            </Button>
          </div>
        </Demo>
      </div>
    </section>
  );
}
