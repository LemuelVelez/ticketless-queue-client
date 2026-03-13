import { AlertTriangle, RefreshCw } from "lucide-react"

import type {
    DepartmentAssignment,
    StaffDisplayBoardWindow,
    StaffDisplaySnapshotResponse,
    Ticket as TicketType,
} from "./types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import {
    departmentLabel,
    fmtTime,
    getParticipantDetails,
    getTwoNumberSlice,
    participantBoardLabel,
    queueNumberLabel,
    SMS_SENDING_AVAILABLE,
    SMS_UNAVAILABLE_NOTICE,
    transactionPurposeLabel,
} from "./utils"

type Props = {
    snapshot: StaffDisplaySnapshotResponse | null
    panelCount: number
    setPanelCount: (value: number) => void
    autoRefresh: boolean
    setAutoRefresh: (value: boolean) => void
    busy: boolean
    loading: boolean
    refresh: () => Promise<void> | void
    assignedDepartmentItems: DepartmentAssignment[]
    current: TicketType | null
    upNext: TicketType[]
    holdTickets: TicketType[]
}

export function StaffServingBoardMode({
    snapshot,
    panelCount,
    setPanelCount,
    autoRefresh,
    setAutoRefresh,
    busy,
    loading,
    refresh,
    assignedDepartmentItems,
    current,
    upNext,
    holdTickets,
}: Props) {
    const boardWindows: StaffDisplayBoardWindow[] = snapshot?.board?.windows ?? []
    const resolvedPanels = Math.max(3, panelCount, boardWindows.length)
    const panelRows: Array<StaffDisplayBoardWindow | null> = [...boardWindows]

    while (panelRows.length < resolvedPanels) panelRows.push(null)

    const columns = Math.min(4, Math.max(3, resolvedPanels >= 4 ? 4 : 3))

    const globalUpNextNumbers = (snapshot?.upNext?.length
        ? snapshot.upNext
              .map((t) => Number(t.queueNumber))
              .filter((n) => Number.isFinite(n))
        : upNext
              .map((t) => Number(t.queueNumber))
              .filter((n) => Number.isFinite(n))) as number[]

    const globalHoldNumbers = holdTickets
        .map((t) => Number(t.queueNumber))
        .filter((n) => Number.isFinite(n))

    return (
        <div className="fixed inset-0 z-50 bg-background">
            <div className="flex h-full w-full flex-col">
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                Manager: {snapshot?.board?.transactionManager || "—"}
                            </Badge>
                            <Badge variant="secondary">Panels: {resolvedPanels}</Badge>
                            <Badge variant="secondary">
                                Windows: {boardWindows.length}
                            </Badge>
                            <Badge variant="secondary">
                                Generated: {fmtTime(snapshot?.meta?.generatedAt || null)}
                            </Badge>
                        </div>

                        <div className="mt-2">
                            <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                Assigned departments
                            </div>
                            {assignedDepartmentItems.length ? (
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {assignedDepartmentItems.map((dep) => (
                                        <Badge
                                            key={`board-assigned-${dep.id}`}
                                            variant="outline"
                                        >
                                            {departmentLabel(dep)}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-1 text-xs text-muted-foreground">
                                    No assigned departments found for this staff
                                    account.
                                </div>
                            )}
                        </div>

                        <div className="mt-2 text-sm text-muted-foreground">
                            Multi-window queue display (3+ split panes) • auto
                            refresh every 5s
                        </div>

                        {!SMS_SENDING_AVAILABLE ? (
                            <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                                <AlertTriangle className="mt-0.5 h-4 w-4 text-foreground" />
                                <div className="min-w-0">
                                    <div className="font-medium text-foreground">
                                        SMS temporarily unavailable
                                    </div>
                                    <div className="mt-1">
                                        {SMS_UNAVAILABLE_NOTICE}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                            <Label htmlFor="panelsBoard" className="text-sm">
                                Panels
                            </Label>
                            <Select
                                value={String(Math.max(3, panelCount))}
                                onValueChange={(v) =>
                                    setPanelCount(Math.max(3, Number(v || 3)))
                                }
                            >
                                <SelectTrigger
                                    id="panelsBoard"
                                    className="h-8 w-22.5"
                                >
                                    <SelectValue placeholder="Panels" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6, 7, 8].map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                            <Switch
                                id="autoRefreshBoard"
                                checked={autoRefresh}
                                onCheckedChange={(v) =>
                                    setAutoRefresh(Boolean(v))
                                }
                                disabled={busy}
                            />
                            <Label htmlFor="autoRefreshBoard" className="text-sm">
                                Auto refresh
                            </Label>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => void refresh()}
                            disabled={loading || busy}
                            className="gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => {
                                try {
                                    window.close()
                                } catch {
                                    // ignore
                                }
                            }}
                        >
                            Close
                        </Button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
                    <div
                        className="grid gap-4"
                        style={{
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        }}
                    >
                        {panelRows.map((row, idx) => {
                            if (!row) {
                                return (
                                    <Card
                                        key={`empty-${idx}`}
                                        className="min-h-95 border-dashed"
                                    >
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">
                                                Unassigned panel
                                            </CardTitle>
                                            <CardDescription>
                                                Add more active windows under this
                                                manager to fill this slot.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex h-62.5 items-center justify-center text-sm text-muted-foreground">
                                            No active window bound.
                                        </CardContent>
                                    </Card>
                                )
                            }

                            const previewUpNext = getTwoNumberSlice(
                                globalUpNextNumbers,
                                idx
                            )
                            const previewHold = getTwoNumberSlice(
                                globalHoldNumbers,
                                idx
                            )

                            const currentForThisWindow =
                                current &&
                                (current as any).windowNumber === row.number
                                    ? current
                                    : null
                            const source =
                                (row.nowServing as any) ??
                                (currentForThisWindow as any)

                            const participant = getParticipantDetails(source)
                            const purposeText = transactionPurposeLabel(source)

                            return (
                                <Card
                                    key={row.id || `window-${idx}`}
                                    className="min-h-95"
                                >
                                    <CardContent className="p-5">
                                        <div className="flex h-full flex-col">
                                            <div className="text-center text-[clamp(1rem,2.2vw,1.5rem)] font-semibold">
                                                Window {row.number}
                                            </div>

                                            <div className="mt-4 text-center text-[clamp(1rem,2vw,1.4rem)] font-medium">
                                                Now Serving:
                                            </div>

                                            <div className="mt-3 text-center text-[clamp(5rem,12vw,10rem)] font-bold leading-none tracking-tight">
                                                {queueNumberLabel(
                                                    row.nowServing?.queueNumber
                                                )}
                                            </div>

                                            <div className="mt-3 text-center text-sm font-semibold uppercase tracking-wide">
                                                {participantBoardLabel(participant)}
                                            </div>

                                            <div className="mt-1 text-center text-xs text-muted-foreground">
                                                Purpose: {purposeText}
                                            </div>

                                            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                                <div className="text-center">
                                                    <div className="font-medium">
                                                        up next:
                                                    </div>
                                                    <div className="mt-1 leading-6">
                                                        {previewUpNext.length ? (
                                                            previewUpNext.map(
                                                                (n) => (
                                                                    <div
                                                                        key={`up-${row.id}-${n}`}
                                                                    >
                                                                        #{n}
                                                                    </div>
                                                                )
                                                            )
                                                        ) : (
                                                            <div>—</div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-center">
                                                    <div className="font-medium">
                                                        on hold:
                                                    </div>
                                                    <div className="mt-1 leading-6">
                                                        {previewHold.length ? (
                                                            previewHold.map(
                                                                (n) => (
                                                                    <div
                                                                        key={`hold-${row.id}-${n}`}
                                                                    >
                                                                        #{n}
                                                                    </div>
                                                                )
                                                            )
                                                        ) : (
                                                            <div>—</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-5 text-center text-xs text-muted-foreground">
                                                {row.nowServing
                                                    ? `Called at ${fmtTime(
                                                          (row.nowServing as any)
                                                              .calledAt
                                                      )}`
                                                    : "No active called ticket"}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}