export default function WorkspaceLoading() {
  return (
    <div className="flex-1 bg-slate-50 px-6 lg:px-8 py-6 w-full space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-slate-200/80" />
          <div className="h-4 w-80 rounded bg-slate-200/60" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200/80" />
      </div>
      <div className="h-80 w-full rounded-xl border border-slate-200 bg-white" />
    </div>
  )
}
