struct SimulationParams {
  deltaTime : f32,
  friction : f32,
  forceCutOffRadius : f32,
  forceCount : u32,
  particleCount : u32,
  aabb : vec4<f32>,
}
struct Particle {
  position : vec2<f32>,
  velocity : vec2<f32>,
  color : vec4<f32>,
  radius : f32,
}
struct Force {
  position : vec2<f32>,
  value : f32,
}

@binding(0) @group(0) var<uniform> simulation_params : SimulationParams;
@binding(1) @group(0) var<storage, read> forces : array<Force>;
@binding(2) @group(0) var<storage, read> particlesA : array<Particle>;
@binding(3) @group(0) var<storage, read_write> particlesB : array<Particle>;
@binding(4) @group(0) var<storage, read_write> particlesV : array<Particle>;
@binding(5) @group(0) var<storage, read_write> drawArgs : array<atomic<u32>, 4>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
  var index = GlobalInvocationID.x;
  if (index >= simulation_params.particleCount) {
    return;
  }

  var particle = particlesA[index];

  particle.position = particle.position + simulation_params.deltaTime * particle.velocity;

  for (var i = 0u; i < simulation_params.forceCount; i += 1) {
    var force = forces[i];
    var distance = distance(particle.position, force.position);
    var direction = normalize(force.position - particle.position);

    var g = force.value / (distance * distance);

    particle.velocity = particle.velocity + direction * g * f32(distance >= simulation_params.forceCutOffRadius);
  }

  particle.velocity = particle.velocity * (1.0 - simulation_params.friction);

  particlesB[index] = particle;

  let abbb = vec4<f32>(
    particle.position.x - particle.radius,
    particle.position.y - particle.radius,
    particle.position.x + particle.radius,
    particle.position.y + particle.radius
  );

  if (aabb_intersects(abbb, simulation_params.aabb)) {
    particlesV[atomicAdd(&drawArgs[1], 1u)] = particle;
  }
}

fn aabb_intersects(aabb1 : vec4<f32>, aabb2 : vec4<f32>) -> bool {
  return aabb1.x <= aabb2.z && aabb1.z >= aabb2.x && aabb1.y <= aabb2.w && aabb1.w >= aabb2.y;
}
