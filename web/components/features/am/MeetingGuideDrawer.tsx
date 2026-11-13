"use client"

import * as React from "react"
import {
  IconMessageQuestion,
  IconArrowRight,
  IconCheck,
  IconDeviceFloppy,
  IconSparkles,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import { MEETING_QUESTIONS_WITH_THAO } from "@/lib/mock/am-mock-data"
import { ProjectDetailTab, ScreenTab } from "@/lib/mock/am-types"

const TAB_LABELS: Record<ProjectDetailTab, string> = {
  "pre-project": "Tab 1: Thiết lập & Kick-off",
  "in-project": "Tab 2: Tiến độ & Credit",
  "post-project": "Tab 3: Nghiệm thu & VAT",
}

export function MeetingGuideDrawer() {
  const {
    meetingOpen,
    setMeetingOpen,
    meetingNotes,
    updateMeetingNote,
    setActiveScreen,
    setActiveDetailTab,
  } = useAmPrototype()

  const handleJumpToScreen = (screen: ScreenTab, tab?: ProjectDetailTab) => {
    setActiveScreen(screen)
    if (tab) {
      setActiveDetailTab(tab)
    }
    setMeetingOpen(false)
    toast.info(
      tab
        ? `Đã chuyển sang ${TAB_LABELS[tab]} để minh họa trực tiếp`
        : "Đã chuyển sang màn hình để minh họa trực tiếp"
    )
  }

  return (
    <Sheet open={meetingOpen} onOpenChange={setMeetingOpen}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-5 border-b bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-500 text-white border-0">
              Sáng mai 09:30 - 11:30
            </Badge>
            <Badge variant="outline" className="text-white border-white/30">
              Hoàng (Solution Lead) ↔ Thảo (AM)
            </Badge>
          </div>
          <SheetTitle className="text-white text-lg flex items-center gap-2 mt-1">
            <IconMessageQuestion className="size-5 text-orange-400" />
            Kịch Bản 5 Câu Hỏi Dẫn Dắt Buổi Họp Với AM Thảo
          </SheetTitle>
          <SheetDescription className="text-white/80 text-xs">
            Dùng để chốt nhanh SOP 3 giai đoạn, cơ chế Credit/Mandays và đối chiếu ngay với giải pháp trên hệ thống.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/20">
          {MEETING_QUESTIONS_WITH_THAO.map((q) => (
            <div
              key={q.id}
              className="rounded-lg border bg-card p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {q.number}
                  </span>
                  <h4 className="font-semibold text-sm text-foreground">
                    {q.topic}
                  </h4>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 shrink-0 border-primary/20 text-primary hover:bg-primary/5"
                  onClick={() => handleJumpToScreen(q.relatedScreen, q.relatedTab)}
                >
                  <span>
                    {q.relatedTab ? TAB_LABELS[q.relatedTab] : "Mở màn hình"}
                  </span>
                  <IconArrowRight className="size-3.5" />
                </Button>
              </div>

              <div className="rounded-md bg-amber-50/80 border border-amber-200/80 p-3 text-xs text-amber-950 leading-relaxed">
                <span className="font-semibold">Câu hỏi đặt cho Thảo: </span>
                “{q.questionText}”
              </div>

              <div className="rounded-md bg-emerald-50/70 border border-emerald-200/70 p-2.5 text-xs text-emerald-950 flex items-start gap-2">
                <IconSparkles className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Giải pháp đã dựng sẵn: </span>
                  {q.solutionBuiltInPrototype}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Biên bản chốt nhanh ý kiến của Thảo tại cuộc họp:</span>
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                    <IconCheck className="size-3" /> Tự động lưu
                  </span>
                </label>
                <Textarea
                  value={meetingNotes[q.id] || ""}
                  onChange={(e) => updateMeetingNote(q.id, e.target.value)}
                  rows={2}
                  className="text-xs bg-background"
                  placeholder="Ghi chú câu trả lời thực tế của Thảo trong buổi họp..."
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-background flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Mọi ghi chú được lưu tự động trên trình duyệt máy của bạn.
          </div>
          <Button
            size="sm"
            onClick={() => {
              toast.success("Đã lưu biên bản 5 câu hỏi họp với AM Thảo!")
              setMeetingOpen(false)
            }}
            className="gap-1.5"
          >
            <IconDeviceFloppy className="size-4" />
            Hoàn tất & Đóng
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
