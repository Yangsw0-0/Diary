import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import type { TagCompletion } from '@/application/TagCompletion'

/** A ProseMirror widget renders ghost text; it is never serialized into Markdown. */
export function createTagCompletionPlugin(completion: TagCompletion) {
  return $prose(() => {
    let dismissed: { position: number; prefix: string } | null = null
    return new Plugin({
      props: {
        decorations(state) {
          const selection = state.selection
          if (!selection.empty) return null
          const parent = selection.$from.parent
          if (parent.type.name !== 'heading' || parent.attrs.level !== 2) return null
          const offset = selection.$from.parentOffset
          if (offset < 1 || offset !== parent.textContent.length) return null
          const prefix = parent.textContent.slice(0, offset)
          if (dismissed?.position === selection.from && dismissed.prefix === prefix) return null
          const candidate = completion.suggest(prefix)
          if (!candidate || candidate === prefix) return null
          return DecorationSet.create(state.doc, [
            Decoration.widget(
              selection.from,
              () => {
                const hint = document.createElement('span')
                hint.className = 'tag-completion-ghost'
                hint.textContent = candidate.slice(prefix.length)
                hint.setAttribute('aria-hidden', 'true')
                return hint
              },
              { side: 1 },
            ),
          ])
        },
        handleKeyDown(view, event) {
          if (
            (event.key !== 'Tab' && event.key !== 'Escape') ||
            event.isComposing ||
            view.composing
          )
            return false
          const { selection } = view.state
          const parent = selection.$from.parent
          if (
            !selection.empty ||
            parent.type.name !== 'heading' ||
            parent.attrs.level !== 2 ||
            selection.$from.parentOffset !== parent.textContent.length
          )
            return false
          const prefix = parent.textContent
          const candidate = completion.suggest(prefix)
          if (!candidate || candidate === prefix) return false
          event.preventDefault()
          if (event.key === 'Escape') {
            dismissed = { position: selection.from, prefix }
            view.dispatch(view.state.tr.setMeta('tagCompletionDismissed', true))
            return true
          }
          dismissed = null
          view.dispatch(view.state.tr.insertText(candidate.slice(prefix.length), selection.from))
          return true
        },
      },
    })
  })
}
