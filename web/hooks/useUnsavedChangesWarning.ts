import { useEffect, useCallback } from "react"

/**
 * Hook bắt sự kiện chuyển trang nội bộ khi đang nhập liệu dở dang.
 */
export function useUnsavedChangesWarning(
  shouldWarn: boolean,
  onRequestLeave: (targetUrl?: string) => void
) {
  const handleRequestLeave = useCallback(
    (targetUrl?: string) => onRequestLeave(targetUrl),
    [onRequestLeave]
  )

  useEffect(() => {
    if (!shouldWarn) return

    // 1. Chặn các link chuyển trang nội bộ (Sidebar, Header, Breadcrumb...)
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a")
      if (target && target.href && !target.href.startsWith("javascript:") && !target.href.startsWith("#")) {
        const isExternal = target.target === "_blank"
        const isSamePath = target.pathname === window.location.pathname && target.search === window.location.search

        if (!isExternal && !isSamePath) {
          e.preventDefault()
          e.stopPropagation()
          handleRequestLeave(target.href)
        }
      }
    }

    // 2. Chặn nút Back / Forward của trình duyệt
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault()
      window.history.pushState(null, "", window.location.href)
      handleRequestLeave(document.referrer || "/services")
    }

    window.addEventListener("click", handleAnchorClick, true)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("click", handleAnchorClick, true)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [shouldWarn, handleRequestLeave])
}
