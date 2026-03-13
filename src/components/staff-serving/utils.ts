/* eslint-disable @typescript-eslint/no-explicit-any */
import { pickTransactionPurpose } from "@/lib/http"
import type { DepartmentAssignment, Ticket as TicketType } from "./types"

export function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("en-US")
}

export function parseBool(v: unknown): boolean {
    if (typeof v === "boolean") return v
    if (typeof v !== "string") return false
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on"
}

export function parsePanelCount(search: string, fallback = 3) {
    const qs = new URLSearchParams(search || "")
    const raw = Number(qs.get("panels") || fallback)
    if (!Number.isFinite(raw)) return fallback
    return Math.max(3, Math.min(8, Math.floor(raw)))
}

export function isSpeechSupported() {
    return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    )
}

export function getTransactionPurposeText(anyObj?: any): string {
    const s = String(pickTransactionPurpose(anyObj) ?? "").trim()
    return s
}

export function transactionPurposeLabel(anyObj?: any): string {
    const s = getTransactionPurposeText(anyObj)
    return s || "—"
}

/**
 * More strict than "10 digits" to avoid mistaking Student IDs as phone numbers.
 * Prefers common PH mobile formats:
 * - 09XXXXXXXXX (11 digits, starts with 09)
 * - 639XXXXXXXXX (12 digits, starts with 639)
 * Also treats explicit "+" international formats as phone numbers.
 */
export function looksLikePhoneNumber(input?: string | null) {
    const raw = String(input || "").trim()
    if (!raw) return false
    if (raw.includes("@")) return false

    if (raw.includes("+")) {
        const digits = raw.replace(/[^\d]/g, "")
        return digits.length >= 10 && digits.length <= 15
    }

    if (!/^[\d\-\s()]+$/.test(raw)) return false

    const digits = raw.replace(/[^\d]/g, "")
    if (digits.length === 11 && digits.startsWith("09")) return true
    if (digits.length === 12 && digits.startsWith("639")) return true

    if (digits.length >= 10 && digits.length <= 15) {
        if (digits.startsWith("0")) return true
        if (digits.startsWith("63")) return true
    }

    return false
}

export type ParticipantLike = {
    participantFullName?: string | null
    participantDisplay?: string | null
    participantStudentId?: string | null
    participantMobileNumber?: string | null
    participantLabel?: string | null
    participantType?: unknown
    studentId?: string | null
    phone?: string | null
}

export type ParticipantDetails = {
    name: string
    isStudent: boolean
    studentId: string | null
    mobile: string | null
    display: string | null
}

function firstSegment(line?: string | null) {
    const s = String(line || "").trim()
    if (!s) return ""
    const seg = s.split("•")[0]
    return String(seg || "").trim()
}

function buildParticipantDisplay(params: {
    name: string
    isStudent: boolean
    studentId?: string | null
    mobile?: string | null
}) {
    const name = String(params.name || "").trim()
    const sid = String(params.studentId || "").trim()
    const mobile = String(params.mobile || "").trim()

    const parts: string[] = []
    if (name) parts.push(name)
    if (params.isStudent && sid) parts.push(sid)
    if (mobile) parts.push(mobile)

    return parts.join(" • ")
}

export function getParticipantDetails(
    source?: ParticipantLike | null
): ParticipantDetails {
    const type = String(source?.participantType ?? "")
        .trim()
        .toUpperCase()
    const isStudent = type === "STUDENT"

    const displayRaw =
        String(source?.participantDisplay ?? "").trim() ||
        String(source?.participantLabel ?? "").trim()

    let nameRaw =
        String(source?.participantFullName ?? "").trim() ||
        firstSegment(displayRaw)

    if (looksLikePhoneNumber(nameRaw)) nameRaw = ""

    const legacyIdentifier = String(source?.studentId ?? "").trim()

    const legacyStudentId =
        legacyIdentifier && !looksLikePhoneNumber(legacyIdentifier)
            ? legacyIdentifier
            : ""
    const legacyPhone =
        legacyIdentifier && looksLikePhoneNumber(legacyIdentifier)
            ? legacyIdentifier
            : ""

    const studentId = isStudent
        ? String(source?.participantStudentId ?? "").trim() ||
          (legacyStudentId ? legacyStudentId : "")
        : ""

    const mobile =
        String(source?.participantMobileNumber ?? "").trim() ||
        String(source?.phone ?? "").trim() ||
        (legacyPhone ? legacyPhone : "")

    const name =
        nameRaw ||
        (isStudent && studentId ? studentId : "") ||
        (legacyStudentId ? legacyStudentId : "") ||
        "Participant"

    const display =
        displayRaw ||
        buildParticipantDisplay({
            name,
            isStudent,
            studentId: studentId || null,
            mobile: mobile || null,
        })

    return {
        name,
        isStudent,
        studentId: studentId || null,
        mobile: mobile || null,
        display: display || null,
    }
}

/**
 * Queue board privacy rule:
 * Never show mobile number on the public display.
 * Only show: Full Name + Student ID (if student).
 */
export function participantBoardLabel(p: ParticipantDetails) {
    const parts: string[] = []
    const name = String(p?.name || "").trim()
    if (name) parts.push(name)
    if (p?.isStudent && p?.studentId) parts.push(String(p.studentId).trim())
    return parts.join(" • ") || "Participant"
}

export type MonitorOption = {
    id: string
    label: string
    left: number
    top: number
    width: number
    height: number
    isPrimary: boolean
}

export type WindowWithScreenDetails = Window & {
    getScreenDetails?: () => Promise<{
        screens: Array<{
            id?: string
            label?: string
            isPrimary?: boolean
            left?: number
            top?: number
            availLeft?: number
            availTop?: number
            width?: number
            height?: number
            availWidth?: number
            availHeight?: number
        }>
    }>
}

export type AnnouncementVoiceOption = "woman" | "man"

export type ResolvedEnglishVoices = {
    english: SpeechSynthesisVoice[]
    woman?: SpeechSynthesisVoice
    man?: SpeechSynthesisVoice
}

const WOMAN_VOICE_HINTS = [
    "female",
    "woman",
    "girl",
    "samantha",
    "victoria",
    "karen",
    "hazel",
    "aria",
    "ava",
    "emma",
    "amy",
    "jenny",
    "allison",
    "kendra",
    "kimberly",
    "salli",
    "joanna",
    "ivy",
    "linda",
    "serena",
    "natasha",
    "susan",
    "lucy",
    "sofia",
    "catherine",
    "olivia",
    "zira",
]

const MAN_VOICE_HINTS = [
    "male",
    "man",
    "boy",
    "david",
    "daniel",
    "george",
    "james",
    "john",
    "mark",
    "matthew",
    "oliver",
    "ryan",
    "brian",
    "arthur",
    "fred",
    "michael",
    "tom",
    "paul",
    "kevin",
    "sean",
    "alex",
    "rishi",
    "liam",
    "william",
]

const EN_US_HINTS = [
    "en-us",
    "united states",
    "us english",
    "american",
    "english (united states)",
]

export function mapBoardWindowToTicketLike(row: {
    id: string
    queueNumber: number
    transactionPurpose?: string | null
    transactionLabel?: string | null
    transactionLabels?: string[]
}) {
    return {
        _id: row.id,
        department: "",
        dateKey: "",
        queueNumber: row.queueNumber,
        studentId: "",
        status: "WAITING",
        holdAttempts: 0,
        transactionPurpose: row.transactionPurpose ?? null,
        transactionLabel: row.transactionLabel ?? undefined,
        transactionLabels: row.transactionLabels ?? undefined,
        purpose: row.transactionPurpose
            ? String(row.transactionPurpose).trim()
            : undefined,
    } as TicketType
}

function containsAnyHint(text: string, hints: string[]) {
    const low = text.toLowerCase()
    return hints.some((h) => low.includes(h))
}

export function normalizeLangTag(tag?: string | null) {
    const raw = String(tag || "").trim()
    if (!raw) return ""
    return raw.replace(/_/g, "-")
}

function isEnglishUSVoice(v: SpeechSynthesisVoice) {
    const lang = normalizeLangTag(v.lang || "").toLowerCase()
    const blob = `${v.name || ""} ${v.voiceURI || ""} ${lang}`.toLowerCase()
    return lang.startsWith("en-us") || containsAnyHint(blob, EN_US_HINTS)
}

function normalizeEnglishVoices(list: SpeechSynthesisVoice[]) {
    const map = new Map<string, SpeechSynthesisVoice>()

    for (const v of list) {
        const key =
            String(v.voiceURI || "").trim() || `${v.name}-${v.lang}`
        if (!key) continue

        const lang = normalizeLangTag(v.lang || "")
            .trim()
            .toLowerCase()
        if (!lang.startsWith("en")) continue

        if (!map.has(key)) map.set(key, v)
    }

    const out = Array.from(map.values())

    return out.sort((a, b) => {
        const aUS = isEnglishUSVoice(a) ? 0 : 1
        const bUS = isEnglishUSVoice(b) ? 0 : 1
        if (aUS !== bUS) return aUS - bUS

        const aDefault = a.default ? 0 : 1
        const bDefault = b.default ? 0 : 1
        if (aDefault !== bDefault) return aDefault - bDefault

        const aLocal = (a as any)?.localService ? 0 : 1
        const bLocal = (b as any)?.localService ? 0 : 1
        if (aLocal !== bLocal) return aLocal - bLocal

        const langCmp = String(a.lang || "").localeCompare(
            String(b.lang || "")
        )
        if (langCmp !== 0) return langCmp
        return String(a.name || "").localeCompare(String(b.name || ""))
    })
}

function isLikelyWomanVoice(v: SpeechSynthesisVoice) {
    const blob = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase()
    return (
        containsAnyHint(blob, WOMAN_VOICE_HINTS) ||
        /(?:^|[-_ ])f(?:$|[-_ 0-9])/i.test(blob)
    )
}

function isLikelyManVoice(v: SpeechSynthesisVoice) {
    const blob = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase()
    return (
        containsAnyHint(blob, MAN_VOICE_HINTS) ||
        /(?:^|[-_ ])m(?:$|[-_ 0-9])/i.test(blob)
    )
}

export function resolveGenderedEnglishVoices(
    list: SpeechSynthesisVoice[]
): ResolvedEnglishVoices {
    const english = normalizeEnglishVoices(list)
    if (!english.length) return { english: [] }

    const woman = english.find((v) => isLikelyWomanVoice(v))
    const man = english.find(
        (v) => isLikelyManVoice(v) && v.voiceURI !== woman?.voiceURI
    )

    const fallbackForWoman = english.find((v) => v.voiceURI !== man?.voiceURI)
    const fallbackForMan = english.find((v) => v.voiceURI !== woman?.voiceURI)

    return {
        english,
        woman: woman ?? fallbackForWoman ?? english[0],
        man: man ?? fallbackForMan ?? english[0],
    }
}

export function queueNumberLabel(v?: number | null) {
    if (!Number.isFinite(Number(v))) return "—"
    return `#${Number(v)}`
}

export function getTwoNumberSlice(allNumbers: number[], panelIndex: number) {
    if (!allNumbers.length) return []
    const start = panelIndex * 2
    const sliced = allNumbers.slice(start, start + 2)
    if (sliced.length) return sliced
    return allNumbers.slice(0, 2)
}

export function formatVoiceLabel(v?: SpeechSynthesisVoice) {
    if (!v) return "Auto"
    return `${v.name} (${v.lang})`
}

export function uniqueDepartmentAssignments(
    list?: DepartmentAssignment[] | null
): DepartmentAssignment[] {
    if (!Array.isArray(list)) return []

    const seen = new Set<string>()
    const out: DepartmentAssignment[] = []

    for (const item of list) {
        const id = String(item?.id || "").trim()
        if (!id || seen.has(id)) continue
        seen.add(id)

        out.push({
            id,
            name: typeof item?.name === "string" ? item.name : undefined,
            code:
                typeof item?.code === "string" ? item.code : null,
            transactionManager:
                typeof item?.transactionManager === "string"
                    ? item.transactionManager
                    : null,
            enabled: item?.enabled !== false,
        })
    }

    return out
}

export function departmentLabel(dep?: Partial<DepartmentAssignment> | null) {
    if (!dep) return "—"
    const name = String(dep.name ?? "").trim()
    const code = String(dep.code ?? "").trim()
    if (name && code) return `${name} (${code})`
    return name || code || "—"
}

export function defaultSmsCalledMessage(
    queueNumber: number,
    windowNumber?: number
) {
    const windowText =
        typeof windowNumber === "number" ? ` at Window ${windowNumber}` : ""
    return `Queue update: Your ticket #${queueNumber} is now being served${windowText}.`
}

export const SMS_SENDING_AVAILABLE = false

export const SMS_UNAVAILABLE_NOTICE =
    "Send SMS is currently unavailable at the moment due to credential and request verification in both Semaphore and Twilio. Whichever provider passes verification first will be used and integrated promptly."

export function normalizeTtsText(text: string) {
    const cleaned = String(text || "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .trim()

    if (!cleaned) return ""
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

export function buildNowServingAnnouncement(
    queueNumber: number,
    windowNumber?: number
) {
    const n = Number(queueNumber)
    const w = typeof windowNumber === "number" ? Number(windowNumber) : NaN

    if (!Number.isFinite(n)) return "Now serving."

    if (Number.isFinite(w)) {
        return `Now serving... ticket number ${n}. Please proceed to window ${w}. Thank you.`
    }

    return `Now serving... ticket number ${n}.`
}

export type SmsSenderOption =
    | "default"
    | "QUEUE"
    | "JRMSU"
    | "REGISTRAR"
    | "CASHIER"
    | "GUIDANCE"
    | "custom"

export const SMS_SENDER_OPTIONS: Array<{
    value: SmsSenderOption
    label: string
    hint?: string
}> = [
    {
        value: "default",
        label: "Default (server)",
        hint: "Use backend default sender name (recommended).",
    },
    { value: "QUEUE", label: "QUEUE" },
    { value: "JRMSU", label: "JRMSU" },
    { value: "REGISTRAR", label: "REGISTRAR" },
    { value: "CASHIER", label: "CASHIER" },
    { value: "GUIDANCE", label: "GUIDANCE" },
    { value: "custom", label: "Custom..." },
]

export function normalizeSmsSenderOption(v: unknown): SmsSenderOption {
    const s = String(v ?? "").trim()
    const allowed = new Set<SmsSenderOption>([
        "default",
        "QUEUE",
        "JRMSU",
        "REGISTRAR",
        "CASHIER",
        "GUIDANCE",
        "custom",
    ])
    return allowed.has(s as SmsSenderOption)
        ? (s as SmsSenderOption)
        : "default"
}

export function formatStatusSummary(summary?: Record<string, number>) {
    if (!summary || typeof summary !== "object") return ""
    const entries = Object.entries(summary).filter(([, v]) => Number(v) > 0)
    if (!entries.length) return ""
    return entries
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}:${v}`)
        .join(", ")
}