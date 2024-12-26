import * as memory from "jsr:@garciat/wgpu-memory@1.0.8";

export const Vertex = new memory.Struct({
  position: { index: 0, type: memory.Vec4F },
  color: { index: 1, type: memory.Vec4F },
  normal: { index: 2, type: memory.Vec3F },
  uv: { index: 3, type: memory.Vec2F },
});

export const Instance = new memory.Struct({
  tint: { index: 0, type: memory.Vec4F },
  model: { index: 1, type: memory.Mat4x4F },
  mvMatrix: { index: 2, type: memory.Mat4x4F },
  normalMatrix: { index: 3, type: memory.Mat4x4F },
});

export const Light = new memory.Struct({
  position: { index: 0, type: memory.Vec4F },
  color: { index: 1, type: memory.Vec4F },
});

export const VertexQuad = new memory.ArrayType(Vertex, 6);

export const CubeMesh = new memory.ArrayType(VertexQuad, 6);

export const PlaneDivisions = 10;

export const PlaneMesh = new memory.ArrayType(
  VertexQuad,
  PlaneDivisions * PlaneDivisions,
);

export const CameraUniform = new memory.Struct({
  projection: { index: 0, type: memory.Mat4x4F },
  view: { index: 1, type: memory.Mat4x4F },
});
