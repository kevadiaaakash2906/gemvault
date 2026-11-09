"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Opens the browser's print box. Choose "Save as PDF" there to get a file. */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="ghost" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden />{label}
    </Button>
  );
}
