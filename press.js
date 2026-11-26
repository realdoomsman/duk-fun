// press.html: each [data-press-copy="<name>"] button copies the [data-press-text="<name>"] block as written
// (scripts/press-kit.py puts the same blocks in the zip's story.txt). No clipboard: the text gets selected instead.
(() => {
  'use strict';
  const status = document.getElementById('press-status');
  document.querySelectorAll('[data-press-copy]').forEach((button) => {
    const name = button.dataset.pressCopy;
    const block = document.querySelector(`[data-press-text="${name}"]`);
    if (!block) return;
    button.addEventListener('click', async () => {
      const text = block.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = `copied the ${name}.`;
      } catch {
        const range = document.createRange();
        range.selectNodeContents(block);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = 'selected. hold to copy, or press ctrl/cmd + c.';
      }
    });
  });
})();
