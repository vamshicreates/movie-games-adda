// After an answer is revealed, move on by itself. The Next button stays so a quick reader can skip the wait,
// and a thin bar on the button shows how long is left.
let timer = null;

export function cancelAutoNext() {
  clearTimeout(timer);
  timer = null;
}

export function autoNext(button, ms) {
  cancelAutoNext();
  if (!button) return;
  button.classList.add('auto');
  button.style.setProperty('--auto-ms', `${ms}ms`);
  button.addEventListener('click', cancelAutoNext, { once: true });
  timer = setTimeout(() => {
    timer = null;
    if (button.isConnected) button.click();
  }, ms);
}
