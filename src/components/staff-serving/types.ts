export type DepartmentAssignment = {
    id: string
    name?: string
    code?: string | null
    transactionManager?: string | null
    enabled?: boolean
    [key: string]: unknown
}

export type Ticket = {
    _id?: string
    id?: string
    department?: string
    dateKey?: string
    queueNumber?: number | null
    studentId?: string | null
    status?: string
    holdAttempts?: number | null
    transactionPurpose?: string | null
    transactionLabel?: string | null
    transactionLabels?: string[] | null
    purpose?: string | null
    calledAt?: string | null
    waitingSince?: string | null
    windowNumber?: number | string | null

    participantFullName?: string | null
    participantDisplay?: string | null
    participantStudentId?: string | null
    participantMobileNumber?: string | null
    participantLabel?: string | null
    participantType?: unknown
    phone?: string | null

    name?: string | null
    fullName?: string | null
    displayName?: string | null
    firstName?: string | null
    middleName?: string | null
    lastName?: string | null

    participant?: {
        fullName?: string | null
        name?: string | null
        [key: string]: unknown
    } | null

    transaction?: {
        purpose?: string | null
        label?: string | null
        [key: string]: unknown
    } | null

    transactions?: {
        purpose?: string | null
        transactionPurpose?: string | null
        transactionLabel?: string | null
        transactionLabels?: string[] | null
        labels?: string[] | null
        [key: string]: unknown
    } | null

    meta?: {
        purpose?: string | null
        transactionPurpose?: string | null
        transactionLabel?: string | null
        transactionLabels?: string[] | null
        [key: string]: unknown
    } | null

    [key: string]: unknown
}

export type StaffDisplayBoardWindow = {
    id: string
    number: number | string
    name?: string | null
    nowServing?: Ticket | null
    [key: string]: unknown
}

export type StaffDisplaySnapshotResponse = {
    board?: {
        transactionManager?: string | null
        windows?: StaffDisplayBoardWindow[] | null
        [key: string]: unknown
    } | null
    upNext?: Ticket[] | null
    holdTickets?: Ticket[] | null
    meta?: {
        generatedAt?: string | null
        [key: string]: unknown
    } | null
    [key: string]: unknown
}