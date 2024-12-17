struct PointLight {
  position : vec3f,
  color : vec3f,
}

struct LightStorage {
  pointCount : u32,
  point : array<PointLight, 1>,
}

var<private> lights: LightStorage = LightStorage(
  1,
  array(
    PointLight(
      vec3f(0.0, 0.0, -4.0),
      vec3f(5.0, 5.0, 5.0),
    ),
  )
);

struct Uniforms {
  projectionMatrix : mat4x4f,
}
@group(0) @binding(0) var<uniform> time : f32;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

const LocVertex = 0;
struct VertexIn {
  @location(LocVertex+0) position : vec4f,
  @location(LocVertex+1) color : vec4f,
  @location(LocVertex+2) normal : vec3f,
  @location(LocVertex+3) uv : vec2f,
}

const LocInstance = 4;
struct InstanceIn {
  @location(LocInstance+0) tint : vec4f,

  @location(LocInstance+1) mvMatrix0 : vec4f,
  @location(LocInstance+2) mvMatrix1 : vec4f,
  @location(LocInstance+3) mvMatrix2 : vec4f,
  @location(LocInstance+4) mvMatrix3 : vec4f,

  @location(LocInstance+5) mvInvMatrix0 : vec4f,
  @location(LocInstance+6) mvInvMatrix1 : vec4f,
  @location(LocInstance+7) mvInvMatrix2 : vec4f,
  @location(LocInstance+8) mvInvMatrix3 : vec4f,
}

fn mv_matrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvMatrix0,
    instance.mvMatrix1,
    instance.mvMatrix2,
    instance.mvMatrix3,
  );
}

fn mv_inv_matrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvInvMatrix0,
    instance.mvInvMatrix1,
    instance.mvInvMatrix2,
    instance.mvInvMatrix3,
  );
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) worldPosition : vec4f,
  @location(1) color : vec4f,
  @location(2) normal : vec3f,
  @location(3) uv : vec2f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(model: VertexIn, instance: InstanceIn) -> VertexOut
{
  let _t = time; // keep the compiler happy

  var output : VertexOut;
  output.position = uniforms.projectionMatrix * mv_matrix(instance) * model.position;
  output.worldPosition = mv_matrix(instance) * model.position;
  output.color = model.color * instance.tint;
  output.normal = (mv_inv_matrix(instance) * vec4f(model.normal, 0.0)).xyz;
  output.uv = model.uv;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> FragmentOut
{
  let baseColor = fragData.color;

  let N = normalize(fragData.normal);
  var surfaceColor = vec3f(0);

  // Loop over the scene point lights.
  for (var i = 0u; i < lights.pointCount; i++) {
    let worldToLight = lights.point[i].position - fragData.worldPosition.xyz;
    let dist = length(worldToLight);
    let dir = normalize(worldToLight);

    // Determine the contribution of this light to the surface color.
    let radiance = lights.point[i].color * (1 / pow(dist, 2));
    let nDotL = max(dot(N, dir), 0);

    // Accumulate light contribution to the surface color.
    surfaceColor += baseColor.rgb * radiance * nDotL;
  }

  var output : FragmentOut;
  output.color = vec4(surfaceColor, baseColor.a);
  // debug normal
  // output.color = vec4f(fragData.normal * 0.5 + 0.5, 1.0);
  return output;
}
