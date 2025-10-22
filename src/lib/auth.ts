"use client"

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return !!localStorage.getItem("auth_token")
}

export function getUserEmail(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("user_email")
}

export function logout() {
  if (typeof window === "undefined") return
  localStorage.removeItem("auth_token")
  localStorage.removeItem("user_email")
  localStorage.removeItem("user_role")
  window.location.href = "/login"
}

export function getUserRole(): "user" | "staff" | "admin" {
  if (typeof window === "undefined") return "user"
  const role = localStorage.getItem("user_role")
  if (role === "admin" || role === "staff" || role === "user") {
    return role
  }
  return "user"
}
