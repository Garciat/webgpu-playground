const pi = 3.14159265359;
const tau = 2.0 * pi;

struct Uniforms {
  time : vec4f,
  resolution : vec4f,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

// Source: https://www.youtube.com/watch?v=f4s1h2YETNY

fn palette(t : f32) -> vec3f {
  let a = vec3f(0.5, 0.5, 0.5);
  let b = vec3f(0.5, 0.5, 0.5);
  let c = vec3f(1.0, 1.0, 1.0);
  let d = vec3f(0.263, 0.416, 0.557);

  return a + b * cos(tau * (c * t + d));
}

@fragment
fn main(@builtin(position) position : vec4f) -> @location(0) vec4f {
  let t = uniforms.time.x; // time in seconds

  var uv = (position.xy * 2.0 - uniforms.resolution.xy) / uniforms.resolution.y;
  let uv0 = uv;
  var final_color = vec3f(0.0);

  for (var i = 0; i < 4; i += 1) {
    uv = fract(uv * 1.5) - 0.5; // partition the space; 1.5 creates more overlaps

    var d = length(uv);
    d *= exp(-length(uv0)); // a sort of filter based on the global position

    var col = palette(length(uv0) + t * 0.5 + f32(i) * 0.4);

    d = sin(d*8 + t)/8; // number of rings
    d = abs(d);

    d = pow(0.01 / d, 1.2); // contrast control

    final_color += col * d;
  }

  return vec4f(final_color, 1.0);
}
