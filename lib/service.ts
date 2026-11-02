export function isValidService(service: string): boolean {
  try {
    const url = new URL(service)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}
