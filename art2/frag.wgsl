const pi = 3.14159265359;
const tau = 2.0 * pi;

struct Uniforms {
  time : vec4f,
  resolution : vec4f,
  mouse : vec4f,
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

  let coord = vec2f(position.x, uniforms.resolution.y - position.y);
  let uv0 = (coord * 2.0 - uniforms.resolution.xy) / uniforms.resolution.y;

  let mcoord = vec2f(uniforms.mouse.x, uniforms.resolution.y - uniforms.mouse.y);
  let m = (mcoord * 2.0 - uniforms.resolution.xy) / uniforms.resolution.xy;

  return sd_main(t, uv0, m);
}

fn sd_main(t : f32, uv0 : vec2f, m : vec2f) -> vec4f {
  var uv = uv0;
  var final_color = vec3f(0.0);

  for (var i = 0; i < 5; i += 1) {
    // uv = fract(uv) - 0.5;
    uv = rot2d(length(uv0)*5) * uv; // rotate the space

    var box_uv = uv;
    box_uv = fract(box_uv*1.5) - 0.5;
    var d = sd_box(box_uv, vec2f(0.1, 0.1));
    d *= exp(-length(uv0)); // a sort of filter based on the global position
    d = sin(d*8 + t)/8; // number of rings
    d = abs(d);
    d = pow(0.01 / d, 1.2); // contrast control

    var circle_uv = uv;
    var d2 = sd_circle(circle_uv - m, 0.2);
    d2 *= exp(-length(uv0));
    d2 = pow(0.01 / d2, 1.2);

    final_color += palette(length(uv0) + t * 0.5 + f32(i) * 0.4) * min(d2, d);
  }

  return vec4f(final_color, 1.0);
}

fn rot2d(a : f32) -> mat2x2f {
  let s = sin(a);
  let c = cos(a);
  return mat2x2f(c, -s, s, c);
}

fn sd_circle(p : vec2f, r : f32) -> f32 {
  return length(p) - r;
}

fn sd_box(p : vec2f, b : vec2f) -> f32 {
  let d = abs(p) - b;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}
