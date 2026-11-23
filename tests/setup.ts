import '@testing-library/jest-dom/vitest'

// JSDOM has no text geometry; focused ProseMirror virtual cursors require these APIs.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()
