import * as memory from "jsr:@garciat/wgpu-memory@1.0.14";

import { PlaneDivisions, PlaneMesh } from "./types.ts";

export const PlaneMeshData = memory.allocate(PlaneMesh);
{
  const view = new DataView(PlaneMeshData);
  let i = 0;
  for (let x = 0; x < PlaneDivisions; x++) {
    for (let y = 0; y < PlaneDivisions; y++) {
      const x0 = x / PlaneDivisions - 0.5;
      const x1 = (x + 1) / PlaneDivisions - 0.5;
      const y0 = y / PlaneDivisions - 0.5;
      const y1 = (y + 1) / PlaneDivisions - 0.5;

      // deno-fmt-ignore
      PlaneMesh.set(view, i++, [
        { position: [x0, y0, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 0] },
        { position: [x1, y0, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [1, 0] },
        { position: [x1, y1, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
        { position: [x0, y1, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 1] },
        { position: [x0, y0, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 0] },
        { position: [x1, y1, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
      ]);
    }
  }
}
