export type TransactionScope = "INTERNAL" | "EXTERNAL"

export type Department = {
    _id: string
    name: string
    code?: string | null
    transactionManager?: string | null
    enabled?: boolean
    [key: string]: unknown
}

export type ServiceWindow = {
    _id?: string
    name?: string | null
    department?: string | null
    departmentId?: string | null
    departmentIds?: string[] | null
    enabled?: boolean
    [key: string]: unknown
}

export type TransactionPurpose = {
    id: string
    key: string
    label: string
    category?: string | null
    scopes?: TransactionScope[] | string[] | null
    departmentIds?: string[] | null
    enabled?: boolean
    sortOrder?: number | string | null
    [key: string]: unknown
}