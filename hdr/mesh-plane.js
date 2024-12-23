import * as memory from '../common/memory.js';
import { PlaneMesh, PlaneDivisions } from './types.js';

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
