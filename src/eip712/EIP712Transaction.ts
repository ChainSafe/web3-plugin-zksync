/*
This file is part of web3.js.

web3.js is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

web3.js is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/
import type { Bytes } from 'web3-types';
import { RLP } from '@ethereumjs/rlp';
import { keccak256 } from 'ethereum-cryptography/keccak.js';
import {
	bytesToHex,
	bytesToUint8Array,
	hexToBytes,
	toBigInt,
	toChecksumAddress,
	toHex,
	uint8ArrayConcat,
} from 'web3-utils';
import { validateNoLeadingZeroes } from 'web3-validator';
import {
	bigIntToHex,
	bigIntToUnpaddedUint8Array,
	ecrecover,
	toUint8Array,
	uint8ArrayToBigInt,
	BaseTransaction,
	Capability,
} from 'web3-eth-accounts';
import type { Common, JsonTx, TxOptions, TxValuesArray } from 'web3-eth-accounts';
import { DEFAULT_GAS_PER_PUBDATA_LIMIT, ZERO_ADDRESS } from '../constants';
import { concat, hashBytecode, toBytes } from '../utils';
import type { Address } from '../types';
import { MAX_INTEGER } from './constants';
import type { Eip712TxData, TypedDataDomain, Eip712Meta } from './types';

export const EIP712_TX_TYPE = 113; // 0x71
const EIP712_TX_TYPE_UINT8ARRAY = hexToBytes(EIP712_TX_TYPE.toString(16).padStart(2, '0'));

function meetsEIP155(_v: bigint, chainId: bigint) {
	const v = Number(_v);
	const chainIdDoubled = Number(chainId) * 2;
	return v === chainIdDoubled + 35 || v === chainIdDoubled + 36;
}

/**
 *  Class to create the EIP-712 Transaction object.
 * - TransactionType: 113
 * - EIP: [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
 */

export class EIP712Transaction extends BaseTransaction<EIP712Transaction> {
	private txData: Eip712TxData;
	public readonly chainId?: bigint;
	public readonly gasPrice: bigint;
	public eip712Domain: TypedDataDomain;

	public readonly common: Common;

	/**
	 * Instantiate a transaction from a data dictionary.
	 *
	 * Format: { nonce, gasPrice, gasLimit, to, value, data, v, r, s }
	 *
	 * Notes:
	 * - All parameters are optional and have some basic default values
	 */
	public static fromTxData(txData: Eip712TxData, opts: TxOptions = {}) {
		return new EIP712Transaction(txData, opts);
	}

	/**
	 * Instantiate a transaction from the serialized tx.
	 *
	 * Format: `rlp([nonce, gasPrice, gasLimit, to, value, data, v, r, s])`
	 */
	public static fromSerializedTx(serialized: Uint8Array, opts: TxOptions = {}) {
		const values = RLP.decode(serialized);

		if (!Array.isArray(values)) {
			throw new Error('Invalid serialized tx input. Must be array');
		}

		return this.fromValuesArray(values as Uint8Array[], opts);
	}

	/**
	 * Create a transaction from a values array.
	 *
	 * Format: `[nonce, gasPrice, gasLimit, to, value, data, v, r, s]`
	 */
	public static fromValuesArray(values: TxValuesArray, opts: TxOptions = {}) {
		// If length is not 6, it has length 9. If v/r/s are empty Uint8Array, it is still an unsigned transaction
		// This happens if you get the RLP data from `raw()`
		if (values.length !== 6 && values.length !== 9) {
			throw new Error(
				'Invalid transaction. Only expecting 6 values (for unsigned tx) or 9 values (for signed tx).',
			);
		}

		const [nonce, gasPrice, gasLimit, to, value, data, v, r, s] = values;

		validateNoLeadingZeroes({ nonce, gasPrice, gasLimit, value, v, r, s });

		return new EIP712Transaction(
			{
				nonce,
				// @ts-ignore
				gasPrice,
				gasLimit,
				to,
				value,
				data,
				v,
				r,
				s,
			},
			opts,
		);
	}

	/**
	 * This constructor takes the values, validates them, assigns them and freezes the object.
	 *
	 * It is not recommended to use this constructor directly. Instead use
	 * the static factory methods to assist in creating a Transaction object from
	 * varying data types.
	 */
	public constructor(txData: Eip712TxData, opts: TxOptions = {}) {
		super({ ...txData, type: EIP712_TX_TYPE }, opts);

		this.txData = EIP712Transaction.getSignInput(txData);
		this.eip712Domain = {
			name: 'zkSync',
			version: '2',
			chainId: txData.chainId,
		};
		this.common = this._validateTxV(this.v, opts.common);
		console.log('txData', txData);
		this.chainId = txData.chainId ? toBigInt(txData.chainId) : undefined;
		console.log('this.chainId', this.chainId);
		this.gasPrice = uint8ArrayToBigInt(
			// @ts-ignore
			toUint8Array(txData.gasPrice === '' ? '0x' : txData.gasPrice),
		);

		if (this.gasPrice * this.gasLimit > MAX_INTEGER) {
			const msg = this._errorMsg('gas limit * gasPrice cannot exceed MAX_INTEGER (2^256-1)');
			throw new Error(msg);
		}
		this._validateCannotExceedMaxInteger({ gasPrice: this.gasPrice });
		BaseTransaction._validateNotArray(txData);

		if (this.common.gteHardfork('spuriousDragon')) {
			if (!this.isSigned()) {
				this.activeCapabilities.push(Capability.EIP155ReplayProtection);
			} else {
				// EIP155 spec:
				// If block.number >= 2,675,000 and v = CHAIN_ID * 2 + 35 or v = CHAIN_ID * 2 + 36
				// then when computing the hash of a transaction for purposes of signing or recovering
				// instead of hashing only the first six elements (i.e. nonce, gasprice, startgas, to, value, data)
				// hash nine elements, with v replaced by CHAIN_ID, r = 0 and s = 0.
				// v and chain ID meet EIP-155 conditions

				if (meetsEIP155(this.v!, this.common.chainId())) {
					this.activeCapabilities.push(Capability.EIP155ReplayProtection);
				}
			}
		}

		const freeze = opts?.freeze ?? true;
		if (freeze) {
			Object.freeze(this);
		}
	}

	/**
	 * Generates the EIP712 typed data from provided transaction. Optional fields are populated by zero values.
	 *
	 * @param transaction The transaction request that needs to be populated.
	 *
	 * @example
	 *
	 * const tx = EIP712Signer.getSignInput({
	 *   type: utils.EIP712_TX_TYPE,
	 *   to: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
	 *   value: BigInt(7_000_000),
	 *   from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
	 *   nonce: 0,
	 *   chainId: BigInt(270),
	 *   gasPrice: BigInt(250_000_000),
	 *   gasLimit: BigInt(21_000),
	 *   customData: {},
	 * });
	 */
	static getSignInput(transaction: Eip712TxData) {
		const maxFeePerGas = toBigInt(transaction.maxFeePerGas || transaction.gasPrice || 0n);
		const maxPriorityFeePerGas = toBigInt(transaction.maxPriorityFeePerGas || maxFeePerGas);
		const gasPerPubdataByteLimit = toBigInt(
			transaction.customData?.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT,
		);
		return {
			txType: transaction.type || EIP712_TX_TYPE,
			from: transaction.from ? toHex(transaction.from) : undefined,
			to: transaction.to ? toHex(transaction.to) : undefined,
			gasLimit: transaction.gasLimit || 0n,
			gasPerPubdataByteLimit: gasPerPubdataByteLimit,
			customData: transaction.customData,
			maxFeePerGas,
			maxPriorityFeePerGas,
			paymaster: transaction.customData?.paymasterParams?.paymaster || ZERO_ADDRESS,
			nonce: transaction.nonce || 0,
			value: transaction.value || BigInt(0),
			data: transaction.data || '0x',
			factoryDeps:
				transaction.customData?.factoryDeps?.map((dep: Bytes) => hashBytecode(dep)) || [],
			paymasterInput: transaction.customData?.paymasterParams?.paymasterInput || '0x',
		};
	}

	/**
	 * Returns a Uint8Array Array of the raw Uint8Arrays of the legacy transaction, in order.
	 *
	 * Format: `[nonce, gasPrice, gasLimit, to, value, data, v, r, s]`
	 *
	 * For legacy txs this is also the correct format to add transactions
	 * to a block with {@link Block.fromValuesArray} (use the `serialize()` method
	 * for typed txs).
	 *
	 * For an unsigned tx this method returns the empty Uint8Array values
	 * for the signature parameters `v`, `r` and `s`. For an EIP-155 compliant
	 * representation have a look at {@link Transaction.getMessageToSign}.
	 */
	public raw(): TxValuesArray {
		const transaction = this.txData;
		console.log('raw', this.chainId);
		if (!this.chainId) {
			throw Error("Transaction chainId isn't set!");
		}

		if (!transaction.from) {
			throw new Error(
				'Explicitly providing `from` field is required for EIP712 transactions!',
			);
		}
		const from = transaction.from;
		const meta: Eip712Meta = transaction.customData ?? {};
		// const maxFeePerGas = transaction.maxFeePerGas || transaction.gasPrice || 0;
		// const maxPriorityFeePerGas = transaction.maxPriorityFeePerGas || maxFeePerGas;
		console.log('transaction', transaction);
		console.log('1');
		console.log('toBytes(transaction.nonce || 0)', toBytes('0x0'));
		console.log('2');

		const fields: any[] = [
			toBytes(transaction.nonce || 0),
			// toBytes(maxPriorityFeePerGas),
			// toBytes(maxFeePerGas),
			toBytes(transaction.gasLimit || 0),
			transaction.to ? toChecksumAddress(transaction.to as Address) : '0x',
			toBytes(transaction.value || 0),
			transaction.data || '0x',
		];
		console.log('fields', fields);

		// if (signature) {
		//     const sig = new SignatureObject(signature);
		fields.push(
			this.v !== undefined ? bigIntToUnpaddedUint8Array(this.v) : Uint8Array.from([]),
		);
		fields.push(
			this.r !== undefined ? bigIntToUnpaddedUint8Array(this.r) : Uint8Array.from([]),
		);
		fields.push(
			this.s !== undefined ? bigIntToUnpaddedUint8Array(this.s) : Uint8Array.from([]),
		);
		// } else {
		//     fields.push(toBytes(transaction.chainId));
		//     fields.push("0x");
		//     fields.push("0x");
		// }
		console.log('this.chainId', this.chainId);
		fields.push(toBytes(this.chainId));
		fields.push(toChecksumAddress(from));

		// Add meta
		console.log('meta', meta);
		fields.push(toBytes(meta.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT));
		fields.push((meta.factoryDeps ?? []).map(dep => toHex(dep)));
		if (meta.customSignature && bytesToUint8Array(meta.customSignature).length === 0) {
			throw new Error('Empty signatures are not supported!');
		}
		fields.push(meta.customSignature || '0x');

		if (meta.paymasterParams) {
			fields.push([
				meta.paymasterParams.paymaster,
				toHex(meta.paymasterParams.paymasterInput),
			]);
		} else {
			fields.push([]);
		}
		return fields;
	}

	/**
	 * Serializes an EIP712 transaction and includes a signature if provided.
	 *
	 * @param transaction The transaction that needs to be serialized.
	 * @param signature Ethers signature to be included in the transaction.
	 * @throws {Error} Throws an error if:
	 * - `transaction.customData.customSignature` is an empty string. The transaction should be signed, and the `transaction.customData.customSignature` field should be populated with the signature. It should not be specified if the transaction is not signed.
	 * - `transaction.chainId` is not provided.
	 * - `transaction.from` is not provided.
	 *
	 * @example Serialize EIP712 transaction without signature.
	 *
	 * const serializedTx = utils.serializeEip712({ chainId: 270, from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049" }, null);
	 *
	 * // serializedTx = "0x71ea8080808080808082010e808082010e9436615cf349d7f6344891b1e7ca7c72883f5dc04982c350c080c0"
	 *
	 * @example Serialize EIP712 transaction with signature.
	 *
	 * const signature = ethers.Signature.from("0x73a20167b8d23b610b058c05368174495adf7da3a4ed4a57eb6dbdeb1fafc24aaf87530d663a0d061f69bb564d2c6fb46ae5ae776bbd4bd2a2a4478b9cd1b42a");
	 *
	 * const serializedTx = utils.serializeEip712(
	 *   {
	 *     chainId: 270,
	 *     from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
	 *     to: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
	 *     value: 1_000_000,
	 *   },
	 *   signature
	 * );
	 * // serializedTx = "0x71f87f8080808094a61464658afeaf65cccaafd3a512b69a83b77618830f42408001a073a20167b8d23b610b058c05368174495adf7da3a4ed4a57eb6dbdeb1fafc24aa02f87530d663a0d061f69bb564d2c6fb46ae5ae776bbd4bd2a2a4478b9cd1b42a82010e9436615cf349d7f6344891b1e7ca7c72883f5dc04982c350c080c0"
	 */
	// @ts-ignore
	serialize() {
		return concat([new Uint8Array([EIP712_TX_TYPE]), RLP.encode(this.raw())]);
	}

	/**
	 * Returns the unsigned tx (hashed or raw), which can be used
	 * to sign the transaction (e.g. for sending to a hardware wallet).
	 *
	 * Note: the raw message message format for the legacy tx is not RLP encoded
	 * and you might need to do yourself with:
	 *
	 * ```javascript
	 * import { bufArrToArr } from '../util'
	 * import { RLP } from '../rlp'
	 * const message = tx.getMessageToSign(false)
	 * const serializedMessage = RLP.encode(message) // use this for the HW wallet input
	 * ```
	 *
	 * @param hashMessage - Return hashed message if set to true (default: true)
	 */
	public getMessageToSign(hashMessage = true) {
		const base = this.raw().slice(0, 9);
		const message = uint8ArrayConcat(EIP712_TX_TYPE_UINT8ARRAY, RLP.encode(base));
		if (hashMessage) {
			return keccak256(message);
		}
		return message;
	}

	/**
	 * The amount of gas paid for the data in this tx
	 */
	public getDataFee(): bigint {
		// TODO: this is a temporary solution until we have a better way to calculate the data fee
		if (this.cache.dataFee && this.cache.dataFee.hardfork === this.common.hardfork()) {
			return this.cache.dataFee.value;
		}

		if (Object.isFrozen(this)) {
			this.cache.dataFee = {
				value: super.getDataFee(),
				hardfork: this.common.hardfork(),
			};
		}

		return super.getDataFee();
	}

	/**
	 * The up front amount that an account must have for this transaction to be valid
	 */
	public getUpfrontCost(): bigint {
		// TODO: this is a temporary solution until we have a better way to calculate the upfront cost
		return this.gasLimit * this.gasPrice + this.value;
	}

	/**
	 * Computes a sha3-256 hash of the serialized tx.
	 *
	 * This method can only be used for signed txs (it throws otherwise).
	 * Use {@link Transaction.getMessageToSign} to get a tx hash for the purpose of signing.
	 */
	public hash(): Uint8Array {
		if (!this.isSigned()) {
			const msg = this._errorMsg('Cannot call hash method if transaction is not signed');
			throw new Error(msg);
		}

		if (Object.isFrozen(this)) {
			if (!this.cache.hash) {
				this.cache.hash = keccak256(RLP.encode(this.raw()));
			}
			return this.cache.hash;
		}

		return keccak256(RLP.encode(this.raw()));
	}

	/**
	 * Computes a sha3-256 hash which can be used to verify the signature
	 */

	public getMessageToVerifySignature(): Uint8Array {
		if (!this.isSigned()) {
			const msg = this._errorMsg('This transaction is not signed');
			throw new Error(msg);
		}
		return this.getMessageToSign();
	}

	/**
	 * Returns the public key of the sender
	 */
	public getSenderPublicKey(): Uint8Array {
		if (!this.isSigned()) {
			const msg = this._errorMsg('Cannot call this method if transaction is not signed');
			throw new Error(msg);
		}

		const msgHash = this.getMessageToVerifySignature();
		const { v, r, s } = this;

		this._validateHighS();

		try {
			return ecrecover(
				msgHash,
				v! + BigInt(27), // Recover the 27 which was stripped from ecsign
				bigIntToUnpaddedUint8Array(r!),
				bigIntToUnpaddedUint8Array(s!),
			);
		} catch (e: any) {
			const msg = this._errorMsg('Invalid Signature');
			throw new Error(msg);
		}
	}

	/**
	 * Process the v, r, s values from the `sign` method of the base transaction.
	 */
	protected _processSignature(_v: bigint, r: Uint8Array, s: Uint8Array) {
		let v = _v;
		if (this.supports(Capability.EIP155ReplayProtection)) {
			v += this.common.chainId() * BigInt(2) + BigInt(8);
		}

		const opts = { ...this.txOptions, common: this.common };

		return EIP712Transaction.fromTxData(
			{
				chainId: this.chainId,
				nonce: this.nonce,
				gasLimit: this.gasLimit,
				to: this.to,
				value: this.value,
				data: this.data,
				v: v - BigInt(27), // This looks extremely hacky: /util actually adds 27 to the value, the recovery bit is either 0 or 1.
				r: uint8ArrayToBigInt(r),
				s: uint8ArrayToBigInt(s),
			},
			opts,
		);
	}

	/**
	 * Returns an object with the JSON representation of the transaction.
	 */
	public toJSON(): JsonTx {
		return {
			nonce: bigIntToHex(this.nonce),
			gasPrice: bigIntToHex(this.gasPrice),
			gasLimit: bigIntToHex(this.gasLimit),
			to: this.to !== undefined ? this.to.toString() : undefined,
			value: bigIntToHex(this.value),
			data: bytesToHex(this.data),
			v: this.v !== undefined ? bigIntToHex(this.v) : undefined,
			r: this.r !== undefined ? bigIntToHex(this.r) : undefined,
			s: this.s !== undefined ? bigIntToHex(this.s) : undefined,
		};
	}

	/**
	 * Validates tx's `v` value
	 */
	private _validateTxV(_v?: bigint, common?: Common): Common {
		let chainIdBigInt;
		const v = _v !== undefined ? Number(_v) : undefined;
		// Check for valid v values in the scope of a signed legacy tx
		if (v !== undefined) {
			// v is 1. not matching the EIP-155 chainId included case and...
			// v is 2. not matching the classic v=27 or v=28 case
			if (v < 37 && v !== 27 && v !== 28) {
				throw new Error(
					`Legacy txs need either v = 27/28 or v >= 37 (EIP-155 replay protection), got v = ${v}`,
				);
			}
		}

		// No unsigned tx and EIP-155 activated and chain ID included
		if (
			v !== undefined &&
			v !== 0 &&
			(!common || common.gteHardfork('spuriousDragon')) &&
			v !== 27 &&
			v !== 28
		) {
			if (common) {
				if (!meetsEIP155(BigInt(v), common.chainId())) {
					throw new Error(
						`Incompatible EIP155-based V ${v} and chain id ${common.chainId()}. See the Common parameter of the Transaction constructor to set the chain id.`,
					);
				}
			} else {
				// Derive the original chain ID
				let numSub;
				if ((v - 35) % 2 === 0) {
					numSub = 35;
				} else {
					numSub = 36;
				}
				// Use derived chain ID to create a proper Common
				chainIdBigInt = BigInt(v - numSub) / BigInt(2);
			}
		}
		return this._getCommon(common, chainIdBigInt);
	}

	/**
	 * Return a compact error string representation of the object
	 */
	public errorStr() {
		let errorStr = this._getSharedErrorPostfix();
		errorStr += ` gasPrice=${this.gasPrice}`;
		return errorStr;
	}

	/**
	 * Internal helper function to create an annotated error message
	 *
	 * @param msg Base error message
	 * @hidden
	 */
	protected _errorMsg(msg: string) {
		return `${msg} (${this.errorStr()})`;
	}
}
