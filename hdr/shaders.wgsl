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
}

const LocInstance = 3;
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
  @location(0) color : vec4f,
  @location(1) normal : vec3f,
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
  output.color = model.color * instance.tint;
  output.normal = (mv_inv_matrix(instance) * vec4f(model.normal, 0.0)).xyz;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> FragmentOut
{
  var output : FragmentOut;
  // output.color = fragData.color;
  // debug normal
  output.color = vec4<f32>(fragData.normal * 0.5 + 0.5, 1.0);
  return output;
}
