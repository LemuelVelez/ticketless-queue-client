/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Building2, ClipboardList } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import {
    adminApi,
    type Department,
    type ServiceWindow,
    type TransactionPurpose,
    type TransactionScope,
} from "@/api/admin"
import { useSession } from "@/hooks/use-session"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { DepartmentManagementSection } from "@/components/admin/departments/DepartmentManagementSection"
import { PurposeManagementSection } from "@/components/admin/departments/PurposeManagementSection"
import { DepartmentDialogs } from "@/components/admin/departments/DepartmentDialogs"
import { PurposeDialogs } from "@/components/admin/departments/PurposeDialogs"
import {
    DEFAULT_MANAGER,
    DEFAULT_REGISTRAR_TRANSACTIONS,
    type PurposeBulkDraft,
} from "@/components/admin/departments/constants"
import {
    getWindowDepartmentIds,
    isEnabledFlag,
    normalizeManagerKey,
    toPurposeDraft,
    uniqueScopes,
    uniqueStringIds,
    validatePurposeDraft,
    toggleScope,
    toggleDepartmentId,
} from "@/components/admin/departments/utils"

export default function AdminDepartmentsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Admin",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])
    const [purposes, setPurposes] = React.useState<TransactionPurpose[]>([])

    const [mainTab, setMainTab] = React.useState<"departments" | "purposes">("departments")

    const [deptQ, setDeptQ] = React.useState("")
    const [deptStatusTab, setDeptStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [deptManagerFilter, setDeptManagerFilter] = React.useState<string>("all")

    const [purposeQ, setPurposeQ] = React.useState("")
    const [purposeStatusTab, setPurposeStatusTab] = React.useState<"all" | "enabled" | "disabled">("all")
    const [purposeManagerFilter, setPurposeManagerFilter] = React.useState<string>("all")
    const [purposeScopeFilter, setPurposeScopeFilter] = React.useState<string>("all")
    const [purposeDeptFilter, setPurposeDeptFilter] = React.useState<string>("all")

    const [createDeptOpen, setCreateDeptOpen] = React.useState(false)
    const [editDeptOpen, setEditDeptOpen] = React.useState(false)
    const [deleteDeptOpen, setDeleteDeptOpen] = React.useState(false)

    const [createPurposeOpen, setCreatePurposeOpen] = React.useState(false)
    const [editPurposeOpen, setEditPurposeOpen] = React.useState(false)
    const [deletePurposeOpen, setDeletePurposeOpen] = React.useState(false)

    const [editAllPurposesOpen, setEditAllPurposesOpen] = React.useState(false)
    const [editAllPurposeQ, setEditAllPurposeQ] = React.useState("")
    const [editAllPurposeDrafts, setEditAllPurposeDrafts] = React.useState<PurposeBulkDraft[]>([])

    const [selectedDept, setSelectedDept] = React.useState<Department | null>(null)
    const [selectedPurpose, setSelectedPurpose] = React.useState<TransactionPurpose | null>(null)

    const [cDeptName, setCDeptName] = React.useState("")
    const [cDeptCode, setCDeptCode] = React.useState("")
    const [cDeptManager, setCDeptManager] = React.useState(DEFAULT_MANAGER)

    const [eDeptName, setEDeptName] = React.useState("")
    const [eDeptCode, setEDeptCode] = React.useState("")
    const [eDeptManager, setEDeptManager] = React.useState(DEFAULT_MANAGER)
    const [eDeptEnabled, setEDeptEnabled] = React.useState(true)

    const [cPurposeCategory, setCPurposeCategory] = React.useState(DEFAULT_MANAGER)
    const [cPurposeKey, setCPurposeKey] = React.useState("")
    const [cPurposeLabel, setCPurposeLabel] = React.useState("")
    const [cPurposeScopes, setCPurposeScopes] = React.useState<TransactionScope[]>(["INTERNAL", "EXTERNAL"])
    const [cPurposeApplyAllDepartments, setCPurposeApplyAllDepartments] = React.useState(true)
    const [cPurposeDepartmentIds, setCPurposeDepartmentIds] = React.useState<string[]>([])
    const [cPurposeEnabled, setCPurposeEnabled] = React.useState(true)
    const [cPurposeSortOrder, setCPurposeSortOrder] = React.useState<number>(1000)

    const [ePurposeCategory, setEPurposeCategory] = React.useState(DEFAULT_MANAGER)
    const [ePurposeKey, setEPurposeKey] = React.useState("")
    const [ePurposeLabel, setEPurposeLabel] = React.useState("")
    const [ePurposeScopes, setEPurposeScopes] = React.useState<TransactionScope[]>(["INTERNAL", "EXTERNAL"])
    const [ePurposeApplyAllDepartments, setEPurposeApplyAllDepartments] = React.useState(true)
    const [ePurposeDepartmentIds, setEPurposeDepartmentIds] = React.useState<string[]>([])
    const [ePurposeEnabled, setEPurposeEnabled] = React.useState(true)
    const [ePurposeSortOrder, setEPurposeSortOrder] = React.useState<number>(1000)

    const windowsByDept = React.useMemo(() => {
        const map = new Map<string, ServiceWindow[]>()

        for (const win of windows) {
            const departmentIds = getWindowDepartmentIds(win)

            for (const deptId of departmentIds) {
                const current = map.get(deptId) ?? []
                current.push(win)
                map.set(deptId, current)
            }
        }

        return map
    }, [windows])

    const deptById = React.useMemo(() => {
        const map = new Map<string, Department>()
        for (const dept of departments) map.set(dept._id, dept)
        return map
    }, [departments])

    const managerOptions = React.useMemo(() => {
        const values = new Set<string>()

        for (const dept of departments) {
            const manager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER, "")
            if (manager) values.add(manager)
        }

        for (const purpose of purposes) {
            const manager = normalizeManagerKey(purpose.category || DEFAULT_MANAGER, "")
            if (manager) values.add(manager)
        }

        for (const raw of [cDeptManager, eDeptManager, cPurposeCategory, ePurposeCategory]) {
            const manager = normalizeManagerKey(raw, "")
            if (manager) values.add(manager)
        }

        if (deptManagerFilter !== "all") values.add(normalizeManagerKey(deptManagerFilter, ""))
        if (purposeManagerFilter !== "all") values.add(normalizeManagerKey(purposeManagerFilter, ""))

        if (values.size === 0) values.add(DEFAULT_MANAGER)

        return Array.from(values).sort((a, b) => a.localeCompare(b))
    }, [
        departments,
        purposes,
        cDeptManager,
        eDeptManager,
        cPurposeCategory,
        ePurposeCategory,
        deptManagerFilter,
        purposeManagerFilter,
    ])

    const enabledDepartments = React.useMemo(
        () => departments.filter((dept) => isEnabledFlag(dept.enabled)).sort((a, b) => a.name.localeCompare(b.name)),
        [departments]
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [deptRes, winRes, purposeRes] = await Promise.all([
                adminApi.listDepartments(),
                adminApi.listWindows(),
                adminApi.listTransactionPurposes({ includeDisabled: true }),
            ])

            setDepartments(deptRes.departments ?? [])
            setWindows(winRes.windows ?? [])
            setPurposes(purposeRes.transactions ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load admin data."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    function resetCreateDeptForm() {
        setCDeptName("")
        setCDeptCode("")
        setCDeptManager(DEFAULT_MANAGER)
    }

    function resetCreatePurposeForm() {
        setCPurposeCategory(DEFAULT_MANAGER)
        setCPurposeKey("")
        setCPurposeLabel("")
        setCPurposeScopes(["INTERNAL", "EXTERNAL"])
        setCPurposeApplyAllDepartments(true)
        setCPurposeDepartmentIds([])
        setCPurposeEnabled(true)
        setCPurposeSortOrder(1000)
    }

    function resetEditAllPurposesForm() {
        setEditAllPurposeQ("")
        setEditAllPurposeDrafts([])
    }

    function openEditAllPurposesDialog() {
        const drafts = [...purposes]
            .sort((a, b) => {
                const aEnabled = isEnabledFlag(a.enabled)
                const bEnabled = isEnabledFlag(b.enabled)
                if (aEnabled !== bEnabled) return aEnabled ? -1 : 1

                const aManager = normalizeManagerKey(a.category || DEFAULT_MANAGER)
                const bManager = normalizeManagerKey(b.category || DEFAULT_MANAGER)
                if (aManager !== bManager) return aManager.localeCompare(bManager)

                const sortDelta = (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000)
                if (sortDelta !== 0) return sortDelta

                return (a.label ?? "").localeCompare(b.label ?? "")
            })
            .map((purpose) => toPurposeDraft(purpose))

        setEditAllPurposeQ("")
        setEditAllPurposeDrafts(drafts)
        setEditAllPurposesOpen(true)
    }

    function patchEditAllPurposeDraft(id: string, patch: Partial<PurposeBulkDraft>) {
        setEditAllPurposeDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)))
    }

    function toggleEditAllPurposeScope(id: string, scope: TransactionScope, checked: boolean) {
        setEditAllPurposeDrafts((prev) =>
            prev.map((draft) => {
                if (draft.id !== id) return draft

                if (checked) {
                    if (draft.scopes.includes(scope)) return draft
                    return { ...draft, scopes: [...draft.scopes, scope] }
                }

                return { ...draft, scopes: draft.scopes.filter((value) => value !== scope) }
            })
        )
    }

    function toggleEditAllPurposeDepartment(id: string, deptId: string, checked: boolean) {
        setEditAllPurposeDrafts((prev) =>
            prev.map((draft) => {
                if (draft.id !== id) return draft

                if (checked) {
                    if (draft.departmentIds.includes(deptId)) return draft
                    return { ...draft, departmentIds: [...draft.departmentIds, deptId] }
                }

                return { ...draft, departmentIds: draft.departmentIds.filter((value) => value !== deptId) }
            })
        )
    }

    const deptRows = React.useMemo(() => {
        const query = deptQ.trim().toLowerCase()

        return departments
            .filter((dept) => {
                const enabled = isEnabledFlag(dept.enabled)
                if (deptStatusTab === "enabled" && !enabled) return false
                if (deptStatusTab === "disabled" && enabled) return false

                const manager = normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER)
                if (deptManagerFilter !== "all" && manager !== deptManagerFilter) return false

                if (!query) return true
                const haystack = `${dept.name ?? ""} ${dept.code ?? ""} ${manager}`.toLowerCase()
                return haystack.includes(query)
            })
            .sort((a, b) => {
                const aEnabled = isEnabledFlag(a.enabled)
                const bEnabled = isEnabledFlag(b.enabled)
                if (aEnabled !== bEnabled) return aEnabled ? -1 : 1

                const aManager = normalizeManagerKey(a.transactionManager || DEFAULT_MANAGER)
                const bManager = normalizeManagerKey(b.transactionManager || DEFAULT_MANAGER)
                if (aManager !== bManager) return aManager.localeCompare(bManager)

                return (a.name ?? "").localeCompare(b.name ?? "")
            })
    }, [departments, deptQ, deptStatusTab, deptManagerFilter])

    const purposeRows = React.useMemo(() => {
        const query = purposeQ.trim().toLowerCase()

        return purposes
            .filter((purpose) => {
                const enabled = isEnabledFlag(purpose.enabled)
                if (purposeStatusTab === "enabled" && !enabled) return false
                if (purposeStatusTab === "disabled" && enabled) return false

                const category = normalizeManagerKey(purpose.category || DEFAULT_MANAGER)
                if (purposeManagerFilter !== "all" && category !== purposeManagerFilter) return false

                if (
                    purposeScopeFilter !== "all" &&
                    !(purpose.scopes || []).includes(purposeScopeFilter as TransactionScope)
                ) {
                    return false
                }

                if (purposeDeptFilter !== "all") {
                    if (purposeDeptFilter === "__all_departments__") {
                        if ((purpose.departmentIds || []).length > 0) return false
                    } else if (!(purpose.departmentIds || []).includes(purposeDeptFilter)) {
                        return false
                    }
                }

                if (!query) return true

                const deptNames = (purpose.departmentIds || [])
                    .map((id: string) => deptById.get(id)?.name || id)
                    .join(" ")
                    .toLowerCase()

                const haystack = `${purpose.label ?? ""} ${purpose.key ?? ""} ${category} ${deptNames}`.toLowerCase()
                return haystack.includes(query)
            })
            .sort((a, b) => {
                const aEnabled = isEnabledFlag(a.enabled)
                const bEnabled = isEnabledFlag(b.enabled)
                if (aEnabled !== bEnabled) return aEnabled ? -1 : 1

                const aManager = normalizeManagerKey(a.category || DEFAULT_MANAGER)
                const bManager = normalizeManagerKey(b.category || DEFAULT_MANAGER)
                if (aManager !== bManager) return aManager.localeCompare(bManager)

                const sortDelta = (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000)
                if (sortDelta !== 0) return sortDelta

                return (a.label ?? "").localeCompare(b.label ?? "")
            })
    }, [
        purposes,
        purposeQ,
        purposeStatusTab,
        purposeManagerFilter,
        purposeScopeFilter,
        purposeDeptFilter,
        deptById,
    ])

    const editAllPurposeRows = React.useMemo(() => {
        const query = editAllPurposeQ.trim().toLowerCase()

        return [...editAllPurposeDrafts]
            .filter((draft) => {
                if (!query) return true

                const deptNames = (draft.departmentIds || [])
                    .map((id) => deptById.get(id)?.name || id)
                    .join(" ")
                    .toLowerCase()

                const haystack = `${draft.label} ${draft.key} ${draft.category} ${deptNames}`.toLowerCase()
                return haystack.includes(query)
            })
            .sort((a, b) => {
                const aEnabled = isEnabledFlag(a.enabled)
                const bEnabled = isEnabledFlag(b.enabled)
                if (aEnabled !== bEnabled) return aEnabled ? -1 : 1

                const aManager = normalizeManagerKey(a.category || DEFAULT_MANAGER)
                const bManager = normalizeManagerKey(b.category || DEFAULT_MANAGER)
                if (aManager !== bManager) return aManager.localeCompare(bManager)

                const sortDelta = (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000)
                if (sortDelta !== 0) return sortDelta

                return (a.label ?? "").localeCompare(b.label ?? "")
            })
    }, [editAllPurposeDrafts, editAllPurposeQ, deptById])

    function openEditDept(dept: Department) {
        setSelectedDept(dept)
        setEDeptName(dept.name ?? "")
        setEDeptCode(dept.code ?? "")
        setEDeptManager(normalizeManagerKey(dept.transactionManager || DEFAULT_MANAGER))
        setEDeptEnabled(isEnabledFlag(dept.enabled))
        setEditDeptOpen(true)
    }

    function openDeleteDept(dept: Department) {
        setSelectedDept(dept)
        setDeleteDeptOpen(true)
    }

    function openEditPurpose(purpose: TransactionPurpose) {
        setSelectedPurpose(purpose)
        setEPurposeCategory(normalizeManagerKey(purpose.category || DEFAULT_MANAGER))
        setEPurposeKey(purpose.key ?? "")
        setEPurposeLabel(purpose.label ?? "")
        setEPurposeScopes(uniqueScopes(purpose.scopes || []))
        setEPurposeApplyAllDepartments((purpose.departmentIds || []).length === 0)
        setEPurposeDepartmentIds([...(purpose.departmentIds || [])])
        setEPurposeEnabled(isEnabledFlag(purpose.enabled))
        setEPurposeSortOrder(Number.isFinite(Number(purpose.sortOrder)) ? Number(purpose.sortOrder) : 1000)
        setEditPurposeOpen(true)
    }

    async function handleCreateDept() {
        const name = cDeptName.trim()
        const code = cDeptCode.trim()
        const transactionManager = normalizeManagerKey(cDeptManager, DEFAULT_MANAGER)

        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.createDepartment({
                name,
                code: code || undefined,
                transactionManager,
            })
            toast.success("Department created.")
            setCreateDeptOpen(false)
            resetCreateDeptForm()
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create department."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveDept() {
        if (!selectedDept?._id) return toast.error("Invalid department id.")

        const name = eDeptName.trim()
        const code = eDeptCode.trim()
        const transactionManager = normalizeManagerKey(eDeptManager, DEFAULT_MANAGER)

        if (!name) return toast.error("Department name is required.")

        setSaving(true)
        try {
            await adminApi.updateDepartment(selectedDept._id, {
                name,
                code: code || undefined,
                transactionManager,
                enabled: eDeptEnabled,
            })
            toast.success("Department updated.")
            setEditDeptOpen(false)
            setSelectedDept(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update department."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteDept() {
        if (!selectedDept?._id) return toast.error("Invalid department id.")

        setSaving(true)
        try {
            await adminApi.deleteDepartment(selectedDept._id)
            toast.success("Department deleted.")
            setDeleteDeptOpen(false)
            setSelectedDept(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete department."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleCreatePurpose() {
        const category = normalizeManagerKey(cPurposeCategory, DEFAULT_MANAGER)
        const key = cPurposeKey.trim()
        const label = cPurposeLabel.trim()
        const scopes = uniqueScopes(cPurposeScopes)
        const sortOrder = Number(cPurposeSortOrder)

        if (!key) return toast.error("Purpose key is required.")
        if (!label) return toast.error("Purpose label is required.")
        if (!scopes.length) return toast.error("Select at least one scope.")
        if (!cPurposeApplyAllDepartments && cPurposeDepartmentIds.length === 0) {
            return toast.error("Select at least one department or apply to all.")
        }
        if (!Number.isFinite(sortOrder)) return toast.error("Sort order must be a valid number.")

        setSaving(true)
        try {
            await adminApi.createTransactionPurpose({
                category,
                key,
                label,
                scopes,
                enabled: cPurposeEnabled,
                sortOrder,
                applyToAllDepartments: cPurposeApplyAllDepartments,
                departmentIds: cPurposeApplyAllDepartments ? [] : cPurposeDepartmentIds,
            })
            toast.success("Transaction purpose created.")
            setCreatePurposeOpen(false)
            resetCreatePurposeForm()
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create transaction purpose."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSavePurpose() {
        if (!selectedPurpose?.id) return toast.error("Invalid transaction purpose.")

        const category = normalizeManagerKey(ePurposeCategory, DEFAULT_MANAGER)
        const key = ePurposeKey.trim()
        const label = ePurposeLabel.trim()
        const scopes = uniqueScopes(ePurposeScopes)
        const sortOrder = Number(ePurposeSortOrder)

        if (!key) return toast.error("Purpose key is required.")
        if (!label) return toast.error("Purpose label is required.")
        if (!scopes.length) return toast.error("Select at least one scope.")
        if (!ePurposeApplyAllDepartments && ePurposeDepartmentIds.length === 0) {
            return toast.error("Select at least one department or apply to all.")
        }
        if (!Number.isFinite(sortOrder)) return toast.error("Sort order must be a valid number.")

        setSaving(true)
        try {
            await adminApi.updateTransactionPurpose(selectedPurpose.id, {
                category,
                key,
                label,
                scopes,
                enabled: ePurposeEnabled,
                sortOrder,
                applyToAllDepartments: ePurposeApplyAllDepartments,
                departmentIds: ePurposeApplyAllDepartments ? [] : ePurposeDepartmentIds,
            })
            toast.success("Transaction purpose updated.")
            setEditPurposeOpen(false)
            setSelectedPurpose(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update transaction purpose."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveAllPurposes() {
        if (!editAllPurposeDrafts.length) {
            toast.error("No transaction purposes to save.")
            return
        }

        for (const draft of editAllPurposeDrafts) {
            const error = validatePurposeDraft(draft)
            if (error) {
                const label = draft.label?.trim() || draft.key?.trim() || draft.id
                toast.error(`"${label}": ${error}`)
                return
            }
        }

        setSaving(true)
        try {
            let saved = 0
            let failed = 0
            let firstError = ""

            for (const draft of editAllPurposeDrafts) {
                const scopes = uniqueScopes(draft.scopes || [])
                const departmentIds = draft.applyToAllDepartments ? [] : uniqueStringIds(draft.departmentIds || [])

                try {
                    await adminApi.updateTransactionPurpose(draft.id, {
                        category: normalizeManagerKey(draft.category, DEFAULT_MANAGER),
                        key: String(draft.key || "").trim(),
                        label: String(draft.label || "").trim(),
                        scopes,
                        enabled: Boolean(draft.enabled),
                        sortOrder: Number(draft.sortOrder),
                        applyToAllDepartments: draft.applyToAllDepartments,
                        departmentIds,
                    })
                    saved += 1
                } catch (e) {
                    failed += 1
                    if (!firstError) firstError = e instanceof Error ? e.message : "Unknown error"
                }
            }

            if (failed === 0) {
                toast.success(`Saved ${saved} transaction purpose${saved === 1 ? "" : "s"}.`)
                setEditAllPurposesOpen(false)
                resetEditAllPurposesForm()
                await fetchAll()
                return
            }

            toast.error(
                saved > 0
                    ? `Saved ${saved} transaction purpose${saved === 1 ? "" : "s"}, but ${failed} failed.${firstError ? ` First error: ${firstError}` : ""}`
                    : `Failed to save transaction purposes.${firstError ? ` ${firstError}` : ""}`
            )
        } finally {
            setSaving(false)
        }
    }

    async function handleDeletePurpose() {
        if (!selectedPurpose?.id) return toast.error("Invalid transaction purpose.")

        setSaving(true)
        try {
            await adminApi.deleteTransactionPurpose(selectedPurpose.id)
            toast.success("Transaction purpose deleted.")
            setDeletePurposeOpen(false)
            setSelectedPurpose(null)
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete transaction purpose."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveDefaultRegistrarTransactions() {
        const category = normalizeManagerKey(DEFAULT_MANAGER, DEFAULT_MANAGER)

        setSaving(true)
        try {
            const existingRegistrar = purposes.filter(
                (purpose) => normalizeManagerKey(purpose.category || DEFAULT_MANAGER) === category
            )

            const byKey = new Map<string, TransactionPurpose>()
            for (const purpose of existingRegistrar) {
                const key = String(purpose.key || "").trim()
                if (!key || byKey.has(key)) continue
                byKey.set(key, purpose)
            }

            let created = 0
            let updated = 0
            let unchanged = 0

            for (const tx of DEFAULT_REGISTRAR_TRANSACTIONS) {
                const existing = byKey.get(tx.key)
                const nextScopes = uniqueScopes(tx.scopes)

                if (!existing) {
                    await adminApi.createTransactionPurpose({
                        category,
                        key: tx.key,
                        label: tx.label,
                        scopes: nextScopes,
                        enabled: true,
                        sortOrder: tx.sortOrder,
                        applyToAllDepartments: true,
                        departmentIds: [],
                    })
                    created += 1
                    continue
                }

                const existingScopes = uniqueScopes(existing.scopes || [])
                const sameScopes =
                    existingScopes.length === nextScopes.length &&
                    nextScopes.every((scope) => existingScopes.includes(scope))

                const sameCategory = normalizeManagerKey(existing.category || DEFAULT_MANAGER) === category
                const sameLabel = String(existing.label || "").trim() === tx.label
                const sameSortOrder = Number(existing.sortOrder ?? 1000) === tx.sortOrder
                const sameEnabled = isEnabledFlag(existing.enabled)
                const sameGlobalBinding = (existing.departmentIds || []).length === 0

                if (
                    sameCategory &&
                    sameLabel &&
                    sameScopes &&
                    sameSortOrder &&
                    sameEnabled &&
                    sameGlobalBinding
                ) {
                    unchanged += 1
                    continue
                }

                await adminApi.updateTransactionPurpose(existing.id, {
                    category,
                    key: tx.key,
                    label: tx.label,
                    scopes: nextScopes,
                    enabled: true,
                    sortOrder: tx.sortOrder,
                    applyToAllDepartments: true,
                    departmentIds: [],
                })
                updated += 1
            }

            toast.success(
                `Registrar defaults saved. Created: ${created}, Updated: ${updated}, Unchanged: ${unchanged}.`
            )
            await fetchAll()
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to save registrar default transactions."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const stats = React.useMemo(() => {
        const deptTotal = departments.length
        const deptEnabled = departments.filter((dept) => isEnabledFlag(dept.enabled)).length
        const winTotal = windows.length

        const purposeTotal = purposes.length
        const purposeEnabled = purposes.filter((purpose) => isEnabledFlag(purpose.enabled)).length

        return {
            deptTotal,
            deptEnabled,
            deptDisabled: deptTotal - deptEnabled,
            winTotal,
            purposeTotal,
            purposeEnabled,
            purposeDisabled: purposeTotal - purposeEnabled,
        }
    }, [departments, windows, purposes])

    return (
        <DashboardLayout
            title="Departments"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Tabs
                    value={mainTab}
                    onValueChange={(value) => setMainTab(value as "departments" | "purposes")}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2 md:w-105">
                        <TabsTrigger value="departments" className="gap-2">
                            <Building2 className="h-4 w-4" />
                            Departments
                        </TabsTrigger>
                        <TabsTrigger value="purposes" className="gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Transaction purposes
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="departments" className="mt-4">
                        <DepartmentManagementSection
                            loading={loading}
                            saving={saving}
                            stats={{
                                deptTotal: stats.deptTotal,
                                deptEnabled: stats.deptEnabled,
                                deptDisabled: stats.deptDisabled,
                                winTotal: stats.winTotal,
                            }}
                            deptQ={deptQ}
                            onDeptQChange={setDeptQ}
                            deptManagerFilter={deptManagerFilter}
                            onDeptManagerFilterChange={setDeptManagerFilter}
                            managerOptions={managerOptions}
                            deptStatusTab={deptStatusTab}
                            onDeptStatusTabChange={setDeptStatusTab}
                            deptRows={deptRows}
                            windowsByDept={windowsByDept}
                            onRefresh={() => void fetchAll()}
                            onCreate={() => {
                                resetCreateDeptForm()
                                setCreateDeptOpen(true)
                            }}
                            onEdit={openEditDept}
                            onDelete={openDeleteDept}
                        />
                    </TabsContent>

                    <TabsContent value="purposes" className="mt-4">
                        <PurposeManagementSection
                            loading={loading}
                            saving={saving}
                            stats={{
                                purposeTotal: stats.purposeTotal,
                                purposeEnabled: stats.purposeEnabled,
                                purposeDisabled: stats.purposeDisabled,
                            }}
                            purposeQ={purposeQ}
                            onPurposeQChange={setPurposeQ}
                            purposeManagerFilter={purposeManagerFilter}
                            onPurposeManagerFilterChange={setPurposeManagerFilter}
                            purposeScopeFilter={purposeScopeFilter}
                            onPurposeScopeFilterChange={setPurposeScopeFilter}
                            purposeDeptFilter={purposeDeptFilter}
                            onPurposeDeptFilterChange={setPurposeDeptFilter}
                            purposeStatusTab={purposeStatusTab}
                            onPurposeStatusTabChange={setPurposeStatusTab}
                            managerOptions={managerOptions}
                            departments={departments}
                            purposeRows={purposeRows}
                            deptById={deptById}
                            onRefresh={() => void fetchAll()}
                            onCreate={() => {
                                resetCreatePurposeForm()
                                setCreatePurposeOpen(true)
                            }}
                            onEditAll={openEditAllPurposesDialog}
                            onSaveDefaults={() => void handleSaveDefaultRegistrarTransactions()}
                            onEdit={openEditPurpose}
                            onDelete={(purpose) => {
                                setSelectedPurpose(purpose)
                                setDeletePurposeOpen(true)
                            }}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <DepartmentDialogs
                managerOptions={managerOptions}
                saving={saving}
                createOpen={createDeptOpen}
                onCreateOpenChange={(open) => {
                    setCreateDeptOpen(open)
                    if (!open) resetCreateDeptForm()
                }}
                cDeptName={cDeptName}
                onCDeptNameChange={setCDeptName}
                cDeptCode={cDeptCode}
                onCDeptCodeChange={setCDeptCode}
                cDeptManager={cDeptManager}
                onCDeptManagerChange={setCDeptManager}
                onCreate={() => void handleCreateDept()}
                editOpen={editDeptOpen}
                onEditOpenChange={(open) => {
                    setEditDeptOpen(open)
                    if (!open) setSelectedDept(null)
                }}
                selectedDept={selectedDept}
                eDeptName={eDeptName}
                onEDeptNameChange={setEDeptName}
                eDeptCode={eDeptCode}
                onEDeptCodeChange={setEDeptCode}
                eDeptManager={eDeptManager}
                onEDeptManagerChange={setEDeptManager}
                eDeptEnabled={eDeptEnabled}
                onEDeptEnabledChange={setEDeptEnabled}
                onSave={() => void handleSaveDept()}
                deleteOpen={deleteDeptOpen}
                onDeleteOpenChange={(open) => {
                    setDeleteDeptOpen(open)
                    if (!open) setSelectedDept(null)
                }}
                onDelete={() => void handleDeleteDept()}
            />

            <PurposeDialogs
                enabledDepartments={enabledDepartments}
                saving={saving}
                createOpen={createPurposeOpen}
                onCreateOpenChange={(open) => {
                    setCreatePurposeOpen(open)
                    if (!open) resetCreatePurposeForm()
                }}
                cPurposeCategory={cPurposeCategory}
                onCPurposeCategoryChange={setCPurposeCategory}
                cPurposeKey={cPurposeKey}
                onCPurposeKeyChange={setCPurposeKey}
                cPurposeLabel={cPurposeLabel}
                onCPurposeLabelChange={setCPurposeLabel}
                cPurposeScopes={cPurposeScopes}
                onCPurposeScopeToggle={(scope, checked) =>
                    toggleScope(cPurposeScopes, setCPurposeScopes, scope, checked)
                }
                cPurposeSortOrder={cPurposeSortOrder}
                onCPurposeSortOrderChange={setCPurposeSortOrder}
                cPurposeApplyAllDepartments={cPurposeApplyAllDepartments}
                onCPurposeApplyAllDepartmentsChange={setCPurposeApplyAllDepartments}
                cPurposeDepartmentIds={cPurposeDepartmentIds}
                onCPurposeDepartmentToggle={(deptId, checked) =>
                    toggleDepartmentId(cPurposeDepartmentIds, setCPurposeDepartmentIds, deptId, checked)
                }
                cPurposeEnabled={cPurposeEnabled}
                onCPurposeEnabledChange={setCPurposeEnabled}
                onCreate={() => void handleCreatePurpose()}
                editAllOpen={editAllPurposesOpen}
                onEditAllOpenChange={(open) => {
                    setEditAllPurposesOpen(open)
                    if (!open) resetEditAllPurposesForm()
                }}
                editAllPurposeQ={editAllPurposeQ}
                onEditAllPurposeQChange={setEditAllPurposeQ}
                editAllPurposeDrafts={editAllPurposeDrafts}
                editAllPurposeRows={editAllPurposeRows}
                patchEditAllPurposeDraft={patchEditAllPurposeDraft}
                onEditAllPurposeScopeToggle={toggleEditAllPurposeScope}
                onEditAllPurposeDepartmentToggle={toggleEditAllPurposeDepartment}
                onSaveAll={() => void handleSaveAllPurposes()}
                editOpen={editPurposeOpen}
                onEditOpenChange={(open) => {
                    setEditPurposeOpen(open)
                    if (!open) setSelectedPurpose(null)
                }}
                ePurposeCategory={ePurposeCategory}
                onEPurposeCategoryChange={setEPurposeCategory}
                ePurposeKey={ePurposeKey}
                onEPurposeKeyChange={setEPurposeKey}
                ePurposeLabel={ePurposeLabel}
                onEPurposeLabelChange={setEPurposeLabel}
                ePurposeScopes={ePurposeScopes}
                onEPurposeScopeToggle={(scope, checked) =>
                    toggleScope(ePurposeScopes, setEPurposeScopes, scope, checked)
                }
                ePurposeSortOrder={ePurposeSortOrder}
                onEPurposeSortOrderChange={setEPurposeSortOrder}
                ePurposeApplyAllDepartments={ePurposeApplyAllDepartments}
                onEPurposeApplyAllDepartmentsChange={setEPurposeApplyAllDepartments}
                ePurposeDepartmentIds={ePurposeDepartmentIds}
                onEPurposeDepartmentToggle={(deptId, checked) =>
                    toggleDepartmentId(ePurposeDepartmentIds, setEPurposeDepartmentIds, deptId, checked)
                }
                ePurposeEnabled={ePurposeEnabled}
                onEPurposeEnabledChange={setEPurposeEnabled}
                onSave={() => void handleSavePurpose()}
                deleteOpen={deletePurposeOpen}
                onDeleteOpenChange={(open) => {
                    setDeletePurposeOpen(open)
                    if (!open) setSelectedPurpose(null)
                }}
                selectedPurpose={selectedPurpose}
                onDelete={() => void handleDeletePurpose()}
                deptById={deptById}
            />
        </DashboardLayout>
    )
}