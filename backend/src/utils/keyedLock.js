// src/utils/keyedLock.js
// Serialises async work per key inside this Node process. Used so that two
// simultaneous actions on the same claim (e.g. a double-clicked "Forward")
// cannot both pass validation and move the claim twice. The second caller
// waits, then re-reads the claim and fails validation cleanly.
const chains = new Map();

async function withLock(key, fn) {
  const previous = chains.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const chained = previous.then(() => current);
  chains.set(key, chained);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (chains.get(key) === chained) chains.delete(key);
  }
}

module.exports = { withLock };
