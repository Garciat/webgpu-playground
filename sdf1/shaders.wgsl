const pi = 3.14159265359;
const tau = 2.0 * pi;

struct Uniforms {
  time : vec4f,
  resolution : vec4f,
  mouse : vec4f,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexIn {
  @builtin(vertex_index) index : u32,
}

struct VertexOut {
  @builtin(position) position : vec4f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex : VertexIn) -> VertexOut {
  const pos = array(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  );

  var output : VertexOut;
  output.position = vec4f(pos[vertex.index], 0.0, 1.0);
  return output;
}

// Source: https://www.youtube.com/watch?v=khblXafu7iA

fn palette(t : f32) -> vec3f {
  let a = vec3f(0.5, 0.5, 0.5);
  let b = vec3f(0.5, 0.5, 0.5);
  let c = vec3f(1.0, 1.0, 1.0);
  let d = vec3f(0.263, 0.416, 0.557);

  return a + b * cos(tau * (c * t + d));
}

fn sdf_op_union(d1 : f32, d2 : f32) -> f32 {
  return min(d1, d2);
}

fn sdf_op_substraction(d1 : f32, d2 : f32) -> f32 {
  return max(-d1, d2);
}

fn sdf_op_intersection(d1 : f32, d2 : f32) -> f32 {
  return max(d1, d2);
}

fn sdf_sphere(p : vec3f, s : f32) -> f32 {
  return length(p) - s;
}

fn sdf_box(p : vec3f, b : vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0))) + min(max(q.x, max(q.y, q.z)), 0);
}

fn sdf_main(p : vec3f) -> f32 {
  let time = uniforms.time.x;

  let sphere_pos = vec3f(3 * sin(time), 0, 0);
  let sphere = sdf_sphere(p - sphere_pos, 1.0);

  var q = p;
  q = q + vec3f(0, time-0.4, 0);
  q = fract(q) - 0.5;
  q = rot3d(q, vec3f(0, 0, 1), time);
  let box = sdf_box(q, vec3f(0.1));

  // let ground = p.y + 0.75;

  return sdf_op_union(sphere, box);
}

@fragment
fn fragment_main(fragment : VertexOut) -> FragmentOut {
  let time = uniforms.time.x; // time in seconds

  let coord = vec2f(fragment.position.x, uniforms.resolution.y - fragment.position.y);
  let uv = (coord * 2.0 - uniforms.resolution.xy) / uniforms.resolution.y;

  let mcoord = vec2f(uniforms.mouse.x, uniforms.resolution.y - uniforms.mouse.y);
  var m = (mcoord * 2.0 - uniforms.resolution.xy) / uniforms.resolution.xy;

  var ro = vec3f(0, 0, -3); // ray origin
  var rd = normalize(vec3(uv, 1)); // ray direction
  var col = vec3f(0, 0, 0);

  ro = rot3d(ro, vec3f(1, 0, 0), -m.y);
  rd = rot3d(rd, vec3f(1, 0, 0), -m.y);
  ro = rot3d(ro, vec3f(0, 1, 0), -m.x);
  rd = rot3d(rd, vec3f(0, 1, 0), -m.x);

  var t = 0.0; // distance travelled

  // Raymarching
  for (var i = 0u; i < 80; i += 1) {
    let p = ro + rd * t; // position along the ray

    let d = sdf_main(p); // current distance to the scene

    t += d; // march the ray

    // col = vec3(f32(i)) / 80;

    if (d < 0.001 || t > 100.0) {
      break;
    }
  }

  // Coloring
  col = palette(t * 0.05);

  var output : FragmentOut;
  output.color = vec4f(col, 1.0);
  return output;
}

fn rot2d(a : f32) -> mat2x2f {
  let s = sin(a);
  let c = cos(a);
  return mat2x2f(c, -s, s, c);
}

fn rot3d(p : vec3f, axis : vec3f, angle : f32) -> vec3f {
  return mix(dot(axis, p) * axis, p, cos(angle))
         + cross(axis, p) * sin(angle);
}
