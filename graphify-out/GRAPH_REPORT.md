# Graph Report - src  (2026-06-06)

## Corpus Check
- 137 files · ~62,273 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 838 nodes · 1788 edges · 46 communities (45 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 74 edges
2. `useT()` - 43 edges
3. `localeForLang()` - 22 edges
4. `useLang()` - 22 edges
5. `AppContent()` - 18 edges
6. `CalendarView()` - 15 edges
7. `ClockButton()` - 14 edges
8. `getCategoryLabel()` - 14 edges
9. `getCategoryMeta()` - 14 edges
10. `CalendarEvent` - 12 edges

## Surprising Connections (you probably didn't know these)
- `StudyFilePicker()` --calls--> `useT()`  [EXTRACTED]
  components/CalendarView.tsx → lib/LanguageContext.tsx
- `FilePicker()` --calls--> `useT()`  [EXTRACTED]
  components/EstudiosView.tsx → lib/LanguageContext.tsx
- `EstudiosView()` --calls--> `useT()`  [EXTRACTED]
  components/EstudiosView.tsx → lib/LanguageContext.tsx
- `LocationMap()` --calls--> `useT()`  [EXTRACTED]
  components/LocationMap.tsx → lib/LanguageContext.tsx
- `BreadcrumbSeparator()` --calls--> `cn()`  [EXTRACTED]
  components/ui/breadcrumb.tsx → lib/utils.ts

## Communities (46 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (73): AppTab, BottomNav(), BottomNavProps, LEFT_TABS, RIGHT_TABS, CategoryIcon(), CategoryIconProps, { result } (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (47): CalendarEvent, eventsShareSchedule(), getEventEndDate(), isEventCategory(), isRecord(), isRecurrenceType(), isSameCalendarDay(), parseStoredEvent() (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (45): SettingsView(), useDarkMode(), FavoritePlace, isRecord(), parseStoredPlace(), { result }, storageMocks, useFavoritePlaces() (+37 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (40): DaySummary(), DaySummaryProps, generateRecurringEvents(), useDebouncedJsonWriter(), ContactFormData, ContactSchedule, dateKey(), fillPendingSessions() (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (36): useIsMobile(), Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (29): StatsView(), StatsViewProps, EventCategory, useCategoryFilter(), useMonthlyReportCarryover(), CampaignGoal, monthKey(), useSpecialCampaign() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (22): ErrorBoundary, isChunkLoadError(), cancelEventNotification(), canRequestNotificationPermission(), canUseExactAlarms(), ensureChannel(), ensureExactAlarms(), hasNotificationPermission() (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (19): CityResult, CitySearchProps, LocationMap(), LocationMapProps, LocationPicker, PrecursorHoursConfig(), PrecursorHoursConfigProps, PRESETS (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (24): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (20): de, en, fr, it, pt, _cache, es, LANGUAGES (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (18): ActivityHoursConfig(), ActivityHoursConfigProps, buildTimeOptions(), TimeSelect(), TimeSelectProps, ActivityHours, clampActivityHour(), clampTimeValueToHourRange() (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (21): activityTimeInputProps(), addParamsEndDate(), CalendarMode, CalendarView(), CalendarViewProps, clampTimeToActivityRange(), dayTotalFromEvents(), eventEndDate() (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (14): NavLink, NavLinkCompatProps, Avatar, AvatarFallback, AvatarImage, Checkbox, HoverCardContent, PopoverContent (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (19): ContactCard(), EstudiosView(), EstudiosViewProps, FilePicker(), formatRelative(), isoToDateStr(), nowTime(), SessionEditSheet() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (16): ClockButton(), ClockButtonProps, detectCategoryFromEvents(), formatSessionDay(), getCurrentTimeStr(), PendingPrompt, SessionData, softCategoryBackground() (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (16): TrolleyIcon(), cn(), buttonVariants, Calendar(), CalendarProps, Pagination(), PaginationContent, PaginationEllipsis() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (16): getStoredLanguage(), Props, RECOVERABLE_TIMER_KEYS, State, SUPPORTED_LANGS, MinistryMark(), MinistryMarkProps, MinistryWordmark() (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (10): cityViewbox(), fetchNominatim(), LeafletDefaultIconPrototype, LocationPickerProps, NominatimResult, SearchCenter, buildGoogleMapsUrl(), GeoPoint (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (15): Command, CommandDialogProps, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (8): LanguageFlag(), LanguageFlagProps, SetupScreen(), SetupScreenProps, Lang, formatPlaceName(), PLACE_KEYS, TranslateFn

### Community 21 - "Community 21"
Cohesion: 0.36
Nodes (11): CitySearch(), ContactDetail(), ContactSheet(), HistorySessionCard(), LocationPicker(), listItemRenderHint, TimeEntryList(), TimeEntryListProps (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (9): formatMissedLabel(), MissedEntry, MissedStudyBanner(), MissedStudyBannerProps, todayDateStr(), EstudioSession, isStalePendingSession(), SessionFile (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.2
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 29 - "Community 29"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (6): subscribeLanguageLoad(), TranslationKey, CurrentLanguageContext, LanguageContext, LanguageProvider(), TFn

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 36 - "Community 36"
Cohesion: 0.4
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (3): TabsContent, TabsList, TabsTrigger

## Knowledge Gaps
- **324 isolated node(s):** `queryClient`, `rootElement`, `ActivityHoursConfigProps`, `BottomNavProps`, `LEFT_TABS` (+319 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 15` to `Community 0`, `Community 4`, `Community 7`, `Community 8`, `Community 10`, `Community 12`, `Community 18`, `Community 19`, `Community 20`, `Community 22`, `Community 23`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`?**
  _High betweenness centrality (0.257) - this node is a cross-community bridge._
- **Why does `useT()` connect `Community 21` to `Community 0`, `Community 34`, `Community 3`, `Community 2`, `Community 5`, `Community 7`, `Community 10`, `Community 11`, `Community 13`, `Community 14`, `Community 17`, `Community 20`, `Community 24`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `AlertDialogHeader()` connect `Community 0` to `Community 11`, `Community 15`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `queryClient`, `rootElement`, `ActivityHoursConfigProps` to the rest of the system?**
  _324 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._