"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import type { ComponentProps } from "react";
import { cn } from "@/app/lib/utils";
import { Icon } from "@/app/components/icons";

/*
 * shadcn/ui Select (Radix), restyled with Almadel tokens: same 38px field as the inputs, jade focus ring,
 * a raised popover that drops in on the 200ms curve, a check on the chosen row. Keyboard, typeahead and
 * screen-reader behaviour come from Radix.
 *
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger id="x" aria-label="…"><SelectValue placeholder="Choose…" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="cash">Cash</SelectItem>
 *     </SelectContent>
 *   </Select>
 *
 * Radix reserves "" for "no value": items need non-empty values; use the placeholder for "none chosen".
 */

function Select(props: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup(props: ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({ className, size = "default", children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-left text-[13.5px] text-[var(--text)] outline-none",
        "transition-[border-color,box-shadow] duration-[120ms] ease-[cubic-bezier(.22,1,.36,1)]",
        "h-[38px] data-[size=sm]:h-[30px] data-[size=sm]:rounded-[7px] data-[size=sm]:px-2.5 data-[size=sm]:text-[12.5px]",
        "hover:border-[var(--faint)] focus-visible:border-[var(--brand)] focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] data-[state=open]:border-[var(--brand)] data-[state=open]:shadow-[0_0_0_3px_var(--brand-soft)]",
        "data-[placeholder]:text-[var(--faint)] disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:border-[var(--neg)] aria-invalid:shadow-[0_0_0_3px_var(--neg-soft)]",
        "*:data-[slot=select-value]:truncate max-sm:min-h-[44px]",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Icon name="down" size={14} className="shrink-0 text-[var(--muted)] transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", align = "start", ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        align={align}
        sideOffset={6}
        className={cn(
          "al-select-content relative z-[200] max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-hidden rounded-[10px] border border-[var(--border-strong)] bg-[var(--raised)] text-[var(--text)] shadow-[var(--shadow-pop)]",
          position === "popper" && "w-full min-w-(--radix-select-trigger-width)",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-[var(--muted)]">
          <Icon name="down" size={13} className="rotate-180" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="max-h-[min(320px,var(--radix-select-content-available-height))] p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-[var(--muted)]">
          <Icon name="down" size={13} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 pb-1 pt-2 text-[10.5px] font-[550] uppercase tracking-[0.09em] text-[var(--faint)]", className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-[7px] py-2 pl-2.5 pr-8 text-[13.5px] text-[var(--text-2)] outline-none",
        "data-[highlighted]:bg-[var(--sunken)] data-[highlighted]:text-[var(--text)] data-[state=checked]:font-[550] data-[state=checked]:text-[var(--text)]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center text-[var(--brand)]">
        <SelectPrimitive.ItemIndicator>
          <Icon name="check" size={14} strokeWidth={2.2} />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("-mx-1 my-1 h-px bg-[var(--border)]", className)} {...props} />;
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue };
