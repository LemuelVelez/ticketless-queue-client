import {
    AlertTriangle,
    ExternalLink,
    Megaphone,
    MessageSquare,
    Monitor,
    RefreshCw,
    Ticket as TicketIcon,
    Volume2,
} from "lucide-react"

import type {
    DepartmentAssignment,
    StaffDisplaySnapshotResponse,
    Ticket as TicketType,
} from "@/api/staff"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

import {
    departmentLabel,
    formatVoiceLabel,
    normalizeSmsSenderOption,
    SMS_SENDER_OPTIONS,
    SMS_SENDING_AVAILABLE,
    SMS_UNAVAILABLE_NOTICE,
    type AnnouncementVoiceOption,
    type MonitorOption,
    type ResolvedEnglishVoices,
    type SmsSenderOption,
} from "./utils"

type Props = {
    loading: boolean
    busy: boolean
    smsBusy: boolean
    assignedOk: boolean
    current: TicketType | null
    voiceEnabled: boolean
    setVoiceEnabled: (value: boolean) => void
    voiceSupported: boolean
    autoRefresh: boolean
    setAutoRefresh: (value: boolean) => void
    autoSmsOnCall: boolean
    setAutoSmsOnCall: (value: boolean) => void
    assignedDepartmentItems: DepartmentAssignment[]
    handledDepartmentItems: DepartmentAssignment[]
    windowInfo: { id: string; name: string; number: number } | null
    snapshot: StaffDisplaySnapshotResponse | null
    onRefresh: () => Promise<void> | void
    onCallNext: () => Promise<void> | void
    onRecallVoice: () => void
    onOpenSmsDialog: () => void
    lastAnnouncedQueueNumber: number | null
    monitorOptions: MonitorOption[]
    selectedMonitorId: string
    setSelectedMonitorId: (value: string) => void
    loadingMonitors: boolean
    panelCount: number
    setPanelCount: (value: number) => void
    selectedVoiceType: AnnouncementVoiceOption
    setSelectedVoiceType: (value: AnnouncementVoiceOption) => void
    resolvedEnglishVoices: ResolvedEnglishVoices
    openBoardOnSelectedMonitor: () => void
    loadMonitorOptions: (silent?: boolean) => Promise<void> | void
    smsSenderOption: SmsSenderOption
    setSmsSenderOption: (value: SmsSenderOption) => void
    smsSenderCustom: string
    setSmsSenderCustom: (value: string) => void
    monitorApiSupported: boolean
}

export function StaffServingControlPanel({
    loading,
    busy,
    smsBusy,
    assignedOk,
    current,
    voiceEnabled,
    setVoiceEnabled,
    voiceSupported,
    autoRefresh,
    setAutoRefresh,
    autoSmsOnCall,
    setAutoSmsOnCall,
    assignedDepartmentItems,
    handledDepartmentItems,
    windowInfo,
    snapshot,
    onRefresh,
    onCallNext,
    onRecallVoice,
    onOpenSmsDialog,
    lastAnnouncedQueueNumber,
    monitorOptions,
    selectedMonitorId,
    setSelectedMonitorId,
    loadingMonitors,
    panelCount,
    setPanelCount,
    selectedVoiceType,
    setSelectedVoiceType,
    resolvedEnglishVoices,
    openBoardOnSelectedMonitor,
    loadMonitorOptions,
    smsSenderOption,
    setSmsSenderOption,
    smsSenderCustom,
    setSmsSenderCustom,
    monitorApiSupported,
}: Props) {
    return (
        <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                        <TicketIcon className="h-5 w-5" />
                        Now Serving Board
                    </CardTitle>
                    <CardDescription>
                        Dedicated operator board for live calling. Open <strong>?board=1&amp;panels=3</strong> for monitor display mode.
                    </CardDescription>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button variant="outline" onClick={() => void onRefresh()} disabled={loading || busy} className="w-full gap-2 sm:w-auto">
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>

                    <Button onClick={() => void onCallNext()} disabled={loading || busy || !assignedOk} className="w-full gap-2 sm:w-auto">
                        <Megaphone className="h-4 w-4" />
                        Call next
                    </Button>

                    <Button
                        variant="outline"
                        onClick={onRecallVoice}
                        disabled={busy || !assignedOk || !voiceEnabled || !voiceSupported || (!current?.queueNumber && !lastAnnouncedQueueNumber)}
                        className="w-full gap-2 sm:w-auto"
                    >
                        <Volume2 className="h-4 w-4" />
                        Recall voice
                    </Button>

                    <Button
                        variant="outline"
                        onClick={onOpenSmsDialog}
                        disabled={busy || smsBusy || !assignedOk || !current?._id || !SMS_SENDING_AVAILABLE}
                        className="w-full gap-2 sm:w-auto"
                    >
                        <MessageSquare className="h-4 w-4" />
                        Send SMS
                    </Button>
                </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">Assigned depts: {assignedDepartmentItems.length}</Badge>
                    <Badge variant="secondary">Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}</Badge>
                    <Badge variant="secondary">Manager: {snapshot?.board?.transactionManager || "—"}</Badge>
                    <Badge variant="secondary">Managed windows: {snapshot?.board?.windows?.length ?? 0}</Badge>
                    <Badge variant="secondary">
                        SMS:{" "}
                        {!SMS_SENDING_AVAILABLE
                            ? "Unavailable"
                            : smsBusy
                              ? "Sending..."
                              : autoSmsOnCall
                                ? "Auto on call"
                                : "Manual"}
                    </Badge>
                    {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                    {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <Switch id="autoRefresh" checked={autoRefresh} onCheckedChange={(v) => setAutoRefresh(Boolean(v))} disabled={busy} />
                        <Label htmlFor="autoRefresh" className="text-sm">
                            Auto refresh
                        </Label>
                    </div>

                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <Switch
                            id="voiceEnabled"
                            checked={voiceEnabled}
                            onCheckedChange={(v) => setVoiceEnabled(Boolean(v))}
                            disabled={busy || !voiceSupported}
                        />
                        <Label htmlFor="voiceEnabled" className="text-sm">
                            Voice
                        </Label>
                    </div>

                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <Switch
                            id="autoSmsOnCall"
                            checked={SMS_SENDING_AVAILABLE ? autoSmsOnCall : false}
                            onCheckedChange={(v) => setAutoSmsOnCall(Boolean(v))}
                            disabled={busy || smsBusy || !assignedOk || !SMS_SENDING_AVAILABLE}
                        />
                        <Label htmlFor="autoSmsOnCall" className="text-sm">
                            Auto SMS on call
                        </Label>
                    </div>
                </div>
            </div>

            {!SMS_SENDING_AVAILABLE ? (
                <div className="flex items-start gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-foreground" />
                    <div className="min-w-0">
                        <div className="font-medium text-foreground">SMS temporarily unavailable</div>
                        <div className="mt-1">{SMS_UNAVAILABLE_NOTICE}</div>
                    </div>
                </div>
            ) : null}

            <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
                <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Assigned departments</div>
                    {assignedDepartmentItems.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {assignedDepartmentItems.map((dep) => (
                                <Badge key={`assigned-${dep.id}`} variant="outline">
                                    {departmentLabel(dep)}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-muted-foreground">No assigned departments found for this staff account.</div>
                    )}
                </div>

                <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Handled departments (effective scope)</div>
                    {handledDepartmentItems.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {handledDepartmentItems.map((dep) => (
                                <Badge key={`handled-${dep.id}`} variant="secondary">
                                    {departmentLabel(dep)}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-muted-foreground">No handled departments available.</div>
                    )}
                </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-12">
                <div className="lg:col-span-4">
                    <Label htmlFor="monitorSelect" className="mb-2 block text-sm">
                        Display monitor
                    </Label>
                    <Select value={selectedMonitorId || undefined} onValueChange={setSelectedMonitorId} disabled={loadingMonitors || !monitorOptions.length}>
                        <SelectTrigger id="monitorSelect" className="w-full">
                            <SelectValue placeholder="Select monitor" />
                        </SelectTrigger>
                        <SelectContent>
                            {monitorOptions.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="lg:col-span-2">
                    <Label htmlFor="panelCountSelect" className="mb-2 block text-sm">
                        Split panels
                    </Label>
                    <Select value={String(panelCount)} onValueChange={(v) => setPanelCount(Math.max(3, Number(v || 3)))}>
                        <SelectTrigger id="panelCountSelect" className="w-full">
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

                <div className="lg:col-span-4">
                    <Label htmlFor="voiceTypeSelect" className="mb-2 block text-sm">
                        Announcement voice (English • United States preferred)
                    </Label>
                    <Select
                        value={selectedVoiceType}
                        onValueChange={(v) => setSelectedVoiceType(v === "man" ? "man" : "woman")}
                        disabled={!voiceSupported}
                    >
                        <SelectTrigger id="voiceTypeSelect" className="w-full">
                            <SelectValue placeholder="Select voice type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="woman">Woman ({formatVoiceLabel(resolvedEnglishVoices.woman)})</SelectItem>
                            <SelectItem value="man">Man ({formatVoiceLabel(resolvedEnglishVoices.man)})</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col justify-end gap-2 lg:col-span-2">
                    <Button className="w-full gap-2" onClick={openBoardOnSelectedMonitor} disabled={!monitorOptions.length}>
                        <ExternalLink className="h-4 w-4" />
                        Open queue board
                    </Button>
                </div>

                <div className="flex flex-col justify-end gap-2 lg:col-span-2">
                    <Button variant="outline" className="w-full gap-2" onClick={() => void loadMonitorOptions(false)} disabled={loadingMonitors}>
                        <Monitor className="h-4 w-4" />
                        {loadingMonitors ? "Scanning..." : "Refresh monitors"}
                    </Button>
                </div>

                <div className="lg:col-span-10">
                    <Label htmlFor="smsSenderSelectInline" className="mb-2 block text-sm">
                        SMS sender name
                    </Label>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <Select value={smsSenderOption} onValueChange={(v) => setSmsSenderOption(normalizeSmsSenderOption(v))}>
                            <SelectTrigger id="smsSenderSelectInline" className="w-full md:w-80">
                                <SelectValue placeholder="Select sender" />
                            </SelectTrigger>
                            <SelectContent>
                                {SMS_SENDER_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {smsSenderOption === "custom" ? (
                            <Input
                                value={smsSenderCustom}
                                onChange={(e) => setSmsSenderCustom(e.target.value)}
                                placeholder="Custom sender..."
                                className="w-full md:w-80"
                            />
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                {smsSenderOption === "default" ? "Backend default sender will be used." : "Preset sender selected."}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-12 text-xs text-muted-foreground">
                    {monitorApiSupported
                        ? "Monitor hardware picker is active. Window placement uses browser window-management support."
                        : "Monitor hardware API not available in this browser context. Fallback opens on current monitor."}
                </div>

                <div className="lg:col-span-12 text-xs text-muted-foreground">
                    Voice engine: react-text-to-speech • Prefers en-US when available • Woman: {formatVoiceLabel(resolvedEnglishVoices.woman)} •{" "}
                    Man: {formatVoiceLabel(resolvedEnglishVoices.man)}
                </div>

                <div className="lg:col-span-12 text-xs text-muted-foreground">
                    SMS engine:{" "}
                    {!SMS_SENDING_AVAILABLE
                        ? "Temporarily unavailable — provider credential/request verification in progress (Semaphore + Twilio). First verified will be integrated promptly."
                        : autoSmsOnCall
                          ? "Auto send is enabled when calling next."
                          : "Manual send mode is enabled."}
                </div>
            </div>
        </CardHeader>
    )
}