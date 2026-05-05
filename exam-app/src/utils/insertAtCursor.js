/**
 * Insert `insertStr` at the textarea cursor (or replace the current selection).
 * The `|` character in insertStr marks where the cursor should land after insertion.
 * If the user has a range selected, `|` is replaced by that selected text (free wrap).
 */
export function insertAtCursor(el, insertStr, setQuestion) {
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd

  const cursorMark = insertStr.indexOf('|')
  const selectedText = el.value.slice(start, end)

  let cleanText
  let cursorOffset

  if (cursorMark === -1) {
    cleanText    = insertStr
    cursorOffset = insertStr.length
  } else {
    // Replace | with selected text (free wrap for snippets like \sqrt{|})
    cleanText    = insertStr.slice(0, cursorMark) + selectedText + insertStr.slice(cursorMark + 1)
    cursorOffset = cursorMark + selectedText.length
  }

  const newValue = el.value.slice(0, start) + cleanText + el.value.slice(end)
  setQuestion(newValue)

  const newPos = start + cursorOffset
  requestAnimationFrame(() => {
    el.setSelectionRange(newPos, newPos)
    el.focus()
  })
}
