import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

export const Vertex = memory.StructOf({
  position: { index: 0, type: memory.Vec4F },
  color: { index: 1, type: memory.Vec4F },
  normal: { index: 2, type: memory.Vec3F },
  uv: { index: 3, type: memory.Vec2F },
});

export const Instance = memory.StructOf({
  tint: { index: 0, type: memory.Vec4F },
  model: { index: 1, type: memory.Mat4x4F },
  mvMatrix: { index: 2, type: memory.Mat4x4F },
  normalMatrix: { index: 3, type: memory.Mat4x4F },
});

export const Light = memory.StructOf({
  position: { index: 0, type: memory.Vec4F },
  color: { index: 1, type: memory.Vec4F },
});

export const VertexQuad = memory.ArrayOf(Vertex, 6);

export const CubeMesh = memory.ArrayOf(VertexQuad, 6);

export const PlaneDivisions = 10;

export const PlaneMesh = memory.ArrayOf(
  VertexQuad,
  PlaneDivisions * PlaneDivisions,
);

export const CameraUniform = memory.StructOf({
  projection: { index: 0, type: memory.Mat4x4F },
  view: { index: 1, type: memory.Mat4x4F },
});
