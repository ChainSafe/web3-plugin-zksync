import { sha256 } from 'ethereum-cryptography/sha256.js';
import * as web3 from 'web3';
import * as web3Utils from 'web3-utils';
import * as web3Accounts from 'web3-eth-accounts';
import * as web3Types from 'web3-types';
import * as web3Abi from 'web3-eth-abi';
import type {
	AbiEventFragment,
	BlockNumberOrTag,
	Bytes,
	LogsInput,
	TransactionHash,
	TransactionReceipt,
} from 'web3-types';
import { toUint8Array } from 'web3-eth-accounts';
import type { Web3Eth } from 'web3-eth';
import { ALL_EVENTS_ABI, decodeEventABI } from 'web3-eth';
import { isAddress, keccak256, toBigInt } from 'web3-utils';
import { encodeEventSignature, jsonInterfaceMethodToString } from 'web3-eth-abi';
import { NameResolver, PriorityOpTree, PriorityQueueType } from './types';
import type {
	DeploymentInfo,
	EthereumSignature,
	PriorityL2OpResponse,
	PriorityOpResponse,
} from './types';
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

import type { Web3ZkSyncL2 } from './web3zksync-l2';
import { Web3ZkSyncL1 } from './web3zksync-l1';
import { Address } from 'web3';
import { ethRpcMethods } from 'web3-rpc-methods';

export * from './Eip712'; // to be used instead of the one at zksync-ethers: Provider from ./provider

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

export const evenHex = (hex: string) => {
	return hex.length % 2 === 0 ? hex : `0x0${hex.slice(2)}`;
};

export const toBytes = (number: web3Types.Numbers | Uint8Array) => {
	const hex = web3Utils.toHex(number);

	return web3Utils.hexToBytes(evenHex(hex));
};

export function concat(bytes: web3Types.Bytes[]): string {
	return '0x' + bytes.map(d => web3Utils.toHex(d).substring(2)).join('');
}

export function contractFunctionId(value: string): string {
	return web3Utils.keccak256(web3Utils.utf8ToBytes(value));
}

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

	const signatureObject =
		typeof signature === 'string'
			? new SignatureObject(signature)
			: new SignatureObject(
					toUint8Array(signature.r),
					toUint8Array(signature.s),
					signature.v,
				);

	return web3Accounts.recover(web3Utils.keccak256(message), signatureObject.serialized, true);
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
			const bytes: Uint8Array = web3Utils.hexToBytes(rOrSignature);

			if (bytes.length === 64) {
				const r = bytes.slice(0, 32);
				const s = bytes.slice(32, 64);
				const v = BigInt(s[0] & 0x80 ? 28 : 27);
				s[0] &= 0x7f;
				this.r = r;
				this.s = s;
				this.v = v;
			} else if (bytes.length === 65) {
				const r = bytes.slice(0, 32);
				const s = bytes.slice(32, 64);
				const v = BigInt(SignatureObject.getNormalizedV(bytes[64]));
				this.r = r;
				this.s = s;
				this.v = v;
			} else {
				throw new Error('Invalid signature length');
			}
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

	static getNormalizedV(v: number): 27 | 28 {
		if (v === 0 || v === 27) {
			return 27;
		}
		if (v === 1 || v === 28) {
			return 28;
		}

		// Otherwise, EIP-155 v means odd is 27 and even is 28
		return v & 1 ? 27 : 28;
	}

	concat(datas: ReadonlyArray<Bytes>): string {
		return '0x' + datas.map(d => web3Utils.toHex(d).substring(2)).join('');
	}

	get yParity(): 0 | 1 {
		return this.v === 27n ? 0 : 1;
	}

	public get serialized(): string {
		return this.concat([this.r, this.s, this.yParity ? '0x1c' : '0x1b']);
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
		message = toUtf8Bytes(message);
	}
	return web3Utils.keccak256(
		concat([toUtf8Bytes(MessagePrefix), toUtf8Bytes(String(message.length)), message]),
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
 */
export function getDeployedContracts(receipt: web3Types.TransactionReceipt): DeploymentInfo[] {
	const addressBytesLen = 40;
	return (
		receipt.logs
			.filter(
				log =>
					log.topics &&
					log.topics[0] ===
						contractFunctionId('ContractDeployed(address,bytes32,address)') &&
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
 * @remarks The implementation of `create2Address` in ZKsync Era may differ slightly from Ethereum.
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
		.keccak256(
			concat([prefix, web3Utils.padLeft(sender, 32 * 2), salt, bytecodeHash, inputHash]),
		)
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

let ZkSyncABIEvents: Array<AbiEventFragment & { signature: string }> | null = null;

const getZkSyncEvents = () => {
	if (ZkSyncABIEvents === null) {
		ZkSyncABIEvents = IZkSyncABI.filter(e => e.type === 'event').map(e => ({
			...e,
			signature: encodeEventSignature(jsonInterfaceMethodToString(e)),
		}));
	}
	return ZkSyncABIEvents;
};

/**
 * Returns the hash of the L2 priority operation from a given transaction receipt and L2 address.
 * @param txReceipt The receipt of the L1 transaction.
 * @param zkSyncAddress The address of the ZKsync Era main contract.
 * @returns The hash of the L2 priority operation.
 */
export function getL2HashFromPriorityOp(
	txReceipt: web3Types.TransactionReceipt,
	zkSyncAddress: web3.Address,
): string {
	let txHash: string | null = null;
	for (const log of txReceipt.logs) {
		if (!isAddressEq(log.address as string, zkSyncAddress)) {
			continue;
		}

		try {
			const decoded = decodeEventABI(ALL_EVENTS_ABI, log as LogsInput, getZkSyncEvents());
			if (decoded && decoded.returnValues && decoded.returnValues.txHash !== null) {
				txHash = decoded.returnValues.txHash ? String(decoded.returnValues.txHash) : null;
			}
		} catch {
			// skip
		}
	}
	if (!txHash) {
		throw new Error('Failed to parse tx logs!');
	}

	return txHash;
}

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
	context: web3.Web3, // or maybe use RpcMethods?
): Promise<string> {
	if (isAddressEq(l1TokenAddress, LEGACY_ETH_ADDRESS)) {
		l1TokenAddress = ETH_ADDRESS_IN_CONTRACTS;
	}
	const token = new context.eth.Contract(IERC20ABI, l1TokenAddress);
	const name = isAddressEq(l1TokenAddress, ETH_ADDRESS_IN_CONTRACTS)
		? 'Ether'
		: await token.methods.name().call();
	const symbol = isAddressEq(l1TokenAddress, ETH_ADDRESS_IN_CONTRACTS)
		? 'ETH'
		: await token.methods.symbol().call();
	const decimals = isAddressEq(l1TokenAddress, ETH_ADDRESS_IN_CONTRACTS)
		? 18
		: await token.methods.decimals().call();

	return web3Abi.encodeParameters(
		['string', 'string', 'uint256'],
		[name, symbol, Number(decimals)],
	);
}

/**
 * Returns the calldata sent by an L1 ERC20 bridge to its L2 counterpart during token bridging.
 *
 * @param l1TokenAddress The token address on L1.
 * @param l1Sender The sender address on L1.
 * @param l2Receiver The recipient address on L2.
 * @param amount The gas fee for the number of tokens to bridge.
 * @param bridgeData Additional bridge data.
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
			typeof message === 'string'
				? message
				: web3Utils.bytesToHex(message as unknown as string),
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
 *            web3,
 *            ADDRESS,
 *            message,
 *            signature,
 *        );
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
	const typedDataStruct: web3Types.Eip712TypedData = {
		domain,
		types,
		primaryType: 'Transaction',
		message: value,
	};

	return isSignatureCorrect(context, address, typedDataStruct, signature);
}

/**
 * Returns an estimation of the L2 gas required for token bridging via the default ERC20 bridge.
 *
 * @param providerL1 The Ethers provider for the L1 network.
 * @param providerL2 The ZKsync provider for the L2 network.
 * @param token The address of the token to be bridged.
 * @param amount The deposit amount.
 * @param to The recipient address on the L2 network.
 * @param from The sender address on the L1 network.
 * @param gasPerPubdataByte The current gas per byte of pubdata.
 *
 * @see
 * {@link https://docs.zksync.io/build/developer-reference/bridging-asset.html#default-bridges Default bridges documentation}.
 */
export async function estimateDefaultBridgeDepositL2Gas(
	providerL1: web3.Web3,
	providerL2: Web3ZkSyncL2,
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

		return estimateCustomBridgeDepositL2Gas(
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
 * @param providerL2 The ZKsync provider for the L2 network.
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
 */
export async function estimateCustomBridgeDepositL2Gas(
	providerL2: Web3ZkSyncL2,
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
	return providerL2.estimateL1ToL2Execute({
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

export async function waitTxReceipt(web3Eth: Web3Eth, txHash: string): Promise<TransactionReceipt> {
	while (true) {
		try {
			const receipt = await ethRpcMethods.getTransactionReceipt(
				web3Eth.requestManager,
				txHash,
			);
			if (receipt && receipt.blockNumber) {
				return receipt;
			}
		} catch {}
		await sleep(500);
	}
}
export async function waitTxByHashConfirmation(
	web3Eth: Web3Eth,
	txHash: TransactionHash,
	waitConfirmations = 1,
): Promise<TransactionReceipt> {
	const receipt = await waitTxReceipt(web3Eth, txHash);
	while (true) {
		const blockNumber = await web3Eth.getBlockNumber();
		if (toBigInt(blockNumber) - toBigInt(receipt.blockNumber) + 1n >= waitConfirmations) {
			return receipt;
		}
		await sleep(500);
	}
}

export const getPriorityOpResponse = (
	context: Web3ZkSyncL1 | Web3ZkSyncL2,
	l1TxPromise: Promise<TransactionHash>,
	contextL2?: Web3ZkSyncL2,
): Promise<PriorityOpResponse> => {
	if (context instanceof Web3ZkSyncL1) {
		return getPriorityOpL1Response(context, l1TxPromise, contextL2);
	} else {
		return getPriorityOpL2Response(context, l1TxPromise);
	}
};

export const getPriorityOpL1Response = async (
	context: Web3ZkSyncL1,
	l1TxPromise: Promise<TransactionHash>,
	contextL2?: Web3ZkSyncL2,
): Promise<PriorityOpResponse> => {
	const hash = await l1TxPromise;
	return {
		hash,
		waitL1Commit: async () => {
			return waitTxByHashConfirmation(context.eth, hash, 1);
		},
		wait: async () => {
			return waitTxByHashConfirmation(context.eth, hash, 1);
		},
		waitFinalize: async () => {
			const receipt = await waitTxReceipt(context.eth, hash);
			const l2TxHash = await (contextL2 as Web3ZkSyncL2).getL2TransactionFromPriorityOp(
				receipt,
			);

			if (!contextL2) {
				return {
					transactionHash: l2TxHash,
				} as TransactionReceipt;
			}

			return await waitTxByHashConfirmationFinalized(contextL2.eth, l2TxHash, 1);
		},
	};
};

export const getPriorityOpL2Response = async (
	context: Web3ZkSyncL2,
	txPromise: Promise<TransactionHash>,
): Promise<PriorityL2OpResponse> => {
	const hash = await txPromise;
	return {
		hash,
		wait: async () => {
			return waitTxByHashConfirmation(context.eth, hash, 1);
		},
		waitFinalize: async () => {
			return await waitTxByHashConfirmationFinalized(context.eth, hash, 1, 'finalized');
		},
	};
};

export async function waitTxByHashConfirmationFinalized(
	web3Eth: Web3Eth,
	txHash: TransactionHash,
	waitConfirmations = 1,
	blogTag?: BlockNumberOrTag,
): Promise<TransactionReceipt> {
	while (true) {
		const receipt = await waitTxReceipt(web3Eth, txHash);
		const block = await web3Eth.getBlock(blogTag ?? 'finalized');
		if (toBigInt(block.number) - toBigInt(receipt.blockNumber) + 1n >= waitConfirmations) {
			return receipt;
		}
		await sleep(500);
	}
}

/**
 * A simple hashing function which operates on UTF-8 strings to compute an 32-byte identifier.
 * This simply computes the UTF-8 bytes and computes the [[keccak256]].
 * @param value
 */
export function id(value: string): string {
	return keccak256(toUtf8Bytes(value));
}

export function dataSlice(data: Bytes, start?: number, end?: number): string {
	const bytes = toBytes(data);
	if (end != null && end > bytes.length) {
		throw new Error('cannot slice beyond data bounds');
	}
	return web3Utils.toHex(
		bytes.slice(start == null ? 0 : start, end == null ? bytes.length : end),
	);
}

export function toUtf8Bytes(str: string): Uint8Array {
	if (typeof str !== 'string') {
		throw new Error(`invalid string value ${str}`);
	}

	let result: Array<number> = [];
	for (let i = 0; i < str.length; i++) {
		const c = str.charCodeAt(i);

		if (c < 0x80) {
			result.push(c);
		} else if (c < 0x800) {
			result.push((c >> 6) | 0xc0);
			result.push((c & 0x3f) | 0x80);
		} else if ((c & 0xfc00) == 0xd800) {
			i++;
			const c2 = str.charCodeAt(i);

			if (!(i < str.length && (c2 & 0xfc00) === 0xdc00)) {
				throw new Error(`invalid surrogate pair ${str}`);
			}

			// Surrogate Pair
			const pair = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
			result.push((pair >> 18) | 0xf0);
			result.push(((pair >> 12) & 0x3f) | 0x80);
			result.push(((pair >> 6) & 0x3f) | 0x80);
			result.push((pair & 0x3f) | 0x80);
		} else {
			result.push((c >> 12) | 0xe0);
			result.push(((c >> 6) & 0x3f) | 0x80);
			result.push((c & 0x3f) | 0x80);
		}
	}

	return new Uint8Array(result);
}
export function getAddress(address: string): string {
	if (!isAddress(address)) {
		throw new Error(`Invalid address ${address}`);
	}
	return address;
}
async function checkAddress(target: any, promise: Promise<null | string>): Promise<string> {
	const result = await promise;
	if (result == null || result === '0x0000000000000000000000000000000000000000') {
		if (typeof target === 'string') {
			throw new Error(`ENS name resolution failed for ${target}`);
		}
		throw new Error(`invalid AddressLike value; did not resolve to a value address`);
	}
	return getAddress(result);
}
export interface Addressable {
	/**
	 *  Get the object address.
	 */
	getAddress(): Promise<string>;
}
export function resolveAddress(
	target: Address | Addressable | Promise<string>,
	resolver?: null | NameResolver,
): string | Promise<string> {
	if (typeof target === 'string') {
		if (target.match(/^0x[0-9a-f]{40}$/i)) {
			return getAddress(target);
		}

		if (resolver == null) {
			throw new Error('ENS name resolution requires a provider');
		}

		return checkAddress(target, resolver.resolveName(target));
	} else if (target && typeof (target as Addressable).getAddress === 'function') {
		return checkAddress(target, (target as Addressable).getAddress());
	} else if (target && typeof (target as Promise<string>).then === 'function') {
		return checkAddress(target, target as Promise<string>);
	}

	throw new Error('unsupported addressable value');
}
