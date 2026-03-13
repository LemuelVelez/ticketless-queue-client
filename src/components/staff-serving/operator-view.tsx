import {
    CheckCircle2,
    LayoutGrid,
    MessageSquare,
    PauseCircle,
} from "lucide-react"

import type {
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
import { Skeleton } from "@/components/ui/skeleton"

import {
    fmtTime,
    getTransactionPurposeText,
    getTwoNumberSlice,
    participantBoardLabel,
    queueNumberLabel,
    SMS_SENDING_AVAILABLE,
    type ParticipantDetails,
} from "./utils"

type Props = {
    loading: boolean
    current: TicketType | null
    currentParticipant: ParticipantDetails
    currentPurpose: string
    busy: boolean
    smsBusy: boolean
    upNext: TicketType[]
    holdTickets: TicketType[]
    snapshot: StaffDisplaySnapshotResponse | null
    onOpenSmsDialog: () => void
    onHoldNoShow: () => Promise<void> | void
    onServed: () => Promise<void> | void
}

export function StaffServingOperatorView({
    loading,
    current,
    currentParticipant,
    currentPurpose,
    busy,
    smsBusy,
    upNext,
    holdTickets,
    snapshot,
    onOpenSmsDialog,
    onHoldNoShow,
    onServed,
}: Props) {
    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-36 w-full" />
            </div>
        )
    }

    return (
        <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
                <CardHeader>
                    <CardTitle>Active ticket billboard</CardTitle>
                    <CardDescription>
                        This panel is optimized for quick staff operation.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {current ? (
                        <>
                            <div className="rounded-2xl border bg-muted p-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0">
                                        <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                            Now serving
                                        </div>
                                        <div className="mt-2 text-7xl font-semibold tracking-tight">
                                            #{current.queueNumber}
                                        </div>

                                        <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
                                            <div className="min-w-0">
                                                Participant:{" "}
                                                <span className="font-medium text-foreground">
                                                    {currentParticipant.name}
                                                </span>
                                            </div>

                                            <div>
                                                Purpose:{" "}
                                                <span className="font-medium text-foreground">
                                                    {currentPurpose}
                                                </span>
                                            </div>

                                            {currentParticipant.isStudent ? (
                                                <div>
                                                    Student ID:{" "}
                                                    {currentParticipant.studentId ||
                                                        "—"}
                                                </div>
                                            ) : null}

                                            <div>
                                                Mobile:{" "}
                                                {currentParticipant.mobile || "—"}
                                            </div>

                                            <div className="text-sm text-muted-foreground">
                                                Called at:{" "}
                                                {fmtTime((current as any).calledAt)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-start gap-2 md:items-end">
                                        <Badge>CALLED</Badge>
                                        <div className="text-xs text-muted-foreground">
                                            Hold attempts:{" "}
                                            {current.holdAttempts ?? 0}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onOpenSmsDialog}
                                    disabled={
                                        busy ||
                                        smsBusy ||
                                        !current?._id ||
                                        !SMS_SENDING_AVAILABLE
                                    }
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    Send SMS
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void onHoldNoShow()}
                                    disabled={busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <PauseCircle className="h-4 w-4" />
                                    Hold / No-show
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => void onServed()}
                                    disabled={busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark served
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                            No ticket is currently called for your window.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Operator rail</CardTitle>
                    <CardDescription>
                        Quick view of next and hold queues.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div>
                        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                            Up next
                        </div>
                        {upNext.length === 0 ? (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                No WAITING tickets.
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {upNext.slice(0, 6).map((t, idx) => {
                                    const purpose = getTransactionPurposeText(t)
                                    return (
                                        <div
                                            key={t._id}
                                            className="flex items-center justify-between rounded-xl border p-3"
                                        >
                                            <div className="text-xl font-semibold">
                                                #{t.queueNumber}
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>
                                                    {idx === 0
                                                        ? "Next"
                                                        : "Waiting"}
                                                </div>
                                                <div className="max-w-64 truncate">
                                                    {purpose || "—"}
                                                </div>
                                                <div>
                                                    {fmtTime(
                                                        (t as any).waitingSince
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                            On hold
                        </div>
                        {holdTickets.length === 0 ? (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                No HOLD tickets.
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {holdTickets.slice(0, 8).map((t) => {
                                    const purpose = getTransactionPurposeText(t)
                                    return (
                                        <div
                                            key={`hold-${t._id}`}
                                            className="flex items-center justify-between rounded-xl border p-3"
                                        >
                                            <div className="text-xl font-semibold">
                                                #{t.queueNumber}
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>Hold</div>
                                                <div className="max-w-64 truncate">
                                                    {purpose || "—"}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-12">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Manager multi-window preview
                    </CardTitle>
                    <CardDescription>
                        Queue display layout mirrors window cards: big number +
                        participant details + up next + on hold.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {snapshot?.board?.windows?.length ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {snapshot.board.windows.map(
                                (windowItem: StaffDisplayBoardWindow, idx: number) => {
                                    const previewUpNext = getTwoNumberSlice(
                                        (snapshot?.upNext
                                            ?.map((t) => Number(t.queueNumber))
                                            .filter((n) =>
                                                Number.isFinite(n)
                                            ) as number[]) || [],
                                        idx
                                    )

                                    const previewHold = getTwoNumberSlice(
                                        holdTickets
                                            .map((t) => Number(t.queueNumber))
                                            .filter((n) => Number.isFinite(n)),
                                        idx
                                    )

                                    const currentForThisWindow =
                                        current &&
                                        (current as any).windowNumber ===
                                            windowItem.number
                                            ? current
                                            : null

                                    const source =
                                        (windowItem.nowServing as any) ??
                                        (currentForThisWindow as any)

                                    const participant =
                                        currentForThisWindow === current
                                            ? currentParticipant
                                            : {
                                                  name: "Participant",
                                                  isStudent: false,
                                                  studentId: null,
                                                  mobile: null,
                                                  display: null,
                                              }

                                    const purposeText =
                                        getTransactionPurposeText(source) || "—"

                                    return (
                                        <div
                                            key={windowItem.id}
                                            className="rounded-xl border p-4"
                                        >
                                            <div className="text-center text-lg font-semibold">
                                                Window {windowItem.number}
                                            </div>
                                            <div className="mt-3 text-center text-base font-medium">
                                                Now Serving:
                                            </div>
                                            <div className="mt-2 text-center text-[clamp(3.4rem,8vw,6rem)] font-bold leading-none">
                                                {queueNumberLabel(
                                                    windowItem.nowServing
                                                        ?.queueNumber
                                                )}
                                            </div>

                                            <div className="mt-2 text-center text-xs font-semibold uppercase tracking-wide">
                                                {participantBoardLabel(
                                                    participant
                                                )}
                                            </div>

                                            <div className="mt-1 text-center text-xs text-muted-foreground">
                                                Purpose: {purposeText}
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                <div className="text-center">
                                                    <div className="font-medium">
                                                        up next:
                                                    </div>
                                                    <div className="mt-1 leading-5">
                                                        {previewUpNext.length ? (
                                                            previewUpNext.map(
                                                                (n) => (
                                                                    <div
                                                                        key={`preview-up-${windowItem.id}-${n}`}
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
                                                    <div className="mt-1 leading-5">
                                                        {previewHold.length ? (
                                                            previewHold.map(
                                                                (n) => (
                                                                    <div
                                                                        key={`preview-hold-${windowItem.id}-${n}`}
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
                                        </div>
                                    )
                                }
                            )}
                        </div>
                    ) : (
                        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                            No active windows found for your current manager
                            scope.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}