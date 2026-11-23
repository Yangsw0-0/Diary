import type { Root } from 'mdast'

/** Display-only AST transform. Code, escaped text and original Markdown stay untouched. */
export function tagMarkdown() {
  return (tree: Root) => {
    type DisplayNode = { type: string; value?: string; children?: DisplayNode[] }
    const clean = (node: DisplayNode) => {
      if (!node.children || node.type === 'code' || node.type === 'inlineCode') return
      node.children = node.children.flatMap((child) => {
        if (child.type === 'html' && /^(?:\s*<br\s*\/?\s*>\s*)+$/i.test(child.value ?? ''))
          return node.type === 'root' ? [] : [{ type: 'break' }]
        clean(child)
        if (
          child.type === 'paragraph' &&
          !child.children?.some((n) => n.type !== 'break' && (n.type !== 'text' || n.value?.trim()))
        )
          return []
        return [child]
      })
      while (node.children[0]?.type === 'break') node.children.shift()
      while (node.children.at(-1)?.type === 'break') node.children.pop()
    }
    clean(tree)
  }
}
