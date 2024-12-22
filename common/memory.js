import { assert } from './utils.js';

// Type annotations

/**
 * @typedef {'primitive'|'vector'|'matrix'|'struct'|'array'} IMetaType
 */

/**
 * @template R
 * @typedef {object} IType
 * @property {IMetaType} type
 * @property {number} byteSize
 * @property {number} alignment
 * @property {(view: ArrayBufferLike|ArrayBufferView) => number} count
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

// Meta types

/**
 * @type {IMetaType}
 */
const TYPE_PRIMITIVE = 'primitive';

/**
 * @type {IMetaType}
 */
const TYPE_VECTOR = 'vector';

/**
 * @type {IMetaType}
 */
const TYPE_MATRIX = 'matrix';

/**
 * @type {IMetaType}
 */
const TYPE_STRUCT = 'struct';

/**
 * @type {IMetaType}
 */
const TYPE_ARRAY = 'array';

// Public helpers

/**
 * @param {IType<any>} type
 * @param {number} [count=1]
 * @returns {ArrayBuffer}
 */
export function allocate(type, count = 1) {
  return new ArrayBuffer(type.byteSize * count);
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
    return `Array(${this.#type.toString()}, ${this.#length})`;
  }

  /**
   * @returns {IMetaType}
   */
  get type() {
    return TYPE_ARRAY;
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
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {R[]}
   */
  read(view, offset = 0) {
    const values = Array(this.#length);

    for (let i = 0; i < this.#length; i++) {
      values[i] = this.#type.read(view, offset + i * this.#type.byteSize);
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
      this.#type.write(view, values[i], offset + i * this.#type.byteSize);
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
    return this.#type.read(view, offset + index * this.#type.byteSize);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {R} value
   * @param {number} [offset=0]
   */
  set(view, index, value, offset = 0) {
    this.#type.write(view, value, offset + index * this.#type.byteSize);
  }
}

// Struct type

/**
 * @template R
 * @template {IType<R>} T
 * @typedef {object} StructFieldDescriptor
 * @property {number} index
 * @property {T} type
 */

/**
 * @typedef {{[name: string]: StructFieldDescriptor<any, any>}} StructDescriptor
 */

/**
 * @template {StructDescriptor} S
 * @typedef {{[Name in keyof S]: StructField<S, Name, S[Name]>}} StructFieldsOf
 */

/**
 * @template {StructDescriptor} S
 * @implements {IType<any[]>}
 */
export class Struct {
  /**
   * @type {Array<StructField<S, keyof S, any>>} fields
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

    for (const name of /** @type {(keyof S)[]} */ (Object.keys(descriptor))) {
      const fieldDescriptor = descriptor[name];
      const field = new StructField(this, fieldDescriptor, name, offset);
      offset += field.byteSize; // TODO: alignment?
      this.#fields[fieldDescriptor.index] = field;
      this.#fieldsByName[name] = field;
    }

    this.#size = offset;
  }

  /**
   * @returns {string}
   */
  toString() {
    return `Struct(${this.#fields.map(field => `${String(field.name)}: ${field.type.toString()}`).join(', ')})`;
  }

  /**
   * @returns {IMetaType}
   */
  get type() {
    return TYPE_STRUCT;
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
    return 4; // TODO: alignment?
  }

  /**
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {any[]}
   */
  read(view, offset = 0) {
    const values = Array(this.#fields.length);

    for (const field of this.#fields) {
      values[field.index] = field.type.read(view, offset + field.offset);
    }

    return values;
  }

  /**
   * @param {DataView} view
   * @param {any[]} values
   * @param {number} [offset=0]
   */
  write(view, values, offset = 0) {
    for (const field of this.#fields) {
      field.type.write(view, values[field.index], offset + field.offset);
    }
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {any[]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {any[]} value
   * @param {number} [offset=0]
   */
  writeAt(view, index, value, offset = 0) {
    this.write(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} offset
   * @returns {{[Name in keyof S]: any}}
   */
  readObject(view, offset = 0) {
    const obj = /** @type {{[Name in keyof S]: any}} */ ({});

    for (const field of this.#fields) {
      obj[field.name] = field.type.read(view, offset + field.offset);
    }

    return obj;
  }

  /**
   * @param {DataView} view
   * @param {{[Name in keyof S]: any}} values
   * @param {number} [offset=0]
   */
  writeObject(view, values, offset = 0) {
    for (const field of this.#fields) {
      field.type.write(view, values[field.name], offset + field.offset);
    }
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {{[Name in keyof S]: any}}
   */
  readObjectAt(view, index, offset = 0) {
    return this.readObject(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {{[Name in keyof S]: any}} value
   * @param {number} [offset=0]
   */
  writeObjectAt(view, index, value, offset = 0) {
    this.writeObject(view, value, index * this.byteSize + offset);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @param {number} [length=1]
   * @returns {ArrayBufferView}
   */
  view(buffer, offset = 0, length = 1) {
    // TODO: ok to default to Float32?
    return Float32.view(buffer, offset, this.#size * length / Float32.byteSize);
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   * @returns {{[Name in keyof S]: ArrayBufferView}}
   */
  viewObject(buffer, offset = 0) {
    const obj = /** @type {{[Name in keyof S]: any}} */ ({});

    for (const field of this.#fields) {
      obj[field.name] = field.type.view(buffer, offset + field.offset);
    }

    return obj;
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} index
   * @param {number} [offset=0]
   * @returns {{[Name in keyof S]: ArrayBufferView}}
   */
  viewObjectAt(buffer, index, offset = 0) {
    return this.viewObject(buffer, index * this.byteSize + offset);
  }
}

/**
 * @template {StructDescriptor} S
 * @template {keyof S} Key
 * @template {StructFieldDescriptor<any, any>} F
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
   * @type {F['type']} type
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

  get name() {
    return this.#name;
  }

  get index() {
    return this.#index;
  }

  get type() {
    return this.#type;
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
   * @returns {ITypeR<F['type']>}
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
 * @implements {IType<number[][]>}
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
    assert(type.type === TYPE_PRIMITIVE, 'Matrix type must be a primitive type');
    this.#type = type;
  }

  toString() {
    return `Mat2x2(${this.#type.toString()})`;
  }

  get type() {
    return TYPE_MATRIX;
  }

  get byteSize() {
    return this.#type.byteSize * 4;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number[][]}
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
   * @param {number[][]} value
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
   * @returns {number[][]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number[][]} value
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
 * @implements {IType<number[][]>}
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
    assert(type.type === TYPE_PRIMITIVE, 'Matrix type must be a primitive type');
    this.#type = type;
  }

  toString() {
    return `Mat3x3(${this.#type.toString()})`;
  }

  get type() {
    return TYPE_MATRIX;
  }

  get byteSize() {
    return this.#type.byteSize * 9;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number[][]}
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
   * @param {number[][]} value
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
   * @returns {number[][]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number[][]} value
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
 * @implements {IType<number[][]>}
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
    assert(type.type === TYPE_PRIMITIVE, 'Matrix type must be a primitive type');
    this.#type = type;
  }

  toString() {
    return `Mat4x4(${this.#type.toString()})`;
  }

  get type() {
    return TYPE_MATRIX;
  }

  get byteSize() {
    return this.#type.byteSize * 16;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number[][]}
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
   * @param {number[][]} value
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
   * @returns {number[][]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number[][]} value
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
 * @implements {IType<number[]>}
 */
export class Vec2 {
  /**
   * @type {IType<number>}
   */
  #type;

  /**
   * @param {IType<number>} type
   */
  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Vector type must be a primitive type');
    this.#type = type;
  }

  toString() {
    return `Vec2(${this.#type.toString()})`;
  }

  get type() {
    return TYPE_VECTOR;
  }

  get byteSize() {
    return this.#type.byteSize * 2;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number[]}
   */
  read(view, offset = 0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
    ];
  }

  /**
   * @param {DataView} view
   * @param {number[]} value
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
   * @returns {number[]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number[]} value
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
   * @returns {number}
   */
  getX(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  getY(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setX(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setY(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetY);
  }
}

/**
 * @implements {IType<number[]>}
 */
export class Vec3 {
  /**
   * @type {IType<number>}
   */
  #type;

  /**
   *
   * @param {IType<number>} type
   */
  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Vector type must be a primitive type');
    this.#type = type;
  }

  toString() {
    return `Vec3(${this.#type.toString()})`;
  }

  get type() {
    return TYPE_VECTOR;
  }

  get byteSize() {
    return this.#type.byteSize * 3;
  }

  get alignment() {
    return this.#type.alignment;
  }

  /**
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number[]}
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
   * @param {number[]} value
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
   * @returns {number[]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number[]} value
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
   * @returns {number}
   */
  getX(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  getY(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  getZ(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetZ);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setX(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setY(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setZ(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetZ);
  }
}

/**
 * @implements {IType<number[]>}
 */
export class Vec4 {
  /**
   * @type {IType<number>}
   */
  #type;

  /**
   * @param {IType<number>} type
   */
  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Vector type must be a primitive type');
    this.#type = type;
  }

  toString() {
    return `Vec4(${this.#type.toString()})`;
  }

  get type() {
    return TYPE_VECTOR;
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
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number[]}
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
   * @param {number[]} value
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
   * @returns {number[]}
   */
  readAt(view, index, offset = 0) {
    return this.read(view, index * this.byteSize + offset);
  }

  /**
   * @param {DataView} view
   * @param {number} index
   * @param {number[]} value
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
   * @returns
   */
  getX(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  getY(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  getZ(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetZ);
  }

  /**
   * @param {DataView} view
   * @param {number} [offset=0]
   * @returns {number}
   */
  getW(view, offset = 0) {
    return this.#type.read(view, offset + this.offsetW);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setX(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setY(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  /**
   * @param {DataView} view
   * @param {number} value
   * @param {number} [offset=0]
   */
  setZ(view, value, offset = 0) {
    this.#type.write(view, value, offset + this.offsetZ);
  }

  /**
   * @param {DataView} view
   * @param {number} value
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
class Float32Impl {
  /**
   * @returns {string}
   */
  toString() {
    return 'Float32';
  }

  /**
   * @returns {IMetaType}
   */
  get type() {
    return TYPE_PRIMITIVE;
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
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
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
   * @returns {IMetaType}
   */
  get type() {
    return TYPE_PRIMITIVE;
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
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
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
   * @returns {IMetaType}
   */
  get type() {
    return TYPE_PRIMITIVE;
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
   * @param {ArrayBufferLike|ArrayBufferView} view
   * @returns {number}
   */
  count(view) {
    return view.byteLength / this.byteSize;
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

// Type helpers

export const Float32 = new Float32Impl();
export const Uint32 = new Uint32Impl();
export const Int32 = new Int32Impl();

export const Vec2F = new Vec2(Float32);
export const Vec3F = new Vec3(Float32);
export const Vec4F = new Vec4(Float32);
export const Mat2x2F = new Mat2x2(Float32);
export const Mat3x3F = new Mat3x3(Float32);
export const Mat4x4F = new Mat4x4(Float32);
