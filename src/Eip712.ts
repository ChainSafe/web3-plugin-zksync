import { bytesToHex, toBigInt, toHex } from 'web3-utils';
import type { Bytes, Eip712TypedData } from 'web3-types';
import * as web3Abi from 'web3-eth-abi';
import * as web3Utils from 'web3-utils';
import type * as web3Accounts from 'web3-eth-accounts';
import { bigIntToUint8Array, signMessageWithPrivateKey } from 'web3-eth-accounts';
import { RLP } from '@ethereumjs/rlp';
import type { Address } from 'web3';
import {
	DEFAULT_GAS_PER_PUBDATA_LIMIT,
	EIP712_TX_TYPE,
	EIP712_TYPES,
	ZERO_ADDRESS,
} from './constants';
import type {
	Eip712Meta,
	Eip712SignedInput,
	Eip712TxData,
	EthereumSignature,
	PaymasterParams,
} from './types';
import { SignatureLike } from './utils';
import { concat, hashBytecode, SignatureObject, toBytes } from './utils';

function handleAddress(value?: Uint8Array): string | null {
	if (!value) {
		return null;
	}
	const hexValue = bytesToHex(value);
	if (hexValue === '0x') {
		return null;
	}

	return web3Utils.toChecksumAddress(hexValue);
}

function handleNumber(value?: Uint8Array): bigint {
	if (!value) {
		return 0n;
	}
	const hexValue = bytesToHex(value);
	if (hexValue === '0x') {
		return 0n;
	}
	return toBigInt(hexValue);
}
function arrayToPaymasterParams(arr: Uint8Array): PaymasterParams | undefined {
	if (arr.length === 0) {
		return undefined;
	}
	if (arr.length !== 2) {
		throw new Error(
			`Invalid paymaster parameters, expected to have length of 2, found ${arr.length}!`,
		);
	}

	return {
		paymaster: web3Utils.toChecksumAddress(toHex(arr[0])),
		paymasterInput: web3Utils.bytesToUint8Array(toHex(arr[1])),
	};
}

export class EIP712 {
	static getSignInput(transaction: Eip712TxData): Eip712SignedInput {
		const maxFeePerGas = toBigInt(transaction.maxFeePerGas || transaction.gasPrice || 0n);
		const maxPriorityFeePerGas = toBigInt(transaction.maxPriorityFeePerGas || maxFeePerGas);
		const gasPerPubdataByteLimit =
			transaction.customData?.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT;
		return {
			txType: transaction.type || EIP712_TX_TYPE,
			from: transaction.from
				? typeof transaction.from === 'string'
					? transaction.from
					: toHex(transaction.from)
				: undefined,
			to: transaction.to
				? typeof transaction.to === 'string'
					? transaction.to
					: toHex(transaction.to)
				: undefined,
			gasLimit: transaction.gasLimit ? toBigInt(transaction.gasLimit) : 0n,
			gasPerPubdataByteLimit: gasPerPubdataByteLimit,
			maxFeePerGas,
			maxPriorityFeePerGas,
			paymaster: transaction.customData?.paymasterParams?.paymaster || ZERO_ADDRESS,
			nonce: transaction.nonce ? toBigInt(transaction.nonce) : 0,
			value: transaction.value ? toBigInt(transaction.value) : 0n,
			data: transaction.data ? toHex(transaction.data) : '0x',
			factoryDeps:
				transaction.customData?.factoryDeps?.map((dep: Bytes) => hashBytecode(dep)) || [],
			paymasterInput: transaction.customData?.paymasterParams?.paymasterInput || '0x',
		};
	}

	static txTypedData(transaction: Eip712TxData): Eip712TypedData {
		const signInput = EIP712.getSignInput(transaction);
		return {
			types: EIP712_TYPES,
			primaryType: 'Transaction',
			domain: {
				name: 'zkSync',
				version: '2',
				chainId: Number(transaction.chainId),
			},
			message: signInput,
		};
	}
	/**
	 * Returns the hash of an EIP712 transaction.
	 *
	 * @param transaction The EIP-712 transaction.
	 * @param ethSignature The ECDSA signature of the transaction.
	 *
	 * @example
	 *
	 *
	 */
	static txHash(transaction: Eip712TxData, ethSignature?: EthereumSignature): string {
		const bytes: string[] = [];

		const typedDataStruct = EIP712.txTypedData(transaction);

		bytes.push(web3Abi.getEncodedEip712Data(typedDataStruct, true));
		bytes.push(web3Utils.keccak256(EIP712.getSignature(typedDataStruct.message, ethSignature)));
		return web3Utils.keccak256(concat(bytes));
	}
	/**
	 * Parses an EIP712 transaction from a payload.
	 *
	 * @param payload The payload to parse.
	 *
	 * @example
	 *
	 *
	 * const serializedTx =
	 *   "0x71f87f8080808094a61464658afeaf65cccaafd3a512b69a83b77618830f42408001a073a20167b8d23b610b058c05368174495adf7da3a4ed4a57eb6dbdeb1fafc24aa02f87530d663a0d061f69bb564d2c6fb46ae5ae776bbd4bd2a2a4478b9cd1b42a82010e9436615cf349d7f6344891b1e7ca7c72883f5dc04982c350c080c0";
	 * const tx: types.TransactionLike = utils.parse(serializedTx);
	 * /*
	 * tx: types.Eip712TxData = {
	 *   type: 113,
	 *   nonce: 0,
	 *   maxPriorityFeePerGas: BigInt(0),
	 *   maxFeePerGas: BigInt(0),
	 *   gasLimit: BigInt(0),
	 *   to: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
	 *   value: BigInt(1000000),
	 *   data: "0x",
	 *   chainId: BigInt(270),
	 *   from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
	 *   customData: {
	 *     gasPerPubdata: BigInt(50000),
	 *     factoryDeps: [],
	 *     customSignature: "0x",
	 *     paymasterParams: null,
	 *   },
	 *   hash: "0x9ed410ce33179ac1ff6b721060605afc72d64febfe0c08cacab5a246602131ee",
	 * };
	 * *\/
	 */

	static fromSerializedTx(payload: Bytes): Eip712TxData {
		const bytes = web3Utils.bytesToUint8Array(payload);

		const raw = RLP.decode(bytes.slice(1)) as Array<Uint8Array>;
		const transaction: Eip712TxData = {
			type: EIP712_TX_TYPE,
			nonce: handleNumber(raw[0]),
			maxPriorityFeePerGas: handleNumber(raw[1]),
			maxFeePerGas: handleNumber(raw[2]),
			gasLimit: handleNumber(raw[3]),
			to: handleAddress(raw[4]) as Address,
			value: handleNumber(raw[5]),
			data: bytesToHex(raw[6]),
			chainId: handleNumber(raw[10]),
			from: handleAddress(raw[11]) as Address,
			customData: {
				gasPerPubdata: handleNumber(raw[12]),
				factoryDeps: raw[13] as unknown as string[],
				customSignature: bytesToHex(raw[14]),
				paymasterParams: arrayToPaymasterParams(raw[15]),
			},
		};
		const ethSignature = {
			v: Number(handleNumber(raw[7])),
			r: raw[8],
			s: raw[9],
		};

		if (
			(web3Utils.toHex(ethSignature.r) === '0x' ||
				web3Utils.toHex(ethSignature.s) === '0x') &&
			!transaction.customData?.customSignature
		) {
			return transaction;
		}

		if (
			ethSignature.v !== 0 &&
			ethSignature.v !== 1 &&
			!transaction.customData?.customSignature
		) {
			throw new Error('Failed to parse signature!');
		}

		if (!transaction.customData?.customSignature) {
			transaction.signature = new SignatureObject(ethSignature).toString();
		}

		transaction.hash = EIP712.txHash(transaction, ethSignature);

		return transaction;
	}

	static getSignature(transaction: Eip712TxData, ethSignature?: EthereumSignature): Uint8Array {
		if (
			transaction?.customData?.customSignature &&
			transaction.customData.customSignature.length
		) {
			return web3Utils.bytesToUint8Array(transaction.customData.customSignature);
		}

		if (!ethSignature) {
			throw new Error('No signature provided!');
		}

		const r = web3Utils.bytesToUint8Array(
			web3Utils.padLeft(web3Utils.toHex(ethSignature.r), 32 * 2),
		);
		const s = web3Utils.bytesToUint8Array(
			web3Utils.padLeft(web3Utils.toHex(ethSignature.s), 32 * 2),
		);
		const v = ethSignature.v;

		return new Uint8Array([...r, ...s, v]);
	}
	static raw(transaction: Eip712TxData, signature?: SignatureLike) {
		if (!transaction.chainId) {
			throw Error("Transaction chainId isn't set!");
		}

		if (!transaction.from) {
			throw new Error(
				'Explicitly providing `from` field is required for EIP712 transactions!',
			);
		}
		const from = transaction.from;
		const meta: Eip712Meta = transaction.customData ?? {};
		const maxFeePerGas = toHex(transaction.maxFeePerGas || transaction.gasPrice || 0);
		const maxPriorityFeePerGas = toHex(transaction.maxPriorityFeePerGas || maxFeePerGas);

		let gasLimitBytes = new Uint8Array();
		if (transaction.gasLimit && toHex(transaction.gasLimit) !== '0x0') {
			gasLimitBytes = toBytes(transaction.gasLimit);
		}

		const nonce = toBigInt(transaction.nonce || 0);
		const fields: Array<Uint8Array | Uint8Array[] | string | number | string[]> = [
			nonce === 0n ? new Uint8Array() : bigIntToUint8Array(nonce),
			!maxPriorityFeePerGas || maxPriorityFeePerGas === '0x0'
				? new Uint8Array()
				: toBytes(maxPriorityFeePerGas),
			!maxFeePerGas || maxFeePerGas === '0x0' ? new Uint8Array() : toBytes(maxFeePerGas),
			gasLimitBytes,
			transaction.to ? web3Utils.toChecksumAddress(toHex(transaction.to)) : '0x',
			toHex(transaction.value || 0) === '0x0'
				? new Uint8Array()
				: toHex(transaction.value || 0),
			toHex(transaction.data || '0x'),
		];

		if (signature) {
			const signatureObject = new SignatureObject(signature);
			fields.push(toHex(Number(signatureObject.v) === 27 ? 0 : 1));
			fields.push(toHex(signatureObject.r));
			fields.push(toHex(signatureObject.s));
		} else {
			fields.push(toHex(transaction.chainId));
			fields.push('0x');
			fields.push('0x');
		}
		fields.push(toHex(transaction.chainId));
		fields.push(web3Utils.toChecksumAddress(from));

		// Add meta
		fields.push(toHex(meta.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT));
		fields.push((meta.factoryDeps ?? []).map(dep => web3Utils.toHex(dep)));

		if (
			meta.customSignature &&
			web3Utils.bytesToUint8Array(meta.customSignature).length === 0
		) {
			throw new Error('Empty signatures are not supported!');
		}
		fields.push(meta.customSignature || '0x');

		if (meta.paymasterParams) {
			fields.push([
				meta.paymasterParams.paymaster,
				web3Utils.toHex(meta.paymasterParams.paymasterInput),
			]);
		} else {
			fields.push([]);
		}
		return fields;
	}
	static serialize(transaction: Eip712TxData, signature?: SignatureLike): string {
		const fields = EIP712.raw(transaction, signature);
		return concat([new Uint8Array([EIP712_TX_TYPE]), RLP.encode(fields)]);
	}

	static sign(hash: string, privateKey: string) {
		return signMessageWithPrivateKey(web3Utils.keccak256(hash), privateKey);
	}
}

export class EIP712Signer {
	private eip712Domain: Eip712TypedData['domain'];
	private web3Account: web3Accounts.Web3Account;
	private chainId: number;
	constructor(web3Account: web3Accounts.Web3Account, chainId: number) {
		this.web3Account = web3Account;
		this.chainId = Number(web3Utils.toNumber(chainId));
		this.eip712Domain = {
			name: 'zkSync',
			version: '2',
			chainId: Number(this.chainId),
		};
	}

	async sign(tx: Eip712TxData): Promise<string> {
		const hash = web3Abi.getEncodedEip712Data(EIP712.txTypedData(tx), true);
		return signMessageWithPrivateKey(hash, this.web3Account.privateKey).signature;
	}

	/**
	 * Hashes the transaction request using EIP712.
	 *
	 * @param transaction The transaction request that needs to be hashed.
	 * @returns A hash (digest) of the transaction request.
	 *
	 * @throws {Error} If `transaction.chainId` is not set.
	 */
	static getSignedDigest(transaction: Eip712TxData): Bytes {
		if (!transaction.chainId) {
			throw Error("Transaction chainId isn't set!");
		}

		return web3Abi.getEncodedEip712Data(EIP712.txTypedData(transaction), true);
	}

	/**
	 * Returns ZKsync Era EIP712 domain.
	 */
	getDomain(): Eip712TypedData['domain'] {
		return this.eip712Domain;
	}
}
// export class EIP712Transaction extends BaseTransaction<EIP712Transaction> {
// 	private txData: Eip712TxData;
// 	private signature?: SignatureObject;
// 	constructor(txData: Eip712TxData) {
// 		super(txData, {} as web3Accounts.TxOptions);
// 		const { v, r, s, ...data } = txData;
//
// 		if (r && s) {
// 			this.signature = new SignatureObject(toUint8Array(r), toUint8Array(s), toBigInt(v));
// 		}
//
// 		this.txData = data;
// 	}
// 	public getSignature(): SignatureObject | undefined {
// 		return this.signature;
// 	}
// 	public getMessageToSign(isHash = false): Uint8Array {
// 		const typedDataStruct = EIP712.txTypedData(this.txData);
// 		const message = web3Abi.getEncodedEip712Data(typedDataStruct, isHash);
// 		return web3Utils.hexToBytes(message);
// 	}
// 	_processSignature(
// 		v: Numbers,
// 		r: EthereumSignature['r'],
// 		s: EthereumSignature['s'],
// 	): EIP712Transaction {
// 		const signature = new SignatureObject(toUint8Array(r), toUint8Array(s), toBigInt(v));
// 		return new EIP712Transaction({
// 			...this.txData,
// 			v: toBigInt(signature.v),
// 			r: toHex(signature.r),
// 			s: toHex(signature.s),
// 		});
// 	}
// 	public ecsign(msgHash: Uint8Array, privateKey: Uint8Array, chainId?: bigint) {
// 		const { s, r, v } = this._ecsign(msgHash, privateKey, chainId);
// 		this.signature = new SignatureObject(toUint8Array(r), toUint8Array(s), toBigInt(v));
// 		return this.signature;
// 	}
//
// 	protected _errorMsg(msg: string): string {
// 		return `${msg} (${this.errorStr()})`;
// 	}
//
// 	public static fromTxData(txData: Eip712TxData, _ = {}) {
// 		return new EIP712Transaction(txData);
// 	}
//
// 	errorStr(): string {
// 		return '';
// 	}
//
// 	getMessageToVerifySignature(): Uint8Array {
// 		return this.getMessageToSign();
// 	}
//
// 	getSenderPublicKey(): Uint8Array {
// 		// @TODO: implement recover transaction here
// 		return new Uint8Array();
// 	}
//
// 	getUpfrontCost(): bigint {
// 		return 0n;
// 	}
//
// 	hash(): Uint8Array {
// 		return toUint8Array(EIP712.txHash(this.txData));
// 	}
// 	raw(): web3Accounts.TxValuesArray {
// 		return EIP712.raw(this.txData) as unknown as web3Accounts.TxValuesArray;
// 	}
//
// 	serialize(): Uint8Array {
// 		return toUint8Array(EIP712.serialize(this.txData));
// 	}
//
// 	toJSON(): web3Accounts.JsonTx {
// 		const data = EIP712.getSignInput(this.txData);
// 		return {
// 			to: data.to && toHex(data.to),
// 			gasLimit: toHex(data.gasLimit),
// 			// @ts-ignore-next-line
// 			gasPerPubdataByteLimit: data.gasPerPubdataByteLimit,
// 			customData: data.customData,
// 			maxFeePerGas: toHex(data.maxFeePerGas),
// 			maxPriorityFeePerGas: toHex(data.maxPriorityFeePerGas),
// 			paymaster: data.paymaster,
// 			nonce: toHex(data.nonce),
// 			value: toHex(data.value),
// 			data: toHex(data.data),
// 			factoryDeps: data.factoryDeps,
// 			paymasterInput: data.paymasterInput,
// 			type: toHex(data.txType),
// 			v: this.signature?.v ? toHex(this.signature.v) : undefined,
// 			r: this.signature?.r ? toHex(this.signature?.r) : undefined,
// 			s: this.signature?.s ? toHex(this.signature?.s) : undefined,
// 		};
// 	}
// }
