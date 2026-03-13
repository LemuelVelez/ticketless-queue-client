import { AlertTriangle, Send } from "lucide-react"

import type { Ticket as TicketType } from "./types"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

import {
    defaultSmsCalledMessage,
    normalizeSmsSenderOption,
    SMS_SENDER_OPTIONS,
    SMS_SENDING_AVAILABLE,
    SMS_UNAVAILABLE_NOTICE,
    type ParticipantDetails,
    type SmsSenderOption,
} from "./utils"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    current: TicketType | null
    currentParticipant: ParticipantDetails
    currentPurpose: string
    smsBusy: boolean
    smsUseDefaultMessage: boolean
    setSmsUseDefaultMessage: (value: boolean) => void
    smsCustomMessage: string
    setSmsCustomMessage: (value: string) => void
    smsSenderOption: SmsSenderOption
    setSmsSenderOption: (value: SmsSenderOption) => void
    smsSenderCustom: string
    setSmsSenderCustom: (value: string) => void
    windowNumber?: number
    onSend: () => Promise<void> | void
}

export function StaffServingSmsDialog({
    open,
    onOpenChange,
    current,
    currentParticipant,
    currentPurpose,
    smsBusy,
    smsUseDefaultMessage,
    setSmsUseDefaultMessage,
    smsCustomMessage,
    setSmsCustomMessage,
    smsSenderOption,
    setSmsSenderOption,
    smsSenderCustom,
    setSmsSenderCustom,
    windowNumber,
    onSend,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-155">
                <DialogHeader>
                    <DialogTitle>Send SMS notification</DialogTitle>
                    <DialogDescription>
                        SMS notifications are currently unavailable.
                        {current ? (
                            <>
                                {" "}
                                Ticket #{current.queueNumber} •{" "}
                                {currentParticipant.name}
                                {currentPurpose !== "—"
                                    ? ` • ${currentPurpose}`
                                    : ""}
                                {currentParticipant.isStudent
                                    ? ` • ${
                                          currentParticipant.studentId || "—"
                                      }`
                                    : ""}
                                {currentParticipant.mobile
                                    ? ` • ${currentParticipant.mobile}`
                                    : ""}
                            </>
                        ) : (
                            " No active ticket selected."
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-1">
                    <div className="flex items-start gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-foreground" />
                        <div className="min-w-0">
                            <div className="font-medium text-foreground">
                                SMS temporarily unavailable
                            </div>
                            <div className="mt-1">{SMS_UNAVAILABLE_NOTICE}</div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="smsSenderSelect">Sender name</Label>
                        <Select
                            value={smsSenderOption}
                            onValueChange={(v) =>
                                setSmsSenderOption(normalizeSmsSenderOption(v))
                            }
                        >
                            <SelectTrigger id="smsSenderSelect" className="w-full">
                                <SelectValue placeholder="Select sender" />
                            </SelectTrigger>
                            <SelectContent>
                                {SMS_SENDER_OPTIONS.map((opt) => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {smsSenderOption === "custom" ? (
                            <Input
                                value={smsSenderCustom}
                                onChange={(e) =>
                                    setSmsSenderCustom(e.target.value)
                                }
                                placeholder="Type custom sender name..."
                            />
                        ) : null}

                        <div className="text-xs text-muted-foreground">
                            {smsSenderOption === "default"
                                ? "Uses backend default sender name."
                                : smsSenderOption === "custom"
                                  ? "Custom sender names may be restricted by your SMS provider."
                                  : "Preset sender selected."}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <Label htmlFor="smsUseDefaultMessage" className="text-sm">
                            Use default called message
                        </Label>
                        <Switch
                            id="smsUseDefaultMessage"
                            checked={smsUseDefaultMessage}
                            onCheckedChange={(v) =>
                                setSmsUseDefaultMessage(Boolean(v))
                            }
                            disabled={!SMS_SENDING_AVAILABLE}
                        />
                    </div>

                    {smsUseDefaultMessage ? (
                        <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                            {current
                                ? defaultSmsCalledMessage(
                                      current.queueNumber ?? 0,
                                      windowNumber
                                  )
                                : "Queue update message preview will appear when an active ticket is selected."}
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <Label htmlFor="smsCustomMessage">
                                Custom message
                            </Label>
                            <Textarea
                                id="smsCustomMessage"
                                value={smsCustomMessage}
                                onChange={(e) =>
                                    setSmsCustomMessage(e.target.value)
                                }
                                placeholder="Type your custom SMS message..."
                                rows={4}
                                disabled={!SMS_SENDING_AVAILABLE}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={smsBusy}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void onSend()}
                        disabled={
                            !SMS_SENDING_AVAILABLE || smsBusy || !current?._id
                        }
                        className="gap-2"
                    >
                        <Send className="h-4 w-4" />
                        {smsBusy ? "Sending..." : "Send SMS"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}