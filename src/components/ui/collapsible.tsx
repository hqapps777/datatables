"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Collapsible = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ className, open = false, onOpenChange, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(className)}
      data-state={open ? "open" : "closed"}
      {...props}
    >
      {children}
    </div>
  )
})
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(className)}
    {...props}
  >
    {children}
  </button>
))
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    forceMount?: boolean
  }
>(({ className, children, forceMount, ...props }, ref) => {
  const parent = React.useContext(CollapsibleContext)
  
  if (!parent?.open && !forceMount) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      data-state={parent?.open ? "open" : "closed"}
      {...props}
    >
      {children}
    </div>
  )
})
CollapsibleContent.displayName = "CollapsibleContent"

const CollapsibleContext = React.createContext<{
  open: boolean
  onOpenChange?: (open: boolean) => void
} | null>(null)

export { Collapsible, CollapsibleTrigger, CollapsibleContent }