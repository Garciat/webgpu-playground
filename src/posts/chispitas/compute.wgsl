struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  color: vec4<f32>,
}
struct Force {
  position: vec2<f32>,
  value: f32,
}

@binding(0) @group(0) var<storage, read> forces : array<Force>;
@binding(1) @group(0) var<storage, read> particlesA : array<Particle>;
@binding(2) @group(0) var<storage, read_write> particlesB : array<Particle>;

const forceCutOffRadius = 10;
const friction = 0.05;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
  var index = GlobalInvocationID.x;

  var particle = particlesA[index];

  particle.position = particle.position + particle.velocity;

  for (var i = 0u; i < arrayLength(&forces); i = i + 1u) {
    var force = forces[i];
    var distance = distance(particle.position, force.position);
    var direction = normalize(force.position - particle.position);

    var g = force.value / (distance * distance);

    particle.velocity = particle.velocity + direction * g * f32(distance >= forceCutOffRadius);
  }

  particle.velocity = particle.velocity * (1.0 - friction);

  particlesB[index] = particle;
}
