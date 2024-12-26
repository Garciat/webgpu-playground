struct Camera {
  projectionMatrix : mat4x4f,
  viewMatrix : mat4x4f,
}
@group(0) @binding(0) var<uniform> time : f32;
@group(0) @binding(1) var<uniform> camera : Camera;

struct PointLight {
  position : vec4f,
  color : vec4f,
}
@group(1) @binding(0) var<storage, read> lights : array<PointLight>;

@group(2) @binding(0) var texSampler : sampler;
@group(2) @binding(1) var texture : texture_2d<f32>;

const LocVertex = 0;
struct VertexIn {
  @location(LocVertex+0) position : vec4f,
  @location(LocVertex+1) color : vec4f,
  @location(LocVertex+2) normal : vec3f,
  @location(LocVertex+3) uv : vec2f,
}

const LocInstance = 4;
struct InstanceIn {
  @builtin(instance_index) instanceIndex : u32,

  @location(LocInstance+0) tint : vec4f,

  @location(LocInstance+1) mvMatrix0 : vec4f,
  @location(LocInstance+2) mvMatrix1 : vec4f,
  @location(LocInstance+3) mvMatrix2 : vec4f,
  @location(LocInstance+4) mvMatrix3 : vec4f,

  @location(LocInstance+5) normalMatrix0 : vec4f,
  @location(LocInstance+6) normalMatrix1 : vec4f,
  @location(LocInstance+7) normalMatrix2 : vec4f,
  @location(LocInstance+8) normalMatrix3 : vec4f,
}

fn mv_matrix(instance : InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvMatrix0,
    instance.mvMatrix1,
    instance.mvMatrix2,
    instance.mvMatrix3,
  );
}

fn normal_matrix(instance : InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.normalMatrix0,
    instance.normalMatrix1,
    instance.normalMatrix2,
    instance.normalMatrix3,
  );
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) viewPosition : vec4f,
  @location(1) color : vec4f,
  @location(2) normal : vec3f,
  @location(3) uv : vec2f,
  @location(4) @interpolate(flat) instanceIndex : u32,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(model : VertexIn, instance : InstanceIn) -> VertexOut
{
  let _t = time; // keep the compiler happy

  var output : VertexOut;
  output.position = camera.projectionMatrix * mv_matrix(instance) * model.position;
  output.viewPosition = mv_matrix(instance) * model.position;
  output.color = model.color * instance.tint;
  output.normal = (normal_matrix(instance) * vec4f(model.normal, 1.0)).xyz;
  output.uv = model.uv;
  output.instanceIndex = instance.instanceIndex;
  return output;
}

@fragment
fn fragment_main(fragData : VertexOut) -> FragmentOut
{
  let baseColor = textureSample(texture, texSampler, fragData.uv);

  if (fragData.instanceIndex == 1u) {
    // TODO: little hack to render the light source :shrug:
    return FragmentOut(vec4(5.0, 5.0, 5.0, 1.0));
  }

  let N = normalize(fragData.normal);
  var surfaceColor = vec3f(0);

  // Loop over the scene point lights.
  for (var i = 0u; i < arrayLength(&lights); i++) {
    let worldToLight = (camera.viewMatrix * lights[i].position).xyz - fragData.viewPosition.xyz;
    let dist = length(worldToLight);
    let dir = normalize(worldToLight);

    // Determine the contribution of this light to the surface color.
    let radiance = lights[i].color.rgb * (1 / pow(dist, 2));
    let nDotL = max(dot(N, dir), 0);

    // Accumulate light contribution to the surface color.
    surfaceColor += baseColor.rgb * radiance * nDotL;
  }

  var output : FragmentOut;
  output.color = vec4(surfaceColor, baseColor.a);
  // debug texture
  // output.color = baseColor;
  // debug normal
  // output.color = vec4f(fragData.normal * 0.5 + 0.5, 1.0);
  return output;
}
