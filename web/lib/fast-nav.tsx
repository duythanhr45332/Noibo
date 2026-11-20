"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

const ERP_NAV_EVENT = "erp-fast-nav"

function subscribeLocation(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("popstate", callback)
  window.addEventListener(ERP_NAV_EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(ERP_NAV_EVENT, callback)
  }
}

export function navigateWorkspace(href: string, options?: { replace?: boolean }) {
  if (typeof window === "undefined") return
  const current = window.location.pathname + window.location.search
  if (current === href) return
  if (options?.replace) {
    window.history.replaceState(null, "", href)
  } else {
    window.history.pushState(null, "", href)
  }
  window.dispatchEvent(new Event(ERP_NAV_EVENT))
}

export function useFastPathname(): string {
  const nextPathname = usePathname() || "/"

  const clientPathname = React.useSyncExternalStore(
    subscribeLocation,
    () => (typeof window !== "undefined" ? window.location.pathname : nextPathname),
    () => nextPathname
  )

  return clientPathname || nextPathname
}

export interface FastLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string
  replace?: boolean
}

export const FastLink = React.forwardRef<HTMLAnchorElement, FastLinkProps>(
  function FastLink({ href, replace, onClick, children, ...rest }, ref) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        rest.target === "_blank"
      ) {
        return
      }
      e.preventDefault()
      navigateWorkspace(href, { replace })
    }

    return (
      <a ref={ref} href={href} onClick={handleClick} {...rest}>
        {children}
      </a>
    )
  }
)
