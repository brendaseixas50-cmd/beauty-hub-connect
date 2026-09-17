import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function CompactAppointmentRow({
  time,
  clientName,
  summary,
  status,
  cancelled = false,
  children,
}: {
  time: string;
  clientName: string;
  summary: string;
  status: string;
  cancelled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="gap-0 overflow-hidden p-0">
        <div className="grid min-h-16 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(7rem,auto)_auto] sm:px-4">
          <span className="font-mono text-sm font-semibold tabular-nums">{time}</span>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-w-0 justify-start px-0 py-2 text-left hover:bg-transparent"
              aria-label={`${open ? "Ocultar" : "Ver"} detalhes de ${clientName}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{clientName}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground sm:hidden">
                  {summary}
                </span>
              </span>
            </Button>
          </CollapsibleTrigger>
          <span className="hidden truncate text-sm text-muted-foreground sm:block">{summary}</span>
          <div className="flex items-center gap-1.5">
            <Badge variant={cancelled ? "outline" : "secondary"} className="hidden sm:inline-flex">
              {status}
            </Badge>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Alternar detalhes">
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="grid gap-3 border-t bg-muted/35 px-4 py-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}