export function hasChildren(children: React.ReactNode): boolean {
  return Array.isArray(children) ? children.length > 0 : children != null
}
