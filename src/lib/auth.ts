const LS_TOKEN_KEY = "qp_auth_token"
const SS_TOKEN_KEY = "qp_auth_token_session"

export function setAuthToken(token: string, rememberMe: boolean) {
    if (rememberMe) {
        localStorage.setItem(LS_TOKEN_KEY, token)
        sessionStorage.removeItem(SS_TOKEN_KEY)
    } else {
        sessionStorage.setItem(SS_TOKEN_KEY, token)
        localStorage.removeItem(LS_TOKEN_KEY)
    }
}

export function getAuthToken(): string | null {
    return localStorage.getItem(LS_TOKEN_KEY) || sessionStorage.getItem(SS_TOKEN_KEY)
}

export function clearAuthToken() {
    localStorage.removeItem(LS_TOKEN_KEY)
    sessionStorage.removeItem(SS_TOKEN_KEY)
}
