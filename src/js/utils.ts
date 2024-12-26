export async function downloadText(url: string): Promise<string> {
  const reponse = await fetch(url);
  return await reponse.text();
}

/**
 * @param {string} url
 */
export async function downloadBlob(url: string): Promise<Blob> {
  const reponse = await fetch(url);
  return await reponse.blob();
}

export function assert(
  condition: boolean,
  message: string = "",
): asserts condition is true {
  if (!condition) {
    throw Error(message);
  }
}
