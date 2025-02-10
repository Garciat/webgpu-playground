import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

export const ParticleStruct = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  velocity: { index: 1, type: memory.Vec2F },
  color: { index: 2, type: memory.Vec4F },
  radius: { index: 3, type: memory.Float32 },
}, { compile: true });

export const ForceStruct = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  value: { index: 1, type: memory.Float32 },
}, { compile: true });

export const RenderParamsStruct = memory.StructOf({
  modelViewProjectionMatrix: { index: 0, type: memory.Mat4x4F },
}, { compile: true });

export const SimulationParamsStruct = memory.StructOf({
  deltaTime: { index: 0, type: memory.Float32 },
  friction: { index: 1, type: memory.Float32 },
  forceCutOffRadius: { index: 2, type: memory.Float32 },
  forceCount: { index: 3, type: memory.Uint32 },
  particleCount: { index: 4, type: memory.Uint32 },
}, { compile: true });

export const CullParamsStruct = memory.StructOf({
  particleCount: { index: 0, type: memory.Uint32 },
  aabb: { index: 1, type: memory.Vec4F },
}, { compile: true });
