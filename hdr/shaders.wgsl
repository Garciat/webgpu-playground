struct Uniforms {
  viewProjectionMatrix : mat4x4f,
}
@group(0) @binding(0) var<uniform> time : f32;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

struct VertexIn {
  @location(0) position : vec4f,
  @location(1) color : vec4f,
}

struct InstanceIn {
  @location(2) tint : vec4f,

  @location(3) mvpMatrix0 : vec4f,
  @location(4) mvpMatrix1 : vec4f,
  @location(5) mvpMatrix2 : vec4f,
  @location(6) mvpMatrix3 : vec4f,

  @location(7) mvpInvMatrix0 : vec4f,
  @location(8) mvpInvMatrix1 : vec4f,
  @location(9) mvpInvMatrix2 : vec4f,
  @location(10) mvpInvMatrix3 : vec4f,
}

fn mvp_matrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvpMatrix0,
    instance.mvpMatrix1,
    instance.mvpMatrix2,
    instance.mvpMatrix3,
  );
}

fn mvp_inv_matrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvpInvMatrix0,
    instance.mvpInvMatrix1,
    instance.mvpInvMatrix2,
    instance.mvpInvMatrix3,
  );
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(model: VertexIn, instance: InstanceIn) -> VertexOut
{
  let _t = time; // keep the compiler happy
  var _m = uniforms.viewProjectionMatrix;

  var output : VertexOut;
  output.position = mvp_matrix(instance) * model.position;
  output.color = model.color * instance.tint;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> FragmentOut
{
  var output : FragmentOut;
  output.color = fragData.color;
  return output;
}
