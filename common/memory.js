import { assert } from './utils.js';

// Type annotations

const GPU_BOOL = 'bool';
const GPU_I32 = 'i32';
const GPU_U32 = 'u32';
const GPU_F16 = 'f16';
const GPU_F32 = 'f32';
const GPU_VEC2 = 'vec2';
const GPU_VEC3 = 'vec3';
const GPU_VEC4 = 'vec4';
const GPU_MAT2X2 = 'mat2x2';
const GPU_MAT3X3 = 'mat3x3';
const GPU_MAT4X4 = 'mat4x4';
const GPU_ARRAY = 'array';
const GPU_STRUCT = 'struct';

/**
 * @type {ReadonlySet<GPUType>}
 */
const GPU_SCALAR_TYPES = new Set([GPU_BOOL, GPU_I32, GPU_U32, GPU_F16, GPU_F32]);

/**
 * @type {ReadonlySet<GPUType>}
 */
const GPU_NUMERIC_TYPES = new Set([GPU_I32, GPU_U32, GPU_F16, GPU_F32]);

/**
 * @typedef {typeof GPU_BOOL} GPUBoolType
 */

/**
 * @typedef {typeof GPU_I32 | typeof GPU_U32} GPUIntegerType
 */

/**
 * @typedef {typeof GPU_F16 | typeof GPU_F32} GPUFloatType
 */

/**
 * @typedef {GPUBoolType|GPUIntegerType|GPUFloatType} GPUScalarType
 */

/**
 * @typedef {typeof GPU_VEC2 | typeof GPU_VEC3 | typeof GPU_VEC4} GPUVectorType
 */

/**
 * @typedef {typeof GPU_MAT2X2 | typeof GPU_MAT3X3 | typeof GPU_MAT4X4} GPUMatrixType
 */

/**
 * @typedef {typeof GPU_ARRAY} GPUArrayType
 */

/**
 * @typedef {typeof GPU_STRUCT} GPUStructureType
 */

/**
 * @typedef {GPUScalarType|GPUVectorType|GPUMatrixType|GPUArrayType|GPUStructureType} GPUType
 */

/**
 * @template R
 * @typedef {object} IType
 * @property {GPUType} type
 * @property {number} byteSize
 * @property {number} alignment
 * @property {(view: DataView, offset?: number) => R} read
 * @property {(view: DataView, value: R, offset?: number) => void} write
 * @property {(view: DataView, index: number, offset?: number) => R} readAt
 * @property {(view: DataView, index: number, value: R, offset?: number) => void} writeAt
 * @property {(buffer: ArrayBuffer, offset?: number, length?: number) => ArrayBufferView} view
 */

/**
 * @template T
 * @typedef {T extends IType<infer R> ? R : never} ITypeR
 */

/**
 * @template T
 * @typedef {[T, T]} Tup2
 */

/**
 * @template T
 * @typedef {[T, T, T]} Tup3
 */

/**
 * @template T
 * @typedef {[T, T, T, T]} Tup4
 */

// Public helpers

/**
 * @template {IType<R>} T
 * @template [R=ITypeR<T>]
 * @param {T} type
 * @param {number} [count=1]
 * @returns {ArrayBuffer}
 */
export function allocate(type, count = 1) {
  return new ArrayBuffer(type.byteSize * count);
}

/**
 * @template {IType<R>} T
 * @template [R=ITypeR<T>]
 * @param {T} type
 * @param {ArrayBufferLike|ArrayBufferView} buffer
 * @returns {number}
 */
export function count(type, buffer) {
  return buffer.byteLength / type.byteSize;
}

// Array type

/**
 * @template {IType<R>} T
 * @template [R=ITypeR<T>]
 * @implements {IType<R[]>}
 */
export class ArrayType {
  /**
   * @type {IType<R>}
   */
  #type;

  /**
   * @type {number}
   */
  #length;

  /**
   * @param {T} type
   * @param {number} length
   */
  constructor(type, length) {
    this.#type = type;
    this.#length = length;
  }

  /**
   * @returns {string}
   */
  toString() {
    return `Array(${String(this.#type)}, ${this.#length})`;
  }

  /**
   * @returns {typeof GPU_ARRAY}
   */
  get type() {
    return GPU_ARRAY;
  }

  /**
   * @returns {number}
   */
  get byteSize() {
    return this.#type.byteSize * this.#length;
  }

  /**
   * @returns {number}
   */
  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R[]}
   */
  read(view, offset = 0) {
    const values = Array(this.#length);

    for (let i = 0; i < this.#length; i++) {
      values[i] = this.get(view, i, offset);
    }

    return values;
  }

  /**
   * @param {DataView} view
   * @param {R[]} values
   * @param {number} [offset=0]
   */
  write(view, values, offset = 0) {
    for (let i = 0; i < this.#length; i++) {
      this.set(view, i, values[i], offset);
    }
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {R[]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {R[]} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * this.#length);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {R}
   */
  get(view, index, offset = 0) {
    return this.#type.readAt(view, index, offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {R} value
   * @param {number} [offset=0]
   */
  set(view, index, value, offset = 0) {
    this.#type.writeAt(view, index, value, offset);
  }
}

// Struct type

/**
 * @template S
 * @typedef {{
 *   [K in keyof S]:
 *     S[K] extends {type: infer T}
 *       ? {
 *         index: number,
 *         type: T extends IType<infer R> ? T : never,
 *       }
 *       : never
 * }} StructDescriptor
 * @see https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
 */

/**
 * @template {StructDescriptor<S>} S
 * @typedef {{[K in keyof S]: StructField<S, K>}} StructFieldsOf
 */

/**
 * @template {StructDescriptor<S>} S
 * @typedef {{[K in keyof S]: ITypeR<S[K]['type']>}} StructR
 */

/**
 * @template {StructDescriptor<S>} S
 * @implements {IType<StructR<S>>}
 */
export class Struct {
  /**
   * @type {Array<StructField<S, keyof S>>} fields
   */
  #fields;

  /**
   * @type {StructFieldsOf<S>} fieldsByName
   */
  #fieldsByName;

  /**
   * @type {number} size
   */
  #size;

  /**
   * @param {S} descriptor
   */
  constructor(descriptor) {
    let offset = 0;

    this.#fields = Array(Object.keys(descriptor).length);
    this.#fieldsByName = /** @type {StructFieldsOf<S>} */ ({});

    for (const name of typedObjectKeys(descriptor)) {
      const fieldDescriptor = descriptor[name];
      const fieldType = /** @type {IType<unknown>} */ (fieldDescriptor.type);

      // Align the offset
      offset = nextMultipleOf(offset, fieldType.alignment);

      const field = new StructField(this, fieldDescriptor, name, offset);

      offset += field.byteSize;

      this.#fields[fieldDescriptor.index] = field;
      this.#fieldsByName[name] = field;
    }

    this.#size = nextMultipleOf(offset, this.alignment);
  }

  /**
   * @returns {string}
   */
  toString() {
    return `Struct(${this.#fields.map(String).join(', ')})`;
  }

  /**
   * @returns {typeof GPU_STRUCT}
   */
  get type() {
    return GPU_STRUCT;
  }

  /**
   * @returns {StructFieldsOf<S>}
   */
  get fields() {
    return this.#fieldsByName;
  }

  /**
   * @returns {number}
   */
  get byteSize() {
    return this.#size;
  }

  /**
   * @returns {number}
   */
  get alignment() {
    return 4;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {StructR<S>}
   */
  read(view, offset = 0) {
    const obj = /** @type {StructR<S>} */ ({});

    for (const field of this.#fields) {
      obj[field.name] = field.read(view, offset);
    }

    return obj;
  }

  /**
   * @param {DataView} view
   * @param {StructR<S>} values
   * @param {number} [offset=0]
   */
  write(view, values, offset = 0) {
    for (const name of typedObjectKeys(this.#fieldsByName)) {
      const field = this.#fieldsByName[name];
      field.write(view, values[name], offset);
    }
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {StructR<S>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {StructR<S>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return Float32.view(buffer, offset, this.#size * length / Float32.byteSize);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @returns {{[K in keyof S]: ArrayBufferView}}
   */
  viewObject(buffer, offset = 0) {
    const obj = /** @type {{[K in keyof S]: ArrayBufferView}} */ ({});

    for (const field of this.#fields) {
      obj[field.name] = field.view(buffer, offset);
    }

    return obj;
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {{[K in keyof S]: ArrayBufferView}}
   */
  viewObjectAt(buffer, index, offset = 0) {
    return this.viewObject(buffer, index * this.byteSize + offset);
  }
}

/**
 * @template {StructDescriptor<S>} S
 * @template {keyof S} Key
 * @template {{index: number, type: T}} [F=S[Key]]
 * @template {IType<R>} [T=S[Key]['type']]
 * @template [R=ITypeR<T>]
 */
class StructField {
  /**
   * @type {Struct<S>} parent
   */
  #parent;

  /**
   * @type {number} index
   */
  #index;

  /**
   * @type {Key} name
   */
  #name;

  /**
   * @type {T} type
   */
  #type;

  /**
   * @type {number} offset
   */
  #offset;

  /**
   * @param {Struct<S>} parent
   * @param {F} fieldDescriptor
   * @param {Key} name
   * @param {number} offset
   */
  constructor(parent, fieldDescriptor, name, offset) {
    this.#parent = parent;
    this.#index = fieldDescriptor.index;
    this.#type = fieldDescriptor.type;
    this.#name = name;
    this.#offset = offset;
  }

  toString() {
    return `${String(this.#name)}: ${String(this.#type)}`;
  }

  get name() {
    return this.#name;
  }

  get byteSize() {
    return this.#type.byteSize;
  }

  get alignment() {
    return this.#type.alignment;
  }

  get offset() {
    return this.#offset;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   */
  read(view, offset = 0) {
    return this.#type.read(view, this.#offset + offset);
  }

  /**
   * @param {DataView} view
   * @param {ITypeR<F['type']>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.#type.write(view, value, this.#offset + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {R}
   */
  readAt(view, index, offset = 0) {
    return this.#type.read(view, index * this.#parent.byteSize + this.#offset + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {ITypeR<F['type']>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.#type.write(view, value, index * this.#parent.byteSize + this.#offset + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, this.#offset + offset, length);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {ArrayBufferView}
   */
  viewAt(buffer, index, offset = 0) {
    return this.#type.view(buffer, index * this.#parent.byteSize + this.#offset + offset);
  }
}

// Matrix types

/**
 * @implements {IType<Tup2<Tup2<number>>>}
 */
export class Mat2x2 {
  /**
   * @type {IType<number>}
   */
  #type;

  /**
   * @param {IType<number>} type
   */
  constructor(type) {
    assert(GPU_NUMERIC_TYPES.has(type.type), 'Matrix type must be a numeric type');
    this.#type = type;
  }

  toString() {
    return `Mat2x2(${String(this.#type)})`;
  }

  /**
   * @returns {typeof GPU_MAT2X2}
   */
  get type() {
    return GPU_MAT2X2;
  }

  get byteSize() {
    return this.#type.byteSize * 4;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {Tup2<Tup2<number>>}
   */
  read(view, offset = 0) {
    return [
      [
        this.get(view, 0, 0, offset),
        this.get(view, 0, 1, offset),
      ],
      [
        this.get(view, 1, 0, offset),
        this.get(view, 1, 1, offset),
      ],
    ];
  }

  /**
   * @param {DataView} view
   * @param {Tup2<Tup2<number>>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.set(view, 0, 0, value[0][0], offset);
    this.set(view, 0, 1, value[0][1], offset);
    this.set(view, 1, 0, value[1][0], offset);
    this.set(view, 1, 1, value[1][1], offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {Tup2<Tup2<number>>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {Tup2<Tup2<number>>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * 4);
  }

  /**
   * @param {number} row
   * @param {number} column
   * @returns {number}
   */
  index(row, column) {
    return row * 2 + column;
  }

  /**
   * @param {number} row
   * @param {number} column
   * @returns {number}
   */
  offset(row, column) {
    return this.index(row, column) * this.#type.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} row
   * @param {number} column
   * @param {number} [offset=0]
   * @returns {number}
   */
  get(view, row, column, offset = 0) {
    return this.#type.read(view, offset + this.offset(row, column));
  }

  /**
   * @param {DataView} view
   * @param {number} row
   * @param {number} column
   * @param {number} value
   * @param {number} [offset=0]
   */
  set(view, row, column, value, offset = 0) {
    this.#type.write(view, value, offset + this.offset(row, column));
  }
}

/**
 * @implements {IType<Tup3<Tup3<number>>>}
 */
export class Mat3x3 {
  /**
   * @type {IType<number>}
   */
  #type;

  /**
   * @param {IType<number>} type
   */
  constructor(type) {
    assert(GPU_NUMERIC_TYPES.has(type.type), 'Matrix type must be a numeric type');
    this.#type = type;
  }

  toString() {
    return `Mat3x3(${String(this.#type)})`;
  }

  /**
   * @returns {typeof GPU_MAT3X3}
   */
  get type() {
    return GPU_MAT3X3;
  }

  get byteSize() {
    return this.#type.byteSize * 9;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {Tup3<Tup3<number>>}
   */
  read(view, offset = 0) {
    return [
      [
        this.get(view, 0, 0, offset),
        this.get(view, 0, 1, offset),
        this.get(view, 0, 2, offset),
      ],
      [
        this.get(view, 1, 0, offset),
        this.get(view, 1, 1, offset),
        this.get(view, 1, 2, offset),
      ],
      [
        this.get(view, 2, 0, offset),
        this.get(view, 2, 1, offset),
        this.get(view, 2, 2, offset),
      ],
    ];
  }

  /**
   * @param {DataView} view
   * @param {Tup3<Tup3<number>>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.set(view, 0, 0, value[0][0], offset);
    this.set(view, 0, 1, value[0][1], offset);
    this.set(view, 0, 2, value[0][2], offset);
    this.set(view, 1, 0, value[1][0], offset);
    this.set(view, 1, 1, value[1][1], offset);
    this.set(view, 1, 2, value[1][2], offset);
    this.set(view, 2, 0, value[2][0], offset);
    this.set(view, 2, 1, value[2][1], offset);
    this.set(view, 2, 2, value[2][2], offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {Tup3<Tup3<number>>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {Tup3<Tup3<number>>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * 9);
  }

  /**
   * @param {number} row
   * @param {number} column
   * @returns {number}
   */
  index(row, column) {
    return row * 3 + column;
  }

  /**
   * @param {number} row
   * @param {number} column
   * @returns {number}
   */
  offset(row, column) {
    return this.index(row, column) * this.#type.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} row
   * @param {number} column
   * @param {number} [offset=0]
   * @returns {number}
   */
  get(view, row, column, offset = 0) {
    return this.#type.read(view, offset + this.offset(row, column));
  }

  /**
   * @param {DataView} view
   * @param {number} row
   * @param {number} column
   * @param {number} value
   * @param {number} [offset=0]
   */
  set(view, row, column, value, offset = 0) {
    this.#type.write(view, value, offset + this.offset(row, column));
  }
}

/**
 * @implements {IType<Tup4<Tup4<number>>>}
 */
export class Mat4x4 {
  /**
   * @type {IType<number>}
   */
  #type;

  /**
   * @param {IType<number>} type
   */
  constructor(type) {
    assert(GPU_NUMERIC_TYPES.has(type.type), 'Matrix type must be a numeric type');
    this.#type = type;
  }

  toString() {
    return `Mat4x4(${String(this.#type)})`;
  }

  /**
   * @returns {typeof GPU_MAT4X4}
   */
  get type() {
    return GPU_MAT4X4;
  }

  get byteSize() {
    return this.#type.byteSize * 16;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {Tup4<Tup4<number>>}
   */
  read(view, offset = 0) {
    return [
      [
        this.get(view, 0, 0, offset),
        this.get(view, 0, 1, offset),
        this.get(view, 0, 2, offset),
        this.get(view, 0, 3, offset),
      ],
      [
        this.get(view, 1, 0, offset),
        this.get(view, 1, 1, offset),
        this.get(view, 1, 2, offset),
        this.get(view, 1, 3, offset),
      ],
      [
        this.get(view, 2, 0, offset),
        this.get(view, 2, 1, offset),
        this.get(view, 2, 2, offset),
        this.get(view, 2, 3, offset),
      ],
      [
        this.get(view, 3, 0, offset),
        this.get(view, 3, 1, offset),
        this.get(view, 3, 2, offset),
        this.get(view, 3, 3, offset),
      ],
    ];
  }

  /**
   * @param {DataView} view
   * @param {Tup4<Tup4<number>>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.set(view, 0, 0, value[0][0], offset);
    this.set(view, 0, 1, value[0][1], offset);
    this.set(view, 0, 2, value[0][2], offset);
    this.set(view, 0, 3, value[0][3], offset);
    this.set(view, 1, 0, value[1][0], offset);
    this.set(view, 1, 1, value[1][1], offset);
    this.set(view, 1, 2, value[1][2], offset);
    this.set(view, 1, 3, value[1][3], offset);
    this.set(view, 2, 0, value[2][0], offset);
    this.set(view, 2, 1, value[2][1], offset);
    this.set(view, 2, 2, value[2][2], offset);
    this.set(view, 2, 3, value[2][3], offset);
    this.set(view, 3, 0, value[3][0], offset);
    this.set(view, 3, 1, value[3][1], offset);
    this.set(view, 3, 2, value[3][2], offset);
    this.set(view, 3, 3, value[3][3], offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {Tup4<Tup4<number>>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {Tup4<Tup4<number>>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * 16);
  }

  /**
   * @param {number} row
   * @param {number} column
   * @returns {number}
   */
  index(row, column) {
    return row * 4 + column;
  }

  /**
   * @param {number} row
   * @param {number} column
   * @returns {number}
   */
  offset(row, column) {
    return this.index(row, column) * this.#type.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} row
   * @param {number} column
   * @param {number} [offset=0]
   * @returns {number}
   */
  get(view, row, column, offset = 0) {
    return this.#type.read(view, offset + this.offset(row, column));
  }

  /**
   * @param {DataView} view
   * @param {number} row
   * @param {number} column
   * @param {number} value
   * @param {number} [offset=0]
   */
  set(view, row, column, value, offset = 0) {
    this.#type.write(view, value, offset + this.offset(row, column));
  }
}

// Vector types

/**
 * @template {IType<R>} T
 * @template [R=ITypeR<T>]
 * @implements {IType<Tup2<R>>}
 */
export class Vec2 {
  /**
   * @type {T}
   */
  #type;

  /**
   * @param {T} type
   */
  constructor(type) {
    assert(GPU_SCALAR_TYPES.has(type.type), 'Vector type must be a scalar type');
    this.#type = type;
  }

  toString() {
    return `Vec2(${String(this.#type)})`;
  }

  /**
   * @returns {typeof GPU_VEC2}
   */
  get type() {
    return GPU_VEC2;
  }

  get byteSize() {
    return this.#type.byteSize * 2;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {Tup2<R>}
   */
  read(view, offset = 0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
    ];
  }

  /**
   * @param {DataView} view
   * @param {Tup2<R>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.setX(view, value[0], offset);
    this.setY(view, value[1], offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {Tup2<R>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {Tup2<R>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * 2);
  }

  get offsetX() {
    return 0;
  }

  get offsetY() {
    return this.#type.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getX(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getY(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setX(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setY(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetY);
  }
}

/**
* @template {IType<R>} T
 * @template [R=ITypeR<T>]
 * @implements {IType<Tup3<R>>}
 */
export class Vec3 {
  /**
   * @type {T}
   */
  #type;

  /**
   *
   * @param {T} type
   */
  constructor(type) {
    assert(GPU_SCALAR_TYPES.has(type.type), 'Vector type must be a scalar type');
    this.#type = type;
  }

  toString() {
    return `Vec3(${String(this.#type)})`;
  }

  /**
   * @returns {typeof GPU_VEC3}
   */
  get type() {
    return GPU_VEC3;
  }

  get byteSize() {
    return this.#type.byteSize * 3;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {Tup3<R>}
   */
  read(view, offset = 0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
      this.getZ(view, offset),
    ];
  }

  /**
   * @param {DataView} view
   * @param {Tup3<R>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.setX(view, value[0], offset);
    this.setY(view, value[1], offset);
    this.setZ(view, value[2], offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {Tup3<R>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {Tup3<R>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * 3);
  }

  get offsetX() {
    return 0;
  }

  get offsetY() {
    return this.#type.byteSize;
  }

  get offsetZ() {
    return this.#type.byteSize * 2;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getX(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getY(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getZ(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetZ);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setX(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setY(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setZ(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetZ);
  }
}

/**
 * @template {IType<R>} T
 * @template [R=ITypeR<T>]
 * @implements {IType<Tup4<R>>}
 */
export class Vec4 {
  /**
   * @type {T}
   */
  #type;

  /**
   * @param {T} type
   */
  constructor(type) {
    assert(GPU_SCALAR_TYPES.has(type.type), 'Vector type must be a scalar type');
    this.#type = type;
  }

  toString() {
    return `Vec4(${String(this.#type)})`;
  }

  /**
   * @type {typeof GPU_VEC4}
   */
  get type() {
    return GPU_VEC4;
  }

  get byteSize() {
    return this.#type.byteSize * 4;
  }

  get alignment() {
    return this.#type.alignment;
  }

  get offsetX() {
    return 0;
  }

  get offsetY() {
    return this.#type.byteSize;
  }

  get offsetZ() {
    return this.#type.byteSize * 2;
  }

  get offsetW() {
    return this.#type.byteSize * 3;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {Tup4<R>}
   */
  read(view, offset = 0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
      this.getZ(view, offset),
      this.getW(view, offset),
    ];
  }

  /**
   * @param {DataView} view
   * @param {Tup4<R>} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    this.setX(view, value[0], offset);
    this.setY(view, value[1], offset);
    this.setZ(view, value[2], offset);
    this.setW(view, value[3], offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {Tup4<R>}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {Tup4<R>} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    return this.#type.view(buffer, offset, length * 4);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getX(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getY(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getZ(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetZ);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R}
   */
  getW(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetW);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setX(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setY(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setZ(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetZ);
  }

  /**
   * @param {DataView} view
   * @param {R} value
   * @param {number} [offset=0]
   */
  setW(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetW);
  }
}

// Primitive types

/**
 * @implements {IType<number>}
 */
class Float16Impl {
  /**
   * @returns {string}
   */
  toString() {
    return 'Float16';
  }

  /**
   * @returns {typeof GPU_F16}
   */
  get type() {
    return GPU_F16;
  }

  /**
   * @returns {number}
   */
  get byteSize() {
    return 2;
  }

  /**
   * @returns {number}
   */
  get alignment() {
    return 2;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  read(view, offset = 0) {
    return DataViewGetFloat16(view, offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    DataViewSetFloat16(view, offset, value, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {number}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {Float16Array}
   */
  view(buffer, offset = 0, length = 1) {
    return new Float16Array(buffer, offset, length);
  }
}

/**
 * @implements {IType<number>}
 */
class Float32Impl {
  /**
   * @returns {string}
   */
  toString() {
    return 'Float32';
  }

  /**
   * @returns {typeof GPU_F32}
   */
  get type() {
    return GPU_F32;
  }

  /**
   * @returns {number}
   */
  get byteSize() {
    return 4;
  }

  /**
   * @returns {number}
   */
  get alignment() {
    return 4;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  read(view, offset = 0) {
    return view.getFloat32(offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    view.setFloat32(offset, value, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {number}
   */
  readAt(view, index, offset = 0) {
    return view.getFloat32(index * this.byteSize + offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    view.setFloat32(index * this.byteSize + offset, value, true);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {Float32Array}
   */
  view(buffer, offset = 0, length = 1) {
    return new Float32Array(buffer, offset, length);
  }
}

/**
 * @implements {IType<number>}
 */
class Uint32Impl {
  /**
   * @returns {string}
   */
  toString() {
    return 'Uint32';
  }

  /**
   * @returns {typeof GPU_U32}
   */
  get type() {
    return GPU_U32;
  }

  /**
   * @returns {number}
   */
  get byteSize() {
    return 4;
  }

  /**
   * @returns {number}
   */
  get alignment() {
    return 4;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  read(view, offset = 0) {
    return view.getUint32(offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    view.setUint32(offset, value, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {number}
   */
  readAt(view, index, offset = 0) {
    return view.getUint32(index * this.byteSize + offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    view.setUint32(index * this.byteSize + offset, value, true);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {Uint32Array}
   */
  view(buffer, offset = 0, length = 1) {
    return new Uint32Array(buffer, offset, length);
  }
}

/**
 * @implements {IType<number>}
 */
class Int32Impl {
  /**
   * @returns {string}
   */
  toString() {
    return 'Int32';
  }

  /**
   * @returns {typeof GPU_I32}
   */
  get type() {
    return GPU_I32;
  }

  /**
   * @returns {number}
   */
  get byteSize() {
    return 4;
  }

  /**
   * @returns {number}
   */
  get alignment() {
    return 4;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  read(view, offset = 0) {
    return view.getInt32(offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    view.setInt32(offset, value, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {number}
   */
  readAt(view, index, offset = 0) {
    return view.getInt32(index * this.byteSize + offset, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    view.setInt32(index * this.byteSize + offset, value, true);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {Int32Array}
   */
  view(buffer, offset = 0, length = 1) {
    return new Int32Array(buffer, offset, length);
  }
}

/**
 * @implements {IType<boolean>}
 */
class BoolImpl {
  /**
   * @returns {string}
   */
  toString() {
    return 'Bool';
  }

  /**
   * @returns {typeof GPU_BOOL}
   */
  get type() {
    return GPU_BOOL;
  }

  /**
   * @returns {number}
   * @see https://gpuweb.github.io/gpuweb/wgsl/#why-is-bool-4-bytes
   */
  get byteSize() {
    return 4;
  }

  /**
   * @returns {number}
   * @see https://gpuweb.github.io/gpuweb/wgsl/#why-is-bool-4-bytes
   */
  get alignment() {
    return 4;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {boolean}
   */
  read(view, offset = 0) {
    return !!view.getInt32(offset, true);
  }

  /**
   * @param {DataView} view
   * @param {boolean} value
   * @param {number} [offset=0]
   */
  write(view, value, offset = 0) {
    view.setInt32(offset, value ? 1 : 0, true);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {boolean}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {boolean} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {Uint32Array}
   */
  view(buffer, offset = 0, length = 1) {
    return new Uint32Array(buffer, offset, length);
  }
}

// Type helpers

export const Bool = new BoolImpl();

export const Float16 = new Float16Impl();
export const Float32 = new Float32Impl();
export const Uint32 = new Uint32Impl();
export const Int32 = new Int32Impl();

export const Vec2B = new Vec2(Bool);
export const Vec2H = new Vec2(Float16);
export const Vec3H = new Vec3(Float16);
export const Vec4H = new Vec4(Float16);
export const Mat2x2H = new Mat2x2(Float16);
export const Mat3x3H = new Mat3x3(Float16);
export const Mat4x4H = new Mat4x4(Float16);

export const Vec2F = new Vec2(Float32);
export const Vec3F = new Vec3(Float32);
export const Vec4F = new Vec4(Float32);
export const Mat2x2F = new Mat2x2(Float32);
export const Mat3x3F = new Mat3x3(Float32);
export const Mat4x4F = new Mat4x4(Float32);

export const Vec2U = new Vec2(Uint32);
export const Vec3U = new Vec3(Uint32);
export const Vec4U = new Vec4(Uint32);
export const Mat2x2U = new Mat2x2(Uint32);
export const Mat3x3U = new Mat3x3(Uint32);
export const Mat4x4U = new Mat4x4(Uint32);

export const Vec2I = new Vec2(Int32);
export const Vec3I = new Vec3(Int32);
export const Vec4I = new Vec4(Int32);
export const Mat2x2I = new Mat2x2(Int32);
export const Mat3x3I = new Mat3x3(Int32);
export const Mat4x4I = new Mat4x4(Int32);

// Private helpers

/**
 * @param {number} value
 * @param {number} multiple
 * @returns {number}
 */
function nextMultipleOf(value, multiple) {
  const extra = value % multiple;
  return extra ? value + multiple - extra : value;
}

/**
 * @template {object} T
 * @param {T} obj
 * @returns {Array<keyof T>}
 */
function typedObjectKeys(obj) {
  return /** @type {(keyof T)[]} */ (Object.keys(obj));
}

/**
 * @param {DataView} view
 * @param {number} byteOffset
 * @param {boolean} littleEndian
 * @returns {number}
 */
function DataViewGetFloat16(view, byteOffset, littleEndian) {
  const value = view.getUint16(byteOffset, littleEndian);
  const sign = value & 0x8000;
  const exponent = (value & 0x7C00) >> 10;
  const fraction = value & 0x03FF;
  if (exponent === 0) {
    return sign ? -0 : 0;
  }
  if (exponent === 0x1F) {
    return fraction ? NaN : sign ? -Infinity : Infinity;
  }
  return (sign ? -1 : 1) * (2 ** (exponent - 15)) * (1 + fraction / 0x400);
}

/**
 * @param {DataView} view
 * @param {number} byteOffset
 * @param {number} value
 * @param {boolean} littleEndian
 */
function DataViewSetFloat16(view, byteOffset, value, littleEndian) {
  let sign = 0;
  let exponent = 0;
  let fraction = 0;
  if (isNaN(value)) {
    sign = 0;
    exponent = 0x1F;
    fraction = 1;
  } else if (value === Infinity) {
    sign = 0;
    exponent = 0x1F;
    fraction = 0;
  } else if (value === -Infinity) {
    sign = 1;
    exponent = 0x1F;
    fraction = 0;
  } else if (value === 0) {
    sign = 1 / value === -Infinity ? 1 : 0;
    exponent = 0;
    fraction = 0;
  } else {
    sign = value < 0 ? 1 : 0;
    const absValue = Math.abs(value);
    const log2 = Math.floor(Math.log2(absValue));
    exponent = log2 + 15;
    fraction = (absValue / (2 ** log2) - 1) * 0x400;
  }
  const result = (sign << 15) | (exponent << 10) | fraction;
  view.setUint16(byteOffset, result, littleEndian);
}

/**
 * @implements {ArrayBufferView}
 */
class Float16Array {
  /**
   * @readonly
   */
  static BYTES_PER_ELEMENT = 2;

  /**
   * @type {DataView}
   */
  #view;

  /**
   * @type {number}
   */
  #byteOffset;

  /**
   * @type {number}
   */
  #length;

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [byteOffset=0]
   * @param {number} [length=1]
   */
  constructor(buffer, byteOffset = 0, length = 1) {
    this.#view = new DataView(buffer, byteOffset, length * 2);
    this.#byteOffset = byteOffset;
    this.#length = length;

    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === 'string' && !isNaN(Number(prop))) {
          return target.#get(Number(prop));
        }
        return (/** @type {any} */ (target))[prop];
      },
      set(target, prop, value) {
        if (typeof prop === 'string' && !isNaN(Number(prop))) {
          target.#set(Number(prop), value);
        }
        return true;
      },
    });
  }

  get buffer() {
    return this.#view.buffer;
  }

  get byteLength() {
    return this.#view.byteLength;
  }

  get byteOffset() {
    return this.#view.byteOffset;
  }

  /**
   * @param {number} index
   * @returns {number}
   */
  #get(index) {
    return DataViewGetFloat16(this.#view, index * 2, true);
  }

  /**
   * @param {number} index
   * @param {number} value
   */
  #set(index, value) {
    DataViewSetFloat16(this.#view, index * 2, value, true);
  }
}
