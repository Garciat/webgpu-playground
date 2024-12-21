/**
 * @param {string} url
 * @param {'blob' | 'text' | 'json' | 'bytes' | 'arrayBuffer'} type
 * @returns
 */
export async function download(url, type) {
    const reponse = await fetch(url);
    return await reponse[type]();
}
