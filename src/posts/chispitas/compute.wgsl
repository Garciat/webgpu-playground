struct SimulationParams {
  deltaTime : f32,
  friction : f32,
  forceCutOffRadius : f32,
}
struct Particle {
  position : vec2<f32>,
  velocity : vec2<f32>,
  color : vec4<f32>,
}
struct Force {
  position : vec2<f32>,
  value : f32,
}

@binding(0) @group(0) var<uniform> simulation_params : SimulationParams;
@binding(1) @group(0) var<storage, read> forces : array<Force>;
@binding(2) @group(0) var<storage, read> particlesA : array<Particle>;
@binding(3) @group(0) var<storage, read_write> particlesB : array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
  var index = GlobalInvocationID.x;

  var particle = particlesA[index];

  particle.position = particle.position + simulation_params.deltaTime * particle.velocity;

  for (var i = 0u; i < arrayLength(&forces); i += 1) {
    var force = forces[i];
    var distance = distance(particle.position, force.position);
    var direction = normalize(force.position - particle.position);

    var g = force.value / (distance * distance);

    particle.velocity = particle.velocity + direction * g * f32(distance >= simulation_params.forceCutOffRadius);
  }

  particle.velocity = particle.velocity * (1.0 - simulation_params.friction);

  particlesB[index] = particle;
}
