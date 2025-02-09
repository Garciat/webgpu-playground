struct CullParams {
  particleCount : u32,
  aabb : vec4<f32>,
}
struct Particle {
  position : vec2<f32>,
  velocity : vec2<f32>,
  color : vec4<f32>,
  radius : f32,
}

@binding(0) @group(0) var<uniform> cull_params : CullParams;
@binding(1) @group(0) var<storage, read_write> particlesV : array<Particle>;
@binding(2) @group(0) var<storage, read_write> drawArgs : array<atomic<u32>, 4>;

@binding(0) @group(1) var<storage, read> particles : array<Particle>;

var<workgroup> localCount: atomic<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
  let index = GlobalInvocationID.x;
  if (index >= cull_params.particleCount) {
    return;
  }

  let particle = particles[index];

  let abbb = vec4<f32>(
    particle.position.x - particle.radius,
    particle.position.y - particle.radius,
    particle.position.x + particle.radius,
    particle.position.y + particle.radius
  );

  if (aabb_intersects(abbb, cull_params.aabb)) {
    particlesV[atomicAdd(&drawArgs[1], 1u)] = particle;
  }
}

fn aabb_intersects(aabb1 : vec4<f32>, aabb2 : vec4<f32>) -> bool {
  return aabb1.x <= aabb2.z && aabb1.z >= aabb2.x && aabb1.y <= aabb2.w && aabb1.w >= aabb2.y;
}
