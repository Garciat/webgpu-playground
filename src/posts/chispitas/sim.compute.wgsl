struct SimulationParams {
  deltaTime : f32,
  friction : f32,
  forceCutOffRadius : f32,
  forceCount : u32,
  particleCount : u32,
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

@binding(0) @group(1) var<storage, read> particlesA : array<Particle>;
@binding(1) @group(1) var<storage, read_write> particlesB : array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
  let index = GlobalInvocationID.x;
  if (index >= simulation_params.particleCount) {
    return;
  }

  var particle = particlesA[index];

  particle.position = particle.position + simulation_params.deltaTime * particle.velocity;

  for (var i = 0u; i < simulation_params.forceCount; i += 1) {
    let force = forces[i];
    let distance = distance(particle.position, force.position);
    let direction = normalize(force.position - particle.position);

    let g = force.value / (distance * distance);

    particle.velocity = particle.velocity + direction * g * f32(distance >= simulation_params.forceCutOffRadius);
  }

  particle.velocity = particle.velocity * (1.0 - simulation_params.friction);

  particlesB[index] = particle;
}