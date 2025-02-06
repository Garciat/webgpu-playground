import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

export const Particle = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  velocity: { index: 1, type: memory.Vec2F },
  color: { index: 2, type: memory.Vec4F },
});

export const Force = memory.StructOf({
  position: { index: 0, type: memory.Vec2F },
  value: { index: 1, type: memory.Float32 },
});
