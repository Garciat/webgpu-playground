import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

export const Particle = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  velocity: { index: 1, type: memory.Vec2F },
  color: { index: 2, type: memory.Vec4F },
  radius: { index: 3, type: memory.Float32 },
});

export const Force = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  value: { index: 1, type: memory.Float32 },
});

export const RenderParams = memory.StructOf({
  modelViewProjectionMatrix: { index: 0, type: memory.Mat4x4F },
  right: { index: 1, type: memory.Vec3F },
  up: { index: 2, type: memory.Vec3F },
});

export const SimulationParams = memory.StructOf({
  deltaTime: { index: 0, type: memory.Float32 },
  friction: { index: 1, type: memory.Float32 },
  forceCutOffRadius: { index: 2, type: memory.Float32 },
  forceCount: { index: 3, type: memory.Uint32 },
  particleCount: { index: 4, type: memory.Uint32 },
});
