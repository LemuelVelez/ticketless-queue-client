import type { TransactionScope } from "@/api/admin"

export const DEFAULT_MANAGER = "REGISTRAR"

export type DefaultRegistrarTransaction = {
    key: string
    label: string
    scopes: TransactionScope[]
    sortOrder: number
}

export type PurposeBulkDraft = {
    id: string
    category: string
    key: string
    label: string
    scopes: TransactionScope[]
    applyToAllDepartments: boolean
    departmentIds: string[]
    enabled: boolean
    sortOrder: number
}

export const DEFAULT_REGISTRAR_TRANSACTIONS: DefaultRegistrarTransaction[] = [
    { key: "correction-grade-entry", label: "Correction of Grade Entry", scopes: ["INTERNAL"], sortOrder: 1 },
    {
        key: "correction-personal-record",
        label: "Correction of Personal Record",
        scopes: ["INTERNAL", "EXTERNAL"],
        sortOrder: 2,
    },
    {
        key: "enrollment-validation-enrollment",
        label: "Enrollment / Validation of Enrollment",
        scopes: ["INTERNAL"],
        sortOrder: 3,
    },
    {
        key: "followup-request-submission-evaluation-documents-application-graduation",
        label: "Follow-up / Request / Submission / Evaluation of Documents / Application for Graduation",
        scopes: ["INTERNAL"],
        sortOrder: 4,
    },
    {
        key: "issuance-certificates-forms-authentication",
        label: "Issuance of Certificates / Forms / Authentication",
        scopes: ["INTERNAL", "EXTERNAL"],
        sortOrder: 5,
    },
    {
        key: "issuance-transcript-of-records-tor",
        label: "Issuance of Transcript of Records (TOR)",
        scopes: ["INTERNAL", "EXTERNAL"],
        sortOrder: 6,
    },
    {
        key: "processing-faculty-clearance",
        label: "Processing Faculty Clearance",
        scopes: ["INTERNAL", "EXTERNAL"],
        sortOrder: 7,
    },
    {
        key: "processing-inc-ng-adding-changing-dropping-subjects",
        label: "Processing of INC/NG; Adding, Changing, and Dropping of Subjects",
        scopes: ["INTERNAL"],
        sortOrder: 8,
    },
    {
        key: "processing-student-clearance",
        label: "Processing of Student Clearance",
        scopes: ["INTERNAL", "EXTERNAL"],
        sortOrder: 9,
    },
    {
        key: "release-instructors-program",
        label: "Release of Instructor’s Program",
        scopes: ["INTERNAL"],
        sortOrder: 10,
    },
    {
        key: "responding-to-requests-for-institutional-data",
        label: "Responding to Requests for Institutional Data",
        scopes: ["INTERNAL", "EXTERNAL"],
        sortOrder: 11,
    },
    {
        key: "issuance-cav",
        label: "Issuance of Certification, Verification, and Authentication (CAV)",
        scopes: ["EXTERNAL"],
        sortOrder: 12,
    },
    { key: "issuance-diploma", label: "Issuance of Diploma", scopes: ["EXTERNAL"], sortOrder: 13 },
    {
        key: "issuance-form-137-honorable-dismissal",
        label: "Issuance of Form 137 / Honorable Dismissal",
        scopes: ["EXTERNAL"],
        sortOrder: 14,
    },
]