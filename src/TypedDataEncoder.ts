import { TypedDataField, TypedDataDomain, Bytes, Numbers } from './types';
import { concat, getAddress, id, toBytes } from './utils';
import { keccak256, padLeft, toBigInt, toHex, toTwosComplement } from 'web3-utils';
import { isHexString } from 'web3-validator';
const padding = new Uint8Array(32);
padding.fill(0);

const BN__1 = BigInt(-1);
const BN_0 = BigInt(0);
const BN_1 = BigInt(1);
const BN_MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

function hexPadRight(value: Bytes): string {
	const bytes = toBytes(value);
	const padOffset = bytes.length % 32;
	if (padOffset) {
		return concat([bytes, padding.slice(padOffset)]);
	}
	return toHex(bytes);
}

function toQuantity(value: Numbers): string {
	let result = toHex(value).substring(2);
	while (result.startsWith('0')) {
		result = result.substring(1);
	}
	if (result === '') {
		result = '0';
	}
	return '0x' + result;
}
const hexTrue = padLeft(toHex(BN_1), 64);
const hexFalse = padLeft(toHex(BN_0), 64);

const domainFieldTypes: Record<string, string> = {
	name: 'string',
	version: 'string',
	chainId: 'uint256',
	verifyingContract: 'address',
	salt: 'bytes32',
};

const domainFieldNames: Array<string> = ['name', 'version', 'chainId', 'verifyingContract', 'salt'];

function checkString(key: string): (value: any) => string {
	return function (value: any) {
		if (typeof value !== 'string') {
			throw new Error(`invalid domain value for ${JSON.stringify(key)}. domain.${key}`);
		}
		return value;
	};
}
function zeroPad(data: Bytes, length: number, left: boolean = true): string {
	const bytes = toBytes(data);
	if (length < bytes.length) {
		throw new Error('padding exceeds data length');
	}

	const result = new Uint8Array(length);
	result.fill(0);
	if (left) {
		result.set(bytes, length - bytes.length);
	} else {
		result.set(bytes, 0);
	}

	return toHex(result);
}
const domainChecks: Record<string, (value: any) => any> = {
	name: checkString('name'),
	version: checkString('version'),
	chainId: function (_value: any) {
		const value = toBigInt(_value);
		if (value < 0) {
			throw new Error(`invalid domain value for chain ID. domain.chainId`);
		}
		if (Number.isSafeInteger(value)) {
			return Number(value);
		}
		return toQuantity(value);
	},
	verifyingContract: function (value: any) {
		try {
			return getAddress(value).toLowerCase();
		} catch (error) {}
		throw new Error('invalid domain value "verifyingContract"');
	},
	salt: function (value: any) {
		const bytes = toBytes(value);
		if (bytes.length !== 32) {
			throw new Error('invalid domain value "salt"');
		}
		return toHex(bytes);
	},
};
function mask(_value: Numbers, _bits: number | bigint): bigint {
	const value = toBigInt(_value);
	const bits = toBigInt(_bits);
	return value & ((BN_1 << bits) - BN_1);
}
function getBaseEncoder(type: string): null | ((value: any) => string) {
	// intXX and uintXX
	{
		const match = type.match(/^(u?)int(\d+)$/);
		if (match) {
			const signed = match[1] === '';

			const width = parseInt(match[2]);
			if (!(width % 8 === 0 && width !== 0 && width <= 256 && match[2] === String(width))) {
				throw new Error('getBaseEncoder: invalid numeric width');
			}

			const boundsUpper = mask(BN_MAX_UINT256, signed ? width - 1 : width);
			const boundsLower = signed ? (boundsUpper + BN_1) * BN__1 : BN_0;

			return function (_value: Numbers) {
				const value = toBigInt(_value);

				if (!(value >= boundsLower && value <= boundsUpper)) {
					throw new Error(`value out-of-bounds for ${type}`);
				}
				return padLeft(toHex(signed ? toTwosComplement(value, 256) : value), 64);
			};
		}
	}

	// bytesXX
	{
		const match = type.match(/^bytes(\d+)$/);
		if (match) {
			const width = parseInt(match[1]);
			if (!(width !== 0 && width <= 32 && match[1] === String(width))) {
				throw new Error('getBaseEncoder: invalid bytes width');
			}

			return function (value: Numbers) {
				const bytes = toBytes(value);
				if (!(bytes.length === width)) {
					throw new Error(`invalid length for ${type}`);
				}

				return hexPadRight(value as Bytes);
			};
		}
	}

	switch (type) {
		case 'address':
			return function (value: string) {
				return zeroPad(getAddress(value), 32);
			};
		case 'bool':
			return function (value: boolean) {
				return !value ? hexFalse : hexTrue;
			};
		case 'bytes':
			return function (value: Bytes) {
				return keccak256(value);
			};
		case 'string':
			return function (value: string) {
				return id(value);
			};
	}

	return null;
}

function encodeType(name: string, fields: Array<TypedDataField>): string {
	return `${name}(${fields.map(({ name, type }) => type + ' ' + name).join(',')})`;
}

type ArrayResult = {
	base: string; // The base type
	index?: string; // the full Index (if any)
	array?: {
		// The Array... (if index)
		base: string; // ...base type (same as above)
		prefix: string; // ...sans the final Index
		count: number; // ...the final Index (-1 for dynamic)
	};
};

// foo[][3] => { base: "foo", index: "[][3]", array: {
//     base: "foo", prefix: "foo[]", count: 3 } }
function splitArray(type: string): ArrayResult {
	const match = type.match(/^([^\x5b]*)((\x5b\d*\x5d)*)(\x5b(\d*)\x5d)$/);
	if (match) {
		return {
			base: match[1],
			index: match[2] + match[4],
			array: {
				base: match[1],
				prefix: match[1] + match[2],
				count: match[5] ? parseInt(match[5]) : -1,
			},
		};
	}

	return { base: type };
}

export class TypedDataEncoder {
	/**
	 *  The primary type for the structured [[types]].
	 *
	 *  This is derived automatically from the [[types]], since no
	 *  recursion is possible, once the DAG for the types is consturcted
	 *  internally, the primary type must be the only remaining type with
	 *  no parent nodes.
	 */
	readonly primaryType!: string;

	readonly #types: string;

	/**
	 *  The types.
	 */
	get types(): Record<string, Array<TypedDataField>> {
		return JSON.parse(this.#types);
	}

	readonly #fullTypes: Map<string, string>;

	readonly #encoderCache: Map<string, (value: any) => string>;

	/**
	 *  Create a new **TypedDataEncoder** for %%types%%.
	 *
	 *  This performs all necessary checking that types are valid and
	 *  do not violate the [[link-eip-712]] structural constraints as
	 *  well as computes the [[primaryType]].
	 */
	constructor(_types: Record<string, Array<TypedDataField>>) {
		this.#fullTypes = new Map();
		this.#encoderCache = new Map();

		// Link struct types to their direct child structs
		const links: Map<string, Set<string>> = new Map();

		// Link structs to structs which contain them as a child
		const parents: Map<string, Array<string>> = new Map();

		// Link all subtypes within a given struct
		const subtypes: Map<string, Set<string>> = new Map();

		const types: Record<string, Array<TypedDataField>> = {};
		Object.keys(_types).forEach(type => {
			types[type] = _types[type].map(({ name, type }) => {
				// Normalize the base type (unless name conflict)
				let { base, index } = splitArray(type);
				if (base === 'int' && !_types['int']) {
					base = 'int256';
				}
				if (base === 'uint' && !_types['uint']) {
					base = 'uint256';
				}

				return { name, type: base + (index || '') };
			});

			links.set(type, new Set());
			parents.set(type, []);
			subtypes.set(type, new Set());
		});
		this.#types = JSON.stringify(types);

		for (const name in types) {
			const uniqueNames: Set<string> = new Set();

			for (const field of types[name]) {
				// Check each field has a unique name
				if (uniqueNames.has(field.name)) {
					throw new Error(
						`duplicate variable name ${JSON.stringify(field.name)} in ${JSON.stringify(name)}`,
					);
				}
				uniqueNames.add(field.name);

				// Get the base type (drop any array specifiers)
				const baseType = splitArray(field.type).base;
				if (baseType === name) {
					throw new Error(`circular type reference to ${JSON.stringify(baseType)}`);
				}

				// Is this a base encoding type?
				const encoder = getBaseEncoder(baseType);
				if (encoder) {
					continue;
				}

				if (!parents.has(baseType)) {
					throw new Error(`unknown type ${JSON.stringify(baseType)}`);
				}

				// Add linkage
				(parents.get(baseType) as Array<string>).push(name);
				(links.get(name) as Set<string>).add(baseType);
			}
		}

		// Deduce the primary type
		const primaryTypes = Array.from(parents.keys()).filter(
			n => (parents.get(n) as Array<string>).length === 0,
		);
		if (primaryTypes.length === 0) {
			throw new Error('missing primary type');
		}
		if (primaryTypes.length !== 1) {
			throw new Error(
				`ambiguous primary types or unused types: ${primaryTypes.map(t => JSON.stringify(t)).join(', ')}`,
			);
		}

		this.primaryType = primaryTypes[0];

		// Check for circular type references
		function checkCircular(type: string, found: Set<string>) {
			if (found.has(type)) {
				throw new Error(`circular type reference to ${JSON.stringify(type)}`);
			}

			found.add(type);

			for (const child of links.get(type) as Set<string>) {
				if (!parents.has(child)) {
					continue;
				}

				// Recursively check children
				checkCircular(child, found);

				// Mark all ancestors as having this decendant
				for (const subtype of found) {
					(subtypes.get(subtype) as Set<string>).add(child);
				}
			}

			found.delete(type);
		}
		checkCircular(this.primaryType, new Set());

		// Compute each fully describe type
		for (const [name, set] of subtypes) {
			const st = Array.from(set);
			st.sort();
			this.#fullTypes.set(
				name,
				encodeType(name, types[name]) + st.map(t => encodeType(t, types[t])).join(''),
			);
		}
	}

	/**
	 *  Returnthe encoder for the specific %%type%%.
	 */
	getEncoder(type: string): (value: any) => string {
		let encoder = this.#encoderCache.get(type);
		if (!encoder) {
			encoder = this.#getEncoder(type);
			this.#encoderCache.set(type, encoder);
		}
		return encoder;
	}

	#getEncoder(type: string): (value: any) => string {
		// Basic encoder type (address, bool, uint256, etc)
		{
			const encoder = getBaseEncoder(type);
			if (encoder) {
				return encoder;
			}
		}

		// Array
		const array = splitArray(type).array;
		if (array) {
			const subtype = array.prefix;
			const subEncoder = this.getEncoder(subtype);
			return (value: Array<any>) => {
				if (!(array.count === -1 || array.count === value.length)) {
					throw new Error(`array length mismatch; expected length ${array.count}`);
				}

				let result = value.map(subEncoder);
				if (this.#fullTypes.has(subtype)) {
					result = result.map(keccak256);
				}

				return keccak256(concat(result));
			};
		}

		// Struct
		const fields = this.types[type];
		if (fields) {
			const encodedType = id(this.#fullTypes.get(type) as string);
			return (value: Record<string, any>) => {
				const values = fields.map(({ name, type }) => {
					const result = this.getEncoder(type)(value[name]);
					if (this.#fullTypes.has(type)) {
						return keccak256(result);
					}
					return result;
				});
				values.unshift(encodedType);
				return concat(values);
			};
		}

		throw new Error(`unknown type: ${JSON.stringify(type)}`);
	}

	/**
	 *  Return the full type for %%name%%.
	 */
	encodeType(name: string): string {
		const result = this.#fullTypes.get(name);
		if (!result) {
			throw new Error(`unknown type: ${JSON.stringify(name)}`);
		}
		return result;
	}

	/**
	 *  Return the encoded %%value%% for the %%type%%.
	 */
	encodeData(type: string, value: any): string {
		return this.getEncoder(type)(value);
	}

	/**
	 *  Returns the hash of %%value%% for the type of %%name%%.
	 */
	hashStruct(name: string, value: Record<string, any>): string {
		return keccak256(this.encodeData(name, value));
	}
	/**
	 *  Return the fulled encoded %%value%% for the [[types]].
	 */
	encode(value: Record<string, any>): string {
		return this.encodeData(this.primaryType, value);
	}

	/**
	 *  Return the hash of the fully encoded %%value%% for the [[types]].
	 */
	hash(value: Record<string, any>): string {
		return this.hashStruct(this.primaryType, value);
	}

	/**
	 *  @_ignore:
	 */
	_visit(type: string, value: any, callback: (type: string, data: any) => any): any {
		// Basic encoder type (address, bool, uint256, etc)
		{
			const encoder = getBaseEncoder(type);
			if (encoder) {
				return callback(type, value);
			}
		}

		// Array
		const array = splitArray(type).array;
		if (array) {
			if (!(array.count === -1 || array.count === value.length)) {
				throw new Error(`array length mismatch; expected length ${array.count}`);
			}
			return value.map((v: any) => this._visit(array.prefix, v, callback));
		}

		// Struct
		const fields = this.types[type];
		if (fields) {
			return fields.reduce(
				(accum, { name, type }) => {
					accum[name] = this._visit(type, value[name], callback);
					return accum;
				},
				<Record<string, any>>{},
			);
		}

		throw new Error(`unknown type: ${JSON.stringify(type)}`);
	}

	/**
	 *  Call %%calback%% for each value in %%value%%, passing the type and
	 *  component within %%value%%.
	 *
	 *  This is useful for replacing addresses or other transformation that
	 *  may be desired on each component, based on its type.
	 */
	visit(value: Record<string, any>, callback: (type: string, data: any) => any): any {
		return this._visit(this.primaryType, value, callback);
	}

	/**
	 *  Create a new **TypedDataEncoder** for %%types%%.
	 */
	static from(types: Record<string, Array<TypedDataField>>): TypedDataEncoder {
		return new TypedDataEncoder(types);
	}

	/**
	 *  Return the primary type for %%types%%.
	 */
	static getPrimaryType(types: Record<string, Array<TypedDataField>>): string {
		return TypedDataEncoder.from(types).primaryType;
	}

	/**
	 *  Return the hashed struct for %%value%% using %%types%% and %%name%%.
	 */
	static hashStruct(
		name: string,
		types: Record<string, Array<TypedDataField>>,
		value: Record<string, any>,
	): string {
		return TypedDataEncoder.from(types).hashStruct(name, value);
	}

	/**
	 *  Return the domain hash for %%domain%%.
	 */
	static hashDomain(domain: TypedDataDomain): string {
		const domainFields: Array<TypedDataField> = [];
		for (const name in domain) {
			if ((<Record<string, any>>domain)[name] == null) {
				continue;
			}
			const type = domainFieldTypes[name];
			if (!type) {
				throw new Error(`invalid typed-data domain key: ${JSON.stringify(name)}`);
			}
			domainFields.push({ name, type });
		}

		domainFields.sort((a, b) => {
			return domainFieldNames.indexOf(a.name) - domainFieldNames.indexOf(b.name);
		});

		return TypedDataEncoder.hashStruct('EIP712Domain', { EIP712Domain: domainFields }, domain);
	}

	/**
	 *  Return the fully encoded [[link-eip-712]] %%value%% for %%types%% with %%domain%%.
	 */
	static encode(
		domain: TypedDataDomain,
		types: Record<string, Array<TypedDataField>>,
		value: Record<string, any>,
	): string {
		return concat([
			'0x1901',
			TypedDataEncoder.hashDomain(domain),
			TypedDataEncoder.from(types).hash(value),
		]);
	}

	/**
	 *  Return the hash of the fully encoded [[link-eip-712]] %%value%% for %%types%% with %%domain%%.
	 */
	static hash(
		domain: TypedDataDomain,
		types: Record<string, Array<TypedDataField>>,
		value: Record<string, any>,
	): string {
		return keccak256(TypedDataEncoder.encode(domain, types, value));
	}

	// Replaces all address types with ENS names with their looked up address
	/**
	 * Resolves to the value from resolving all addresses in %%value%% for
	 * %%types%% and the %%domain%%.
	 */
	static async resolveNames(
		domain: TypedDataDomain,
		types: Record<string, Array<TypedDataField>>,
		value: Record<string, any>,
		resolveName: (name: string) => Promise<string>,
	): Promise<{ domain: TypedDataDomain; value: any }> {
		// Make a copy to isolate it from the object passed in
		domain = Object.assign({}, domain);

		// Allow passing null to ignore value
		for (const key in domain) {
			if ((<Record<string, any>>domain)[key] == null) {
				delete (<Record<string, any>>domain)[key];
			}
		}

		// Look up all ENS names
		const ensCache: Record<string, string> = {};

		// Do we need to look up the domain's verifyingContract?
		if (domain.verifyingContract && !isHexString(domain.verifyingContract, 20)) {
			ensCache[domain.verifyingContract] = '0x';
		}

		// We are going to use the encoder to visit all the base values
		const encoder = TypedDataEncoder.from(types);

		// Get a list of all the addresses
		encoder.visit(value, (type: string, value: any) => {
			if (type === 'address' && !isHexString(value, 20)) {
				ensCache[value] = '0x';
			}
			return value;
		});

		// Lookup each name
		for (const name in ensCache) {
			ensCache[name] = await resolveName(name);
		}

		// Replace the domain verifyingContract if needed
		if (domain.verifyingContract && ensCache[domain.verifyingContract]) {
			domain.verifyingContract = ensCache[domain.verifyingContract];
		}

		// Replace all ENS names with their address
		value = encoder.visit(value, (type: string, value: any) => {
			if (type === 'address' && ensCache[value]) {
				return ensCache[value];
			}
			return value;
		});

		return { domain, value };
	}

	/**
	 *  Returns the JSON-encoded payload expected by nodes which implement
	 *  the JSON-RPC [[link-eip-712]] method.
	 */
	static getPayload(
		domain: TypedDataDomain,
		types: Record<string, Array<TypedDataField>>,
		value: Record<string, any>,
	): any {
		// Validate the domain fields
		TypedDataEncoder.hashDomain(domain);

		// Derive the EIP712Domain Struct reference type
		const domainValues: Record<string, any> = {};
		const domainTypes: Array<{ name: string; type: string }> = [];

		domainFieldNames.forEach(name => {
			const value = (<any>domain)[name];
			if (value == null) {
				return;
			}
			domainValues[name] = domainChecks[name](value);
			domainTypes.push({ name, type: domainFieldTypes[name] });
		});

		const encoder = TypedDataEncoder.from(types);

		// Get the normalized types
		types = encoder.types;

		const typesWithDomain = Object.assign({}, types);
		if (typesWithDomain.EIP712Domain != null) {
			throw new Error('types must not contain EIP712Domain type');
		}

		typesWithDomain.EIP712Domain = domainTypes;

		// Validate the data structures and types
		encoder.encode(value);

		return {
			types: typesWithDomain,
			domain: domainValues,
			primaryType: encoder.primaryType,
			message: encoder.visit(value, (type: string, value: any) => {
				// bytes
				if (type.match(/^bytes(\d*)/)) {
					return toHex(value);
				}

				// uint or int
				if (type.match(/^u?int/)) {
					return toBigInt(value).toString();
				}

				switch (type) {
					case 'address':
						return value.toLowerCase();
					case 'bool':
						return !!value;
					case 'string':
						if (typeof value !== 'string') {
							throw new Error('invalid string');
						}
						return value;
				}

				throw new Error(`unsupported type: ${type}`);
			}),
		};
	}
}
