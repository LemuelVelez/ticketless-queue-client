import { studentApi } from "./student"

export * from "./student"

// Keep legacy import name while sharing one unified implementation.
export const guestApi = studentApi
