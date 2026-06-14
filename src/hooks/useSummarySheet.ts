import { useState, useRef, useEffect, RefObject } from "react";

interface UseSummarySheetOptions {
  activeTab: string;
  todayEventCount: number;
  timerContentRef: RefObject<HTMLDivElement>;
}

export function useSummarySheet({ activeTab, todayEventCount, timerContentRef }: UseSummarySheetOptions) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDragOffset, setSummaryDragOffset] = useState<number | null>(null);
  const [summarySheetHeight, setSummarySheetHeight] = useState(0);
  const [summaryViewportHeight, setSummaryViewportHeight] = useState(
    typeof window === "undefined" ? 720 : window.innerHeight,
  );
  const [timerContentBottomY, setTimerContentBottomY] = useState(0);
  const summarySheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartOffset = useRef(0);
  const summaryDidDrag = useRef(false);

  useEffect(() => {
    if (activeTab !== "timer") return;
    const measure = () => {
      setSummaryViewportHeight(window.innerHeight);
      setSummarySheetHeight(summarySheetRef.current?.offsetHeight ?? 0);
      const rect = timerContentRef.current?.getBoundingClientRect();
      setTimerContentBottomY(rect?.bottom ?? 0);
    };
    measure();
    window.addEventListener("resize", measure);
    const contentEl = timerContentRef.current;
    const observer =
      contentEl && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    if (contentEl && observer) observer.observe(contentEl);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [activeTab, todayEventCount, summaryOpen, timerContentRef]);

  const peekH = Math.round(summaryViewportHeight * 0.34);
  const contentSafeOffset =
    timerContentBottomY > 0
      ? Math.max(0, timerContentBottomY + 24 - summaryViewportHeight + 64 + summarySheetHeight)
      : 0;
  const collapsedSummaryOffset = Math.max(Math.max(0, summarySheetHeight - peekH), contentSafeOffset);
  const restingSummaryOffset = summaryOpen ? 0 : collapsedSummaryOffset;
  const activeSummaryOffset = summaryDragOffset ?? restingSummaryOffset;

  const startDrag = (clientY: number) => {
    dragStartY.current = clientY;
    dragStartOffset.current = activeSummaryOffset;
    summaryDidDrag.current = false;
    setSummaryDragOffset(activeSummaryOffset);
  };

  const moveDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    if (Math.abs(delta) > 6) summaryDidDrag.current = true;
    setSummaryDragOffset(Math.min(collapsedSummaryOffset, Math.max(0, dragStartOffset.current + delta)));
  };

  const endDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    const finalOffset = Math.min(collapsedSummaryOffset, Math.max(0, dragStartOffset.current + delta));
    dragStartY.current = null;
    setSummaryOpen(finalOffset < collapsedSummaryOffset * 0.55);
    setSummaryDragOffset(null);
  };

  const toggleSummary = () => {
    if (summaryDidDrag.current) { summaryDidDrag.current = false; return; }
    setSummaryOpen((v) => !v);
  };

  return {
    summaryOpen,
    setSummaryOpen,
    summaryDragOffset,
    summarySheetHeight,
    activeSummaryOffset,
    summarySheetRef,
    startDrag,
    moveDrag,
    endDrag,
    toggleSummary,
  };
}
