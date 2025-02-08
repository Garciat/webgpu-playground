import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

export const ParticleStruct = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  velocity: { index: 1, type: memory.Vec2F },
  color: { index: 2, type: memory.Vec4F },
  radius: { index: 3, type: memory.Float32 },
});

export const ForceStruct = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  value: { index: 1, type: memory.Float32 },
});

export const RenderParamsStruct = memory.StructOf({
  modelViewProjectionMatrix: { index: 0, type: memory.Mat4x4F },
  right: { index: 1, type: memory.Vec3F },
  up: { index: 2, type: memory.Vec3F },
});

export const SimulationParamsStruct = memory.StructOf({
  deltaTime: { index: 0, type: memory.Float32 },
  friction: { index: 1, type: memory.Float32 },
  forceCutOffRadius: { index: 2, type: memory.Float32 },
  forceCount: { index: 3, type: memory.Uint32 },
  particleCount: { index: 4, type: memory.Uint32 },
  aabb: { index: 5, type: memory.Vec4F },
});
