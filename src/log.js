function format(err) {
  return err && err.message ? err.message : err;
}

// For conditions that are expected and already handled (e.g. a permission
// check that hasn't been re-granted yet, before the user has clicked
// anything) — logged at debug level so it doesn't get surfaced as an
// extension "error" in chrome://extensions.
export function logExpected(context, err) {
  console.debug(`[tab-saver] ${context}:`, format(err));
}

// For genuinely unexpected failures worth flagging.
export function logUnexpected(context, err) {
  console.warn(`[tab-saver] ${context}:`, format(err));
}
