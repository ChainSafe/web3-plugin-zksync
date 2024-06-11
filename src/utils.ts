// import { AbiCoder, BigNumberish, Bytes, ethers, SignatureLike } from 'ethers';

import { sha256 } from 'ethereum-cryptography/sha256.js';
// import { RLP } from '@ethereumjs/rlp';
// import { secp256k1 } from '@noble/curves/secp256k1';
// import { keccak256 } from '@ethersproject/keccak256';

import * as web3 from 'web3';

import * as web3Utils from 'web3-utils';
import * as web3Accounts from 'web3-eth-accounts';
import * as web3Types from 'web3-types';
import * as web3Abi from 'web3-eth-abi';
import * as web3Contract from 'web3-eth-contract';

import {
	DeploymentInfo,
	// Eip712Meta,
	EthereumSignature,
	// PaymasterParams,
	PriorityOpTree,
	PriorityQueueType,
	// Transaction,
	// TransactionLike,
	// TransactionRequest,
} from './types';
// import { EIP712Signer } from './signer';
// import { IERC20__factory } from './typechain';
import { IZkSyncABI } from './contracts/IZkSyncStateTransition';
import { IBridgehubABI } from './contracts/IBridgehub';
import { IContractDeployerABI } from './contracts/IContractDeployer';
import { IL1MessengerABI } from './contracts/IL1Messenger';
import { IERC20ABI } from './contracts/IERC20';
import { IERC1271ABI } from './contracts/IERC1271';
import { IL1BridgeABI } from './contracts/IL1ERC20Bridge';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { INonceHolderABI } from './contracts/INonceHolder';
import {
	LEGACY_ETH_ADDRESS,
	L2_BASE_TOKEN_ADDRESS,
	ETH_ADDRESS_IN_CONTRACTS,
	L1_MESSENGER_ADDRESS,
	CONTRACT_DEPLOYER_ADDRESS,
	MAX_BYTECODE_LEN_BYTES,
	L1_TO_L2_ALIAS_OFFSET,
	EIP1271_MAGIC_VALUE,
	L1_FEE_ESTIMATION_COEF_NUMERATOR,
	L1_FEE_ESTIMATION_COEF_DENOMINATOR,
	// EIP712_TX_TYPE,
	// DEFAULT_GAS_PER_PUBDATA_LIMIT,
} from './constants';

import { RpcMethods } from './rpc.methods'; // to be used instead of the one at zksync-ethers: Provider from ./provider

// export * from './paymaster-utils';
// export * from './smart-account-utils';
// export { EIP712_TYPES } from './signer';

/**
 * The web3.js Contract instance for the `ZkSync` interface.
 * @constant
 */
export const ZkSyncMainContract = new web3.Contract(IZkSyncABI);

/**
 * The ABI of the `Bridgehub` interface.
 * @constant
 */
export const BridgehubContract = new web3.Contract(IBridgehubABI);

/**
 * The web3.js Contract instance for the `IContractDeployer` interface, which is utilized for deploying smart contracts.
 * @constant
 */
export const ContractDeployerContract = new web3.Contract(IContractDeployerABI);

/**
 * The web3.js Contract instance for the `IL1Messenger` interface, which is utilized for sending messages from the L2 to L1.
 * @constant
 */
export const L1MessengerContract = new web3.Contract(IL1MessengerABI);

/**
 * The web3.js Contract instance for the `IERC20` interface, which is utilized for interacting with ERC20 tokens.
 * @constant
 */
export const IERC20Contract = new web3.Contract(IERC20ABI);

/**
 * The web3.js Contract instance for the `IERC1271` interface, which is utilized for signature validation by contracts.
 * @constant
 */
export const IERC1271Contract = new web3.Contract(IERC1271ABI);

/**
 * The web3.js Contract instance for the `IL1Bridge` interface, which is utilized for transferring ERC20 tokens from L1 to L2.
 * @constant
 */
export const L1BridgeContract = new web3.Contract(IL1BridgeABI);

/**
 * The web3.js Contract instance for the `IL2Bridge` interface, which is utilized for transferring ERC20 tokens from L2 to L1.
 * @constant
 */
export const L2BridgeContract = new web3.Contract(IL2BridgeABI);

/**
 * The web3.js Contract instance for the `INonceHolder` interface, which is utilized for managing deployment nonces.
 * @constant
 */
export const NonceHolderContract = new web3.Contract(INonceHolderABI);

/**
 * ------------------------------------------------------------
 * consider adding the next few functions to web3.js:
 * */

export const toBytes = (number: web3Types.Numbers | Uint8Array) =>
	web3Utils.hexToBytes(
		typeof number === 'number' || typeof number === 'bigint'
			? web3Utils.numberToHex(number)
			: web3Utils.bytesToHex(number),
	);

export function concat(bytes: web3Types.Bytes[]): string {
	return '0x' + bytes.map(d => web3Utils.toHex(d).substring(2)).join('');
}

export function contractFunctionId(value: string): string {
	return web3Utils.keccak256(web3Utils.utf8ToBytes(value));
}

// TODO: needs to test for the first parameter being Eip712TypedData
function recoverSignerAddress(
	messageOrData: string | web3Types.Eip712TypedData,
	signature: SignatureLike,
) {
	let message;
	if (typeof messageOrData !== 'string') {
		message = web3Abi.getEncodedEip712Data(messageOrData);
	} else {
		message = messageOrData;
	}

	if (typeof signature === 'string') {
		return web3Accounts.recover(message, signature);
	}

	const r = web3Utils.toHex(signature.r);
	const s = web3Utils.toHex(signature.s);
	const v = web3Utils.toHex(signature.v);

	const recoveredAddress = web3Accounts.recover(message, v, r, s);
	return recoveredAddress;
}

export class SignatureObject {
	public r: Uint8Array;
	public s: Uint8Array;
	public v: bigint;

	constructor(r: Uint8Array, s: Uint8Array, v: web3Types.Numbers);
	constructor(signature: string | SignatureLike);
	constructor(
		rOrSignature: string | Uint8Array | SignatureLike,
		s?: Uint8Array,
		v?: web3Types.Numbers,
	) {
		if (typeof rOrSignature === 'string') {
			if (rOrSignature.length !== 132) {
				throw new Error('Invalid signature length');
			}
			// Initialize with a single string parameter
			const signature = rOrSignature as string;
			this.r = web3Accounts.toUint8Array(signature.slice(0, 66));
			this.s = web3Accounts.toUint8Array(`0x${signature.slice(66, 130)}`);
			this.v = BigInt(web3Utils.hexToNumber(`0x${signature.slice(130, 132)}`));
		} else if (
			(rOrSignature as EthereumSignature).r &&
			(rOrSignature as EthereumSignature).s &&
			(rOrSignature as EthereumSignature).v
		) {
			const ethereumSignature = rOrSignature as EthereumSignature;
			this.r = web3Utils.bytesToUint8Array(ethereumSignature.r);
			this.s = web3Utils.bytesToUint8Array(ethereumSignature.s);
			this.v = BigInt(ethereumSignature.v);
		} else {
			const signature = { r: rOrSignature as Uint8Array, s: s, v: v };
			// Initialize with individual parameters
			this.r = signature.r!;
			this.s = signature.s!;
			this.v = BigInt(signature.v!);
		}
	}

	public toString() {
		return `${this.r}${this.s.slice(2)}${web3Utils.toHex(this.v).slice(2)}`;
	}
}

export type SignatureLike = SignatureObject | EthereumSignature | string;

/**
 *  eip-191 message prefix
 */
export const MessagePrefix: string = '\x19Ethereum Signed Message:\n';

/**
 * Has the message according to eip-191
 * @param message - message to hash
 * @returns hash of the message
 */
export function hashMessage(message: Uint8Array | string): string {
	if (typeof message === 'string') {
		message = web3Accounts.toUint8Array(message);
	}
	return web3Utils.keccak256(
		concat([
			web3Accounts.toUint8Array(MessagePrefix),
			web3Accounts.toUint8Array(String(message.length)),
			message,
		]),
	);
}

/**
 * ------------------------------------------------------------
 * End of the function section that would be added to web3.js
 */

/**
 * Returns true if token represents ETH on L1 or L2.
 *
 * @param token The token address.
 *
 * @example
 *
 * const isL1ETH = utils.isETH(utils.ETH_ADDRESS); // true
 * const isL2ETH = utils.isETH(utils.ETH_ADDRESS_IN_CONTRACTS); // true
 */
export function isETH(token: web3.Address) {
	return (
		isAddressEq(token, LEGACY_ETH_ADDRESS) ||
		isAddressEq(token, L2_BASE_TOKEN_ADDRESS) ||
		isAddressEq(token, ETH_ADDRESS_IN_CONTRACTS)
	);
}

/**
 * Pauses execution for a specified number of milliseconds.
 *
 * @param millis The number of milliseconds to pause execution.
 *
 * @example
 *
 * await sleep(1_000);
 */
export function sleep(millis: number): Promise<unknown> {
	return new Promise(resolve => setTimeout(resolve, millis));
}

/**
 * Returns the default settings for L1 transactions.
 */
export function layer1TxDefaults(): {
	queueType: PriorityQueueType.Deque;
	opTree: PriorityOpTree.Full;
} {
	return {
		queueType: PriorityQueueType.Deque,
		opTree: PriorityOpTree.Full,
	};
}

/**
 * Returns a `keccak` encoded message with a given sender address and block number from the L1 messenger contract.
 *
 * @param sender The sender of the message on L2.
 * @param msg The encoded message.
 * @param txNumberInBlock The index of the transaction in the block.
 * @returns The hashed `L2->L1` message.
 *
 * @example
 *
 * const withdrawETHMessage = "0x6c0960f936615cf349d7f6344891b1e7ca7c72883f5dc04900000000000000000000000000000000000000000000000000000001a13b8600";
 * const withdrawETHMessageHash = utils.getHashedL2ToL1Msg("0x36615Cf349d7F6344891B1e7CA7C72883F5dc049", withdrawETHMessage, 0);
 * // withdrawETHMessageHash = "0xd8c80ecb64619e343f57c3b133c6c6d8dd0572dd3488f1ca3276c5b7fd3a938d"
 */
export function getHashedL2ToL1Msg(
	sender: web3.Address,
	msg: web3Types.Bytes,
	txNumberInBlock: number,
): string {
	const encodedMsg = new Uint8Array([
		0, // l2ShardId
		1, // isService
		...web3Utils.hexToBytes(web3Utils.padLeft(web3Utils.toHex(txNumberInBlock), 2 * 2)),
		...web3Utils.hexToBytes(L1_MESSENGER_ADDRESS),
		...web3Utils.hexToBytes(web3Utils.padLeft(sender, 32 * 2)),
		...web3Utils.hexToBytes(web3Utils.keccak256(msg)),
	]);

	return web3Utils.keccak256(encodedMsg);
}

/**
 * Returns a log containing details of all deployed contracts related to a transaction receipt.
 *
 * @param receipt The transaction receipt containing deployment information.
 *
 * @example
 *
 *
 */
export function getDeployedContracts(receipt: web3Types.TransactionReceipt): DeploymentInfo[] {
	const addressBytesLen = 40;
	return (
		receipt.logs
			.filter(
				log =>
					log.topics &&
					log.topics[0] === contractFunctionId('ContractDeployed(address,bytes32,address)') &&
					log.address &&
					isAddressEq(log.address, CONTRACT_DEPLOYER_ADDRESS),
			)
			// Take the last topic (deployed contract address as U256) and extract address from it (U160).
			.map(log => {
				if (!log.topics) throw new Error('No topics in log');
				const sender = `0x${log.topics[1].slice(log.topics[1].length - addressBytesLen)}`;
				const bytecodeHash = log.topics[2];
				const address = `0x${log.topics[3].slice(log.topics[3].length - addressBytesLen)}`;
				return {
					sender: web3Utils.toChecksumAddress(sender),
					bytecodeHash: web3Utils.toHex(bytecodeHash),
					deployedAddress: web3Utils.toChecksumAddress(address),
				};
			})
	);
}

/**
 * Generates a future-proof contract address using a salt plus bytecode, allowing the determination of an address before deployment.
 *
 * @param sender The sender's address.
 * @param bytecodeHash The hash of the bytecode, typically the output from `zkSolc`.
 * @param salt A randomization element used to create the contract address.
 * @param input The ABI-encoded constructor arguments, if any.
 *
 * @remarks The implementation of `create2Address` in zkSync Era may differ slightly from Ethereum.
 *
 * @example
 *
 * const address = utils.create2Address("0x36615Cf349d7F6344891B1e7CA7C72883F5dc049", "0x010001cb6a6e8d5f6829522f19fa9568660e0a9cd53b2e8be4deb0a679452e41", "0x01", "0x01");
 * // address = "0x29bac3E5E8FFE7415F97C956BFA106D70316ad50"
 */
export function create2Address(
	sender: web3Types.Address,
	bytecodeHash: web3Types.Bytes,
	salt: web3Types.Bytes,
	input: web3Types.Bytes = '',
): string {
	const prefix = web3Utils.keccak256(web3Utils.utf8ToBytes('zksyncCreate2'));
	const inputHash = web3Utils.keccak256(input);
	const addressBytes = web3Utils
		.keccak256(concat([prefix, web3Utils.padLeft(sender, 32 * 2), salt, bytecodeHash, inputHash]))
		.slice(26);
	return web3Utils.toChecksumAddress(addressBytes);
}

/**
 * Generates a contract address from the deployer's account and nonce.
 *
 * @param sender The address of the deployer's account.
 * @param senderNonce The nonce of the deployer's account.
 *
 * @example
 *
 * const address = utils.createAddress("0x36615Cf349d7F6344891B1e7CA7C72883F5dc049", 1);
 * // address = "0x4B5DF730c2e6b28E17013A1485E5d9BC41Efe021"
 */
export function createAddress(sender: web3.Address, senderNonce: web3Types.Numbers): string {
	const prefix = web3Utils.keccak256(web3Utils.utf8ToBytes('zksyncCreate'));
	const addressBytes = web3Utils
		.keccak256(
			concat([
				prefix,
				web3Utils.padLeft(sender, 32 * 2),
				web3Utils.padLeft(web3Utils.toHex(senderNonce), 32 * 2),
			]),
		)
		.slice(26);

	return web3Utils.toChecksumAddress(addressBytes);
}

/**
 * Checks if the transaction's base cost is greater than the provided value, which covers the transaction's cost.
 *
 * @param baseCost The base cost of the transaction.
 * @param value The value covering the transaction's cost.
 * @throws {Error} The base cost must be greater than the provided value.
 *
 * @example
 *
 * const baseCost = 100;
 * const value = 99;
 * try {
 *   await utils.checkBaseCost(baseCost, value);
 * } catch (e) {
 *   // e.message = `The base cost of performing the priority operation is higher than the provided value parameter for the transaction: baseCost: ${baseCost}, provided value: ${value}`,
 * }
 */
export async function checkBaseCost(
	baseCost: web3Types.Numbers,
	value: web3Types.Numbers | Promise<web3Types.Numbers>,
): Promise<void> {
	if (baseCost > (await value)) {
		throw new Error(
			'The base cost of performing the priority operation is higher than the provided value parameter ' +
				`for the transaction: baseCost: ${baseCost}, provided value: ${value}!`,
		);
	}
}

// /**
//  * Serializes an EIP712 transaction and includes a signature if provided.
//  *
//  * @param transaction The transaction that needs to be serialized.
//  * @param signature Ethers signature to be included in the transaction.
//  * @throws {Error} Throws an error if:
//  * - `transaction.customData.customSignature` is an empty string. The transaction should be signed, and the `transaction.customData.customSignature` field should be populated with the signature. It should not be specified if the transaction is not signed.
//  * - `transaction.chainId` is not provided.
//  * - `transaction.from` is not provided.
//  *
//  * @example Serialize EIP712 transaction without signature.
//  *
//  * const serializedTx = utils.serializeEip712({ chainId: 270, from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049" }, null);
//  *
//  * // serializedTx = "0x71ea8080808080808082010e808082010e9436615cf349d7f6344891b1e7ca7c72883f5dc04982c350c080c0"
//  *
//  * @example Serialize EIP712 transaction with signature.
//  *
//  * const signature = ethers.Signature.from("0x73a20167b8d23b610b058c05368174495adf7da3a4ed4a57eb6dbdeb1fafc24aaf87530d663a0d061f69bb564d2c6fb46ae5ae776bbd4bd2a2a4478b9cd1b42a");
//  *
//  * const serializedTx = utils.serializeEip712(
//  *   {
//  *     chainId: 270,
//  *     from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
//  *     to: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
//  *     value: 1_000_000,
//  *   },
//  *   signature
//  * );
//  * // serializedTx = "0x71f87f8080808094a61464658afeaf65cccaafd3a512b69a83b77618830f42408001a073a20167b8d23b610b058c05368174495adf7da3a4ed4a57eb6dbdeb1fafc24aa02f87530d663a0d061f69bb564d2c6fb46ae5ae776bbd4bd2a2a4478b9cd1b42a82010e9436615cf349d7f6344891b1e7ca7c72883f5dc04982c350c080c0"
//  */
// export function serializeEip712(transaction: TransactionLike, signature?: SignatureLike): string {
// 	if (!transaction.chainId) {
// 		throw Error("Transaction chainId isn't set!");
// 	}

// 	if (!transaction.from) {
// 		throw new Error('Explicitly providing `from` field is required for EIP712 transactions!');
// 	}
// 	const from = transaction.from;
// 	const meta: Eip712Meta = transaction.customData ?? {};
// 	const maxFeePerGas = transaction.maxFeePerGas || transaction.gasPrice || 0;
// 	const maxPriorityFeePerGas = transaction.maxPriorityFeePerGas || maxFeePerGas;

// 	const fields: any[] = [
// 		toBytes(transaction.nonce || 0),
// 		toBytes(maxPriorityFeePerGas),
// 		toBytes(maxFeePerGas),
// 		toBytes(transaction.gasLimit || 0),
// 		transaction.to ? web3Utils.toChecksumAddress(transaction.to) : '0x',
// 		toBytes(transaction.value || 0),
// 		transaction.data || '0x',
// 	];

// 	if (signature) {
// 		const sig = new SignatureObject(signature);
// 		fields.push(toBytes(sig.yParity));
// 		fields.push(toBytes(sig.r));
// 		fields.push(toBytes(sig.s));
// 	} else {
// 		fields.push(toBytes(transaction.chainId));
// 		fields.push('0x');
// 		fields.push('0x');
// 	}
// 	fields.push(toBytes(transaction.chainId));
// 	fields.push(web3Utils.toChecksumAddress(from));

// 	// Add meta
// 	fields.push(toBytes(meta.gasPerPubdata || DEFAULT_GAS_PER_PUBDATA_LIMIT));
// 	fields.push((meta.factoryDeps ?? []).map(dep => web3Utils.toHex(dep)));

// 	if (meta.customSignature && web3Utils.bytesToUint8Array(meta.customSignature).length === 0) {
// 		throw new Error('Empty signatures are not supported!');
// 	}
// 	fields.push(meta.customSignature || '0x');

// 	if (meta.paymasterParams) {
// 		fields.push([
// 			meta.paymasterParams.paymaster,
// 			web3Utils.toHex(meta.paymasterParams.paymasterInput),
// 		]);
// 	} else {
// 		fields.push([]);
// 	}

// 	return concat([new Uint8Array([EIP712_TX_TYPE]), RLP.encode(fields)]);
// }

/**
 * Returns the hash of the given bytecode.
 *
 * @param bytecode The bytecode to hash.
 *
 * @example
 *
 * const bytecode =
 *   "0x000200000000000200010000000103550000006001100270000000130010019d0000008001000039000000400010043f0000000101200190000000290000c13d0000000001000031000000040110008c000000420000413d0000000101000367000000000101043b000000e001100270000000150210009c000000310000613d000000160110009c000000420000c13d0000000001000416000000000110004c000000420000c13d000000040100008a00000000011000310000001702000041000000200310008c000000000300001900000000030240190000001701100197000000000410004c000000000200a019000000170110009c00000000010300190000000001026019000000000110004c000000420000c13d00000004010000390000000101100367000000000101043b000000000010041b0000000001000019000000490001042e0000000001000416000000000110004c000000420000c13d0000002001000039000001000010044300000120000004430000001401000041000000490001042e0000000001000416000000000110004c000000420000c13d000000040100008a00000000011000310000001702000041000000000310004c000000000300001900000000030240190000001701100197000000000410004c000000000200a019000000170110009c00000000010300190000000001026019000000000110004c000000440000613d00000000010000190000004a00010430000000000100041a000000800010043f0000001801000041000000490001042e0000004800000432000000490001042e0000004a00010430000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0000000200000000000000000000000000000040000001000000000000000000000000000000000000000000000000000000000000000000000000006d4ce63c0000000000000000000000000000000000000000000000000000000060fe47b18000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000080000000000000000000000000000000000000000000000000000000000000000000000000000000009c8c8fa789967eb514f3ec9def748480945cc9b10fcbd1a19597d924eb201083";
 * const hashedBytecode = utils.hashBytecode(bytecode);
 * /*
 * hashedBytecode =  new Uint8Array([
 *     1, 0, 0, 27, 57, 231, 154, 55, 0, 164, 201, 96, 244, 120, 23, 112, 54, 34, 224, 133,
 *     160, 122, 88, 164, 112, 80, 0, 134, 48, 138, 74, 16,
 *   ]),
 * );
 * *\/
 */
export function hashBytecode(bytecode: web3Types.Bytes): Uint8Array {
	// For getting the consistent length we first convert the bytecode to UInt8Array
	const bytecodeAsArray = web3Utils.bytesToUint8Array(bytecode);

	if (bytecodeAsArray.length % 32 !== 0) {
		throw new Error('The bytecode length in bytes must be divisible by 32!');
	}

	if (bytecodeAsArray.length > MAX_BYTECODE_LEN_BYTES) {
		throw new Error(`Bytecode can not be longer than ${MAX_BYTECODE_LEN_BYTES} bytes!`);
	}

	const hashStr = web3Utils.toHex(sha256(Buffer.from(bytecodeAsArray)));
	const hash = web3Utils.bytesToUint8Array(hashStr);

	// Note that the length of the bytecode
	// should be provided in 32-byte words.
	const bytecodeLengthInWords = bytecodeAsArray.length / 32;
	if (bytecodeLengthInWords % 2 === 0) {
		throw new Error('Bytecode length in 32-byte words must be odd!');
	}

	// The bytecode should always take the first 2 bytes of the bytecode hash,
	// so we pad it from the left in case the length is smaller than 2 bytes.
	const bytecodeLengthPadded = web3Utils.bytesToUint8Array(
		web3Utils.padLeft(bytecodeLengthInWords, 2 * 2),
	);

	const codeHashVersion = new Uint8Array([1, 0]);
	hash.set(codeHashVersion, 0);
	hash.set(bytecodeLengthPadded, 2);

	return hash;
}

// /**
//  * Parses an EIP712 transaction from a payload.
//  *
//  * @param payload The payload to parse.
//  *
//  * @example
//  *
//  * import { types } from "zksync-ethers";
//  *
//  * const serializedTx =
//  *   "0x71f87f8080808094a61464658afeaf65cccaafd3a512b69a83b77618830f42408001a073a20167b8d23b610b058c05368174495adf7da3a4ed4a57eb6dbdeb1fafc24aa02f87530d663a0d061f69bb564d2c6fb46ae5ae776bbd4bd2a2a4478b9cd1b42a82010e9436615cf349d7f6344891b1e7ca7c72883f5dc04982c350c080c0";
//  * const tx: types.TransactionLike = utils.parseEip712(serializedTx);
//  * /*
//  * tx: types.TransactionLike = {
//  *   type: 113,
//  *   nonce: 0,
//  *   maxPriorityFeePerGas: BigInt(0),
//  *   maxFeePerGas: BigInt(0),
//  *   gasLimit: BigInt(0),
//  *   to: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
//  *   value: BigInt(1000000),
//  *   data: "0x",
//  *   chainId: BigInt(270),
//  *   from: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
//  *   customData: {
//  *     gasPerPubdata: BigInt(50000),
//  *     factoryDeps: [],
//  *     customSignature: "0x",
//  *     paymasterParams: null,
//  *   },
//  *   hash: "0x9ed410ce33179ac1ff6b721060605afc72d64febfe0c08cacab5a246602131ee",
//  * };
//  * *\/
//  */
// // TODO: extend ethers.Transaction and add custom fields
// export function parseEip712(payload: web3Types.Bytes): TransactionLike {
// 	function handleAddress(value: string): string | null {
// 		if (value === '0x') {
// 			return null;
// 		}
// 		return web3Utils.toChecksumAddress(value);
// 	}

// 	function handleNumber(value: string): bigint {
// 		if (!value || value === '0x') {
// 			return 0n;
// 		}
// 		return BigInt(value);
// 	}

// 	function arrayToPaymasterParams(arr: string[]): PaymasterParams | undefined {
// 		if (arr.length === 0) {
// 			return undefined;
// 		}
// 		if (arr.length !== 2) {
// 			throw new Error(
// 				`Invalid paymaster parameters, expected to have length of 2, found ${arr.length}!`,
// 			);
// 		}

// 		return {
// 			paymaster: web3Utils.toChecksumAddress(arr[0]),
// 			paymasterInput: web3Utils.bytesToUint8Array(arr[1]),
// 		};
// 	}

// 	const bytes = web3Utils.bytesToUint8Array(payload);

// 	// try using: RLP.decode
// 	const raw = ethers.decodeRlp(bytes.slice(1)) as string[];
// 	const transaction: TransactionLike = {
// 		type: EIP712_TX_TYPE,
// 		nonce: Number(handleNumber(raw[0])),
// 		maxPriorityFeePerGas: handleNumber(raw[1]),
// 		maxFeePerGas: handleNumber(raw[2]),
// 		gasLimit: handleNumber(raw[3]),
// 		to: handleAddress(raw[4]),
// 		value: handleNumber(raw[5]),
// 		data: raw[6],
// 		chainId: handleNumber(raw[10]),
// 		from: handleAddress(raw[11]),
// 		customData: {
// 			gasPerPubdata: handleNumber(raw[12]),
// 			factoryDeps: raw[13] as unknown as string[],
// 			customSignature: raw[14],
// 			paymasterParams: arrayToPaymasterParams(raw[15] as unknown as string[]),
// 		},
// 	};

// 	const ethSignature = {
// 		v: Number(handleNumber(raw[7])),
// 		r: raw[8],
// 		s: raw[9],
// 	};

// 	if (
// 		(web3Utils.toHex(ethSignature.r) === '0x' || web3Utils.toHex(ethSignature.s) === '0x') &&
// 		!transaction.customData?.customSignature
// 	) {
// 		return transaction;
// 	}

// 	if (ethSignature.v !== 0 && ethSignature.v !== 1 && !transaction.customData?.customSignature) {
// 		throw new Error('Failed to parse signature!');
// 	}

// 	if (!transaction.customData?.customSignature) {
// 		transaction.signature = new SignatureObject(ethSignature).toString();
// 	}

// 	transaction.hash = eip712TxHash(transaction, ethSignature);

// 	return transaction;
// }

export function getSignature(transaction: any, ethSignature?: EthereumSignature): Uint8Array {
	if (transaction?.customData?.customSignature && transaction.customData.customSignature.length) {
		return web3Utils.bytesToUint8Array(transaction.customData.customSignature);
	}

	if (!ethSignature) {
		throw new Error('No signature provided!');
	}

	const r = web3Utils.bytesToUint8Array(web3Utils.padLeft(web3Utils.toHex(ethSignature.r), 32 * 2));
	const s = web3Utils.bytesToUint8Array(web3Utils.padLeft(web3Utils.toHex(ethSignature.s), 32 * 2));
	const v = ethSignature.v;

	return new Uint8Array([...r, ...s, v]);
}

// /**
//  * Returns the hash of an EIP712 transaction.
//  *
//  * @param transaction The EIP-712 transaction.
//  * @param ethSignature The ECDSA signature of the transaction.
//  *
//  * @example
//  *
//  *
//  */
// export function eip712TxHash(
// 	transaction: Transaction | TransactionRequest,
// 	ethSignature?: EthereumSignature,
// ): string {
// 	const signedDigest = EIP712Signer.getSignedDigest(transaction);
// 	const hashedSignature = web3Utils.keccak256(getSignature(transaction, ethSignature));

// 	return web3Utils.keccak256(concat([signedDigest, hashedSignature]));
// }

// /**
//  * Returns the hash of the L2 priority operation from a given transaction receipt and L2 address.
//  *
//  * @param txReceipt The receipt of the L1 transaction.
//  * @param zkSyncAddress The address of the zkSync Era main contract.
//  *
//  * @example
//  */
// export function getL2HashFromPriorityOp(
// 	txReceipt: web3Types.TransactionReceipt,
// 	zkSyncAddress: web3.Address,
// ): string {
// 	let txHash: string | null = null;
// 	for (const log of txReceipt.logs) {
// 		if (!isAddressEq(log.address as string, zkSyncAddress)) {
// 			continue;
// 		}

// 		try {
// 			// TODO: implement at web3.js Contract the parsing of the logs similar to new ethers.Interface(ABI).parseLog(...)
// 			const priorityQueueLog = ZkSyncMainContract.parseLog({
// 				topics: log.topics as string[],
// 				data: log.data,
// 			});
// 			if (priorityQueueLog && priorityQueueLog.args.txHash !== null) {
// 				txHash = priorityQueueLog.args.txHash;
// 			}
// 		} catch {
// 			// skip
// 		}
// 	}
// 	if (!txHash) {
// 		throw new Error('Failed to parse tx logs!');
// 	}

// 	return txHash;
// }

const ADDRESS_MODULO = 2n ** 160n;

/**
 * Converts the address that submitted a transaction to the inbox on L1 to the `msg.sender` viewed on L2.
 * Returns the `msg.sender` of the `L1->L2` transaction as the address of the contract that initiated the transaction.
 *
 * All available cases:
 * - During a normal transaction, if contract `A` calls contract `B`, the `msg.sender` is `A`.
 * - During `L1->L2` communication, if an EOA `X` calls contract `B`, the `msg.sender` is `X`.
 * - During `L1->L2` communication, if a contract `A` calls contract `B`, the `msg.sender` is `applyL1ToL2Alias(A)`.
 *
 * @param address The address of the contract.
 * @returns The transformed address representing the `msg.sender` on L2.
 *
 * @see
 * {@link undoL1ToL2Alias}.
 *
 * @example
 *
 * const l1ContractAddress = "0x702942B8205E5dEdCD3374E5f4419843adA76Eeb";
 * const l2ContractAddress = utils.applyL1ToL2Alias(l1ContractAddress);
 * // l2ContractAddress = "0x813A42B8205E5DedCd3374e5f4419843ADa77FFC"
 *
 */
export function applyL1ToL2Alias(address: string): string {
	return web3Utils.padLeft(
		web3Utils.toHex((BigInt(address) + BigInt(L1_TO_L2_ALIAS_OFFSET)) % ADDRESS_MODULO),
		20 * 2,
	);
}

/**
 * Converts and returns the `msg.sender` viewed on L2 to the address that submitted a transaction to the inbox on L1.
 *
 * @param address The sender address viewed on L2.
 *
 * @see
 * {@link applyL1ToL2Alias}.
 *
 * @example
 *
 * const l2ContractAddress = "0x813A42B8205E5DedCd3374e5f4419843ADa77FFC";
 * const l1ContractAddress = utils.undoL1ToL2Alias(l2ContractAddress);
 * // const l1ContractAddress = "0x702942B8205E5dEdCD3374E5f4419843adA76Eeb"
 */
export function undoL1ToL2Alias(address: string): string {
	let result = BigInt(address) - BigInt(L1_TO_L2_ALIAS_OFFSET);
	if (result < 0n) {
		result += ADDRESS_MODULO;
	}
	return web3Utils.padLeft(web3Utils.toHex(result), 20 * 2);
}

/**
 * Returns the data needed for correct initialization of an L1 token counterpart on L2.
 *
 * @param l1TokenAddress The token address on L1.
 * @param provider The client that is able to work with contracts on a read-write basis.
 * @returns The encoded bytes which contains token name, symbol and decimals.
 */
export async function getERC20DefaultBridgeData(
	l1TokenAddress: string,
	context: web3.Web3Context, // or maybe use RpcMethods?
): Promise<string> {
	if (isAddressEq(l1TokenAddress, LEGACY_ETH_ADDRESS)) {
		l1TokenAddress = ETH_ADDRESS_IN_CONTRACTS;
	}
	const token = new web3Contract.Contract(IERC20ABI, l1TokenAddress, context);

	const name = isAddressEq(l1TokenAddress, ETH_ADDRESS_IN_CONTRACTS)
		? 'Ether'
		: await token.methods.name().call();
	const symbol = isAddressEq(l1TokenAddress, ETH_ADDRESS_IN_CONTRACTS)
		? 'ETH'
		: await token.methods.symbol().call();
	const decimals = isAddressEq(l1TokenAddress, ETH_ADDRESS_IN_CONTRACTS)
		? 18
		: await token.methods.decimals().call();

	return web3Abi.encodeParameters(['string', 'string', 'uint256'], [name, symbol, decimals]);
}

/**
 * Returns the calldata sent by an L1 ERC20 bridge to its L2 counterpart during token bridging.
 *
 * @param l1TokenAddress The token address on L1.
 * @param l1Sender The sender address on L1.
 * @param l2Receiver The recipient address on L2.
 * @param amount The gas fee for the number of tokens to bridge.
 * @param bridgeData Additional bridge data.
 *
 * @example
 *
 *
 */
export async function getERC20BridgeCalldata(
	l1TokenAddress: string,
	l1Sender: string,
	l2Receiver: string,
	amount: web3Types.Numbers,
	bridgeData: web3Types.Bytes,
): Promise<string> {
	return L2BridgeContract.methods
		.finalizeDeposit(l1Sender, l2Receiver, l1TokenAddress, amount, bridgeData)
		.encodeABI();
}

/**
 * Validates signatures from non-contract account addresses (EOA: Externally Owned Account).
 * Provides similar functionality to `new Web3().eth.accounts.recover(message, v, r, s)` but returns `true`
 * if the validation process succeeds, otherwise returns `false`.
 *
 * Called from {@link isSignatureCorrect} for non-contract account addresses.
 *
 * @param address The address which signs the `msgHash`.
 * @param message The message which its hash had been signed early.
 * @param signature The Ethers signature.
 *
 * @example
 *
 * import * as web3Accounts from 'web3-eth-accounts';
 *
 * const wallet = web3Accounts.create();
 * const ADDRESS = wallet.address;
 * const PRIVATE_KEY = wallet.privateKey;
 *
 * const message = "Hello, world!";
 *
 * const signature = web3Accounts.sign(message, PRIVATE_KEY).signature;
 * const isValidSignature = await utils.isECDSASignatureCorrect(ADDRESS, message, signature);
 * // isValidSignature = true
 */
function isECDSASignatureCorrect(
	address: string,
	message: string | web3Types.Eip712TypedData,
	signature: SignatureLike,
): boolean {
	try {
		return isAddressEq(address, recoverSignerAddress(message, signature));
	} catch {
		// In case ECDSA signature verification has thrown an error,
		// we simply consider the signature as incorrect.
		return false;
	}
}

/**
 * Called from {@link isSignatureCorrect} for contract account addresses.
 * The function returns `true` if the validation process results
 * in the {@link EIP1271_MAGIC_VALUE}.
 *
 * @param context The web3 context.
 * @param address The sender address.
 * @param msgHash The hash of the message.
 * @param signature The Ethers signature.
 *
 * @see
 * {@link isMessageSignatureCorrect} and {@link isTypedDataSignatureCorrect} to validate signatures.
 *
 * @example
 *
 */
async function isEIP1271SignatureCorrect(
	context: web3.Web3Context, // or maybe use RpcMethods?
	address: string,
	msgHash: string,
	signature: SignatureLike,
): Promise<boolean> {
	const accountContract = new web3.Contract(IERC1271ABI, address, context);

	// This line may throw an exception if the contract does not implement the EIP1271 correctly.
	// But it may also throw an exception in case the internet connection is lost.
	// It is the caller's responsibility to handle the exception.
	const result = await accountContract.methods.isValidSignature(msgHash, signature).call();

	return result === EIP1271_MAGIC_VALUE;
}

/**
 * Called from {@link isMessageSignatureCorrect} and {@link isTypedDataSignatureCorrect}.
 * Returns whether the account abstraction signature is correct.
 * Signature can be created using EIP1271 or ECDSA.
 *
 * @param context The web3 context.
 * @param address The sender address.
 * @param message The message which its hash had been signed early.
 * @param signature The Ethers signature.
 */
async function isSignatureCorrect(
	context: web3.Web3Context, // or maybe use RpcMethods?
	address: string,
	message: string | web3Types.Eip712TypedData,
	signature: SignatureLike,
): Promise<boolean> {
	let isContractAccount;
	if (context.provider) {
		const code = await web3.eth.getCode(
			context,
			address,
			undefined,
			web3Types.DEFAULT_RETURN_FORMAT,
		);
		isContractAccount = web3Utils.bytesToUint8Array(code).length !== 0;
	}

	if (!isContractAccount) {
		return isECDSASignatureCorrect(address, message, signature);
	} else {
		const msgHash = web3Accounts.hashMessage(
			typeof message === 'string' ? message : web3Utils.bytesToHex(message as unknown as string),
		);
		return await isEIP1271SignatureCorrect(context, address, msgHash, signature);
	}
}

/**
 * Returns whether the account abstraction message signature is correct.
 * Signature can be created using EIP1271 or ECDSA.
 *
 * @param provider The provider.
 * @param address The sender address.
 * @param message The hash of the message.
 * @param signature The Ethers signature.
 *
 * @example
 *
 * import { Web3 } from 'web3';
 * import * as web3Accounts from 'web3-eth-accounts';
 *
 * const wallet = web3Accounts.create();
 * const ADDRESS = wallet.address;
 * const PRIVATE_KEY = wallet.privateKey;
 * const context = new Web3('some-rpc-url');
 *
 * const message = "Hello, world!";
 * const signature = await new Wallet(PRIVATE_KEY).signMessage(message);
 * const isValidSignature = await utils.isMessageSignatureCorrect(
 * 			web3,
 * 			ADDRESS,
 * 			message,
 * 			signature,
 * 		);
 * // isValidSignature = true
 */
export async function isMessageSignatureCorrect(
	context: web3.Web3Context, // or maybe use RpcMethods?
	address: string,
	message: Uint8Array | string,
	signature: SignatureLike,
): Promise<boolean> {
	return await isSignatureCorrect(context, address, web3Utils.toHex(message), signature);
}

/**
 * Returns whether the account abstraction EIP712 signature is correct.
 *
 * @param context The web3 context.
 * @param address The sender address.
 * @param domain The domain data.
 * @param types A map of records pointing from field name to field type.
 * @param value A single record value.
 * @param signature The Ethers signature.
 *
 * @example
 *
 * import { Wallet, utils, constants, Provider, EIP712Signer } from "web3-plugin-zksync";
 *
 * const ADDRESS = "<WALLET_ADDRESS>";
 * const PRIVATE_KEY = "<WALLET_PRIVATE_KEY>";
 * const context = Provider.getDefaultProvider(types.Network.Sepolia);
 *
 * const tx: types.TransactionRequest = {
 *   type: 113,
 *   chainId: 270,
 *   from: ADDRESS,
 *   to: "0xa61464658AfeAf65CccaaFD3a512b69A83B77618",
 *   value: BigInt(7_000_000),
 * };
 *
 * const eip712Signer = new EIP712Signer(
 *   new Wallet(PRIVATE_KEY), // or web3Accounts.privateKeyToAccount(PRIVATE_KEY),
 *   Number((await context.getNetwork()).chainId)
 * );
 *
 * const signature = await eip712Signer.sign(tx);
 *
 * const isValidSignature = await utils.isTypedDataSignatureCorrect(context, ADDRESS, await eip712Signer.getDomain(), constants.EIP712_TYPES, 'Transaction', EIP712Signer.getSignInput(tx), signature);
 * // isValidSignature = true
 */
export async function isTypedDataSignatureCorrect(
	context: web3.Web3Context, // or maybe use RpcMethods?
	address: string,
	domain: web3Types.Eip712TypedData['domain'],
	types: web3Types.Eip712TypedData['types'],
	value: Record<string, any>,
	signature: SignatureLike,
): Promise<boolean> {
	const data: web3Types.Eip712TypedData = {
		domain,
		types,
		primaryType: 'Transaction',
		message: value,
	};
	// could be also:
	// const message = web3Abi.getEncodedEip712Data(data);
	// return await isSignatureCorrect(context, address, message, signature);

	return await isSignatureCorrect(context, address, data, signature);
}

/**
 * Returns an estimation of the L2 gas required for token bridging via the default ERC20 bridge.
 *
 * @param providerL1 The Ethers provider for the L1 network.
 * @param providerL2 The zkSync provider for the L2 network.
 * @param token The address of the token to be bridged.
 * @param amount The deposit amount.
 * @param to The recipient address on the L2 network.
 * @param from The sender address on the L1 network.
 * @param gasPerPubdataByte The current gas per byte of pubdata.
 *
 * @see
 * {@link https://docs.zksync.io/build/developer-reference/bridging-asset.html#default-bridges Default bridges documentation}.
 *
 * @example
 *
 *
 */
export async function estimateDefaultBridgeDepositL2Gas(
	providerL1: web3.Web3Eth,
	providerL2: RpcMethods,
	token: web3.Address,
	amount: web3Types.Numbers,
	to: web3.Address,
	from?: web3.Address,
	gasPerPubdataByte?: web3Types.Numbers,
): Promise<web3Types.Numbers> {
	// If the `from` address is not provided, we use a random address, because
	// due to storage slot aggregation, the gas estimation will depend on the address
	// and so estimation for the zero address may be smaller than for the sender.
	from ??= web3Accounts.create().address;
	if (await providerL2.isBaseToken(token)) {
		return await providerL2.estimateL1ToL2Execute({
			contractAddress: to,
			gasPerPubdataByte: gasPerPubdataByte,
			caller: from,
			calldata: '0x',
			l2Value: amount,
		});
	} else {
		const bridgeAddresses = await providerL2.getDefaultBridgeAddresses();

		const value = 0;
		const l1BridgeAddress = bridgeAddresses.sharedL1;
		const l2BridgeAddress = bridgeAddresses.sharedL2;
		const bridgeData = await getERC20DefaultBridgeData(token, providerL1);

		return await estimateCustomBridgeDepositL2Gas(
			providerL2,
			l1BridgeAddress,
			l2BridgeAddress,
			isAddressEq(token, LEGACY_ETH_ADDRESS) ? ETH_ADDRESS_IN_CONTRACTS : token,
			amount,
			to,
			bridgeData,
			from,
			gasPerPubdataByte,
			value,
		);
	}
}

/**
 * Scales the provided gas limit using a coefficient to ensure acceptance of L1->L2 transactions.
 *
 * This function adjusts the gas limit by multiplying it with a coefficient calculated from the
 * `L1_FEE_ESTIMATION_COEF_NUMERATOR` and `L1_FEE_ESTIMATION_COEF_DENOMINATOR` constants.
 *
 * @param gasLimit - The gas limit to be scaled.
 *
 * @example
 *
 * const scaledGasLimit = utils.scaleGasLimit(10_000);
 * // scaledGasLimit = 12_000
 */
export function scaleGasLimit(gasLimit: bigint): bigint {
	return (
		(gasLimit * BigInt(L1_FEE_ESTIMATION_COEF_NUMERATOR)) /
		BigInt(L1_FEE_ESTIMATION_COEF_DENOMINATOR)
	);
}

/**
 * Returns an estimation of the L2 gas required for token bridging via the custom ERC20 bridge.
 *
 * @param providerL2 The zkSync provider for the L2 network.
 * @param l1BridgeAddress The address of the custom L1 bridge.
 * @param l2BridgeAddress The address of the custom L2 bridge.
 * @param token The address of the token to be bridged.
 * @param amount The deposit amount.
 * @param to The recipient address on the L2 network.
 * @param bridgeData Additional bridge data.
 * @param from The sender address on the L1 network.
 * @param gasPerPubdataByte The current gas per byte of pubdata.
 * @param l2Value The `msg.value` of L2 transaction.
 *
 * @see
 * {@link https://docs.zksync.io/build/developer-reference/bridging-asset.html#custom-bridges-on-l1-and-l2 Custom bridges documentation}.
 *
 * @example
 *
 *
 */
export async function estimateCustomBridgeDepositL2Gas(
	providerL2: RpcMethods,
	l1BridgeAddress: web3.Address,
	l2BridgeAddress: web3.Address,
	token: web3.Address,
	amount: web3Types.Numbers,
	to: web3.Address,
	bridgeData: web3Types.Bytes,
	from: web3.Address,
	gasPerPubdataByte?: web3Types.Numbers,
	l2Value?: web3Types.Numbers,
): Promise<web3Types.Numbers> {
	const calldata = await getERC20BridgeCalldata(token, from, to, amount, bridgeData);
	return await providerL2.estimateL1ToL2Execute({
		caller: applyL1ToL2Alias(l1BridgeAddress),
		contractAddress: l2BridgeAddress,
		gasPerPubdataByte: gasPerPubdataByte,
		calldata: calldata,
		l2Value: l2Value,
	});
}

/**
 * Creates a JSON string from an object, including support for serializing bigint types.
 *
 * @param object The object to serialize to JSON.
 */
export function toJSON(object: any): string {
	return JSON.stringify(
		object,
		(_, value) => {
			if (typeof value === 'bigint') {
				return value.toString(); // Convert BigInt to string
			}
			return value;
		},
		2,
	);
}

/**
 * Compares stringified addresses, taking into account the fact that
 * addresses might be represented in different casing.
 *
 * @param a - The first address to compare.
 * @param b - The second address to compare.
 * @returns A boolean indicating whether the addresses are equal.
 */
export function isAddressEq(a: web3.Address, b: web3.Address): boolean {
	return a.toLowerCase() === b.toLowerCase();
}
