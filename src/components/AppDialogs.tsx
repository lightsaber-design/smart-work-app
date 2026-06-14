import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface AppDialogsProps {
  shortStopPrompt: { customTime?: Date } | null;
  onShortStopClose: () => void;
  onKeepShortActivity: () => void;
  onDiscardShortActivity: () => void;
  deleteEventPromptId: string | null;
  deleteEventIsRecurring: boolean;
  onDeleteEventClose: () => void;
  onConfirmDeleteEvent: (scope: "single" | "all") => void;
  t: TranslateFn;
}

export function AppDialogs({
  shortStopPrompt,
  onShortStopClose,
  onKeepShortActivity,
  onDiscardShortActivity,
  deleteEventPromptId,
  deleteEventIsRecurring,
  onDeleteEventClose,
  onConfirmDeleteEvent,
  t,
}: AppDialogsProps) {
  return (
    <>
      <AlertDialog open={!!shortStopPrompt} onOpenChange={(open) => { if (!open) onShortStopClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("timer_short_activity_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("timer_short_activity_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel onClick={onKeepShortActivity}>{t("timer_short_activity_keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDiscardShortActivity}
            >
              {t("timer_short_activity_discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEventPromptId} onOpenChange={(open) => { if (!open) onDeleteEventClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cal_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEventIsRecurring ? t("cal_delete_recurring_body") : t("cal_delete_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {deleteEventIsRecurring ? (
              <>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onConfirmDeleteEvent("all")}
                >
                  {t("cal_delete_all_series")}
                </AlertDialogAction>
                <AlertDialogAction
                  className="border border-border bg-background text-foreground hover:bg-muted shadow-none"
                  onClick={() => onConfirmDeleteEvent("single")}
                >
                  {t("cal_delete_this_only")}
                </AlertDialogAction>
                <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
              </>
            ) : (
              <>
                <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onConfirmDeleteEvent("all")}
                >
                  {t("home_delete_activity")}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
