/**
 * @param {string} url
 */
export async function downloadText(url) {
  const reponse = await fetch(url);
  return await reponse.text();
}

/**
 * @param {string} url
 */
export async function downloadBlob(url) {
  const reponse = await fetch(url);
  return await reponse.blob();
}

/**
 * @param {boolean} condition
 * @param {string} [message]
 */
export function assert(condition, message = '') {
  if (!condition) {
    throw Error(message);
  }
}
