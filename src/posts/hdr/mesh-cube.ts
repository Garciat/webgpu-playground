import * as memory from "jsr:@garciat/wgpu-memory@1.0.8";

import { CubeMesh } from "./types.ts";

export const CubeMeshData = memory.allocate(CubeMesh);
{
  const view = new DataView(CubeMeshData);

  // deno-fmt-ignore
  CubeMesh.write(view, [
    // Front face
    [
      { position: [-1, -1, 1, 1], color: [1, 0, 0, 1], normal: [0, 0, 1], uv: [0, 0] },
      { position: [1, -1, 1, 1], color: [0, 1, 0, 1], normal: [0, 0, 1], uv: [1, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
      { position: [-1, 1, 1, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 1] },
      { position: [-1, -1, 1, 1], color: [1, 0, 0, 1], normal: [0, 0, 1], uv: [0, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
    ],
    // Back face
    [
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, 0, -1], uv: [0, 0] },
      { position: [-1, 1, -1, 1], color: [0, 1, 0, 1], normal: [0, 0, -1], uv: [0, 1] },
      { position: [1, 1, -1, 1], color: [0, 0, 1, 1], normal: [0, 0, -1], uv: [1, 1] },
      { position: [1, -1, -1, 1], color: [1, 1, 1, 1], normal: [0, 0, -1], uv: [1, 0] },
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, 0, -1], uv: [0, 0] },
      { position: [1, 1, -1, 1], color: [0, 0, 1, 1], normal: [0, 0, -1], uv: [1, 1] },
    ],
    // Top face
    [
      { position: [-1, 1, -1, 1], color: [1, 0, 0, 1], normal: [0, 1, 0], uv: [0, 0] },
      { position: [-1, 1, 1, 1], color: [0, 1, 0, 1], normal: [0, 1, 0], uv: [0, 1] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 1, 0], uv: [1, 1] },
      { position: [1, 1, -1, 1], color: [1, 1, 1, 1], normal: [0, 1, 0], uv: [1, 0] },
      { position: [-1, 1, -1, 1], color: [1, 0, 0, 1], normal: [0, 1, 0], uv: [0, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 1, 0], uv: [1, 1] },
    ],
    // Bottom face
    [
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, -1, 0], uv: [0, 0] },
      { position: [1, -1, -1, 1], color: [0, 1, 0, 1], normal: [0, -1, 0], uv: [1, 0] },
      { position: [1, -1, 1, 1], color: [0, 0, 1, 1], normal: [0, -1, 0], uv: [1, 1] },
      { position: [-1, -1, 1, 1], color: [1, 1, 1, 1], normal: [0, -1, 0], uv: [0, 1] },
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, -1, 0], uv: [0, 0] },
      { position: [1, -1, 1, 1], color: [0, 0, 1, 1], normal: [0, -1, 0], uv: [1, 1] },
    ],
    // Right face
    [
      { position: [1, -1, -1, 1], color: [1, 0, 0, 1], normal: [1, 0, 0], uv: [0, 0] },
      { position: [1, 1, -1, 1], color: [0, 1, 0, 1], normal: [1, 0, 0], uv: [1, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [1, 0, 0], uv: [1, 1] },
      { position: [1, -1, 1, 1], color: [1, 1, 1, 1], normal: [1, 0, 0], uv: [0, 1] },
      { position: [1, -1, -1, 1], color: [1, 0, 0, 1], normal: [1, 0, 0], uv: [0, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [1, 0, 0], uv: [1, 1] },
    ],
    // Left face
    [
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [-1, 0, 0], uv: [0, 0] },
      { position: [-1, -1, 1, 1], color: [0, 1, 0, 1], normal: [-1, 0, 0], uv: [1, 0] },
      { position: [-1, 1, 1, 1], color: [0, 0, 1, 1], normal: [-1, 0, 0], uv: [1, 1] },
      { position: [-1, 1, -1, 1], color: [1, 1, 1, 1], normal: [-1, 0, 0], uv: [0, 1] },
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [-1, 0, 0], uv: [0, 0] },
      { position: [-1, 1, 1, 1], color: [0, 0, 1, 1], normal: [-1, 0, 0], uv: [1, 1] },
    ],
  ]);
}
