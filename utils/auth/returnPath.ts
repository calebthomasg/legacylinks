export function getSafeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export function withReturnPath(path: string, returnPath: string | null) {
  if (!returnPath) {
    return path;
  }

  return `${path}?next=${encodeURIComponent(returnPath)}`;
}
