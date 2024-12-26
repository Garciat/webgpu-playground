import { downloadBlob } from "./utils.ts";

export async function loadImageTexture(
  device: GPUDevice,
  url: string,
  format: GPUTextureFormat,
): Promise<GPUTexture> {
  const imageBitmap = await createImageBitmap(await downloadBlob(url));

  const texture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height, 1],
    format: format,
    usage: GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: texture },
    [imageBitmap.width, imageBitmap.height],
  );

  return texture;
}

/**
 * @todo Can't quite get HDR images to work yet.
 * @see https://stackoverflow.com/questions/77032862/load-hdr-10-bit-avif-image-into-a-rgba16float-texture-in-webgpu
 */
export async function loadImageTextureHDR(
  device: GPUDevice,
  url: string,
  format: GPUTextureFormat,
): Promise<GPUTexture> {
  const imageBitmap = await createImageBitmap(
    await downloadBlob(url),
    {
      colorSpaceConversion: "none",
      resizeQuality: "high",
      premultiplyAlpha: "none",
    },
  );

  const texture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height, 1],
    format: format,
    usage: GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: texture, colorSpace: "display-p3", premultipliedAlpha: false },
    [imageBitmap.width, imageBitmap.height],
  );

  return texture;
}
