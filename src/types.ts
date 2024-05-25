export type { Bytes, HexString, Numbers } from 'web3';
import { Bytes, HexString, Numbers } from 'web3-types';

import { EIP1193Provider } from 'web3';

import { FeeMarketEIP1559TxData } from 'web3-eth-accounts';

import { RpcMethods } from './rpc.methods';

/** 0x-prefixed, hex encoded, ethereum account address. */
export type Address = string;

/** 0x-prefixed, hex encoded, ECDSA signature. */
export type Signature = string;

/** Ethereum network. */
export enum Network {
	Mainnet = 1,
	Ropsten = 3,
	Rinkeby = 4,
	Goerli = 5,
	Sepolia = 6,
	Localhost = 9,
	EraTestNode = 10,
}

/** Enumerated list of priority queue types. */
export enum PriorityQueueType {
	Deque = 0,
	HeapBuffer = 1,
	Heap = 2,
}

/** Enumerated list of priority operation tree types. */
export enum PriorityOpTree {
	Full = 0,
	Rollup = 1,
}

/** Enumerated list of transaction status types. */
export enum TransactionStatus {
	/** Transaction not found. */
	NotFound = 'not-found',
	/** Transaction is processing. */
	Processing = 'processing',
	/** Transaction has been committed. */
	Committed = 'committed',
	/** Transaction has been finalized. */
	Finalized = 'finalized',
}

/** Type defining a paymaster by its address and the bytestream input. */
export type PaymasterParams = {
	/** The address of the paymaster. */
	paymaster: Address;
	/** The bytestream input for the paymaster. */
	paymasterInput: Bytes;
};

/** Contains EIP712 transaction metadata. */
export type Eip712Meta = {
	/** The maximum amount of gas the user is willing to pay for a single byte of pubdata. */
	gasPerPubdata?: Numbers;
	/** An array of bytes containing the bytecode of the contract being deployed and any related contracts it can deploy. */
	factoryDeps?: Bytes[];
	/** Custom signature used for cases where the signer's account is not an EOA. */
	customSignature?: Bytes;
	/** Parameters for configuring the custom paymaster for the transaction. */
	paymasterParams?: PaymasterParams;
};

/**
 * Specifies a specific block. This can be represented by:
 * - A numeric value (number, bigint, or hexadecimal string) representing the block height, where the genesis block is block 0.
 *   A negative value indicates the block number should be deducted from the most recent block.
 * - A block hash as a string, specifying a specific block by its block hash.
 *   This allows potentially orphaned blocks to be specified without ambiguity, but many backends do not support this for some operations.
 * - Constants representing special blocks such as 'committed', 'finalized', 'latest', 'earliest', or 'pending'.
 */
export type BlockTag =
	| Numbers
	| string // block hash
	| 'committed'
	| 'finalized'
	| 'latest'
	| 'earliest'
	| 'pending';

/** Pipe-delimited choice of deployment types. */
export type DeploymentType = 'create' | 'createAccount' | 'create2' | 'create2Account';

/** Bridged token. */
export interface Token {
	l1Address: Address;
	l2Address: Address;
	name: string;
	symbol: string;
	decimals: number;
}

/** Represents the transaction fee parameters. */
export interface Fee {
	/** The maximum amount of gas allowed for the transaction. */
	gasLimit: bigint;
	/** The maximum amount of gas the user is willing to pay for a single byte of pubdata. */
	gasPerPubdataLimit: bigint;
	/** The EIP1559 tip per gas. */
	maxPriorityFeePerGas: bigint;
	/** The EIP1559 fee cap per gas. */
	maxFeePerGas: bigint;
}

/** Represents a message proof. */
export interface MessageProof {
	id: number;
	proof: string[];
	root: string;
}

export interface zkSyncTxData extends FeeMarketEIP1559TxData {
	/** The batch number on the L1 network. */
	readonly l1BatchNumber: null | number;
	/** The transaction index within the batch on the L1 network. */
	readonly l1BatchTxIndex: null | number;
}

/**
 * Represents a L2 to L1 transaction log.
 */
export interface L2ToL1Log {
	blockNumber: number;
	blockHash: string;
	l1BatchNumber: number;
	transactionIndex: number;
	shardId: number;
	isService: boolean;
	sender: string;
	key: string;
	value: string;
	transactionHash: string;
	logIndex: number;
}

/** A map containing accounts and their balances. */
export type BalancesMap = { [key: string]: bigint };

/** Represents deployment information. */
export interface DeploymentInfo {
	/** The account responsible for deployment. */
	sender: Address;
	/** The hash of the contract/account bytecode. */
	bytecodeHash: string;
	/** The deployed address of the contract/address. */
	deployedAddress: Address;
}

/**
 * Represents the input data structure for an approval-based paymaster.
 */
export interface ApprovalBasedPaymasterInput {
	/** The type of the paymaster input. */
	type: 'ApprovalBased';
	/** The address of the token to be approved. */
	token: Address;
	/** The minimum allowance required for the token approval. */
	minimalAllowance: Numbers;
	/** The additional input data. */
	innerInput: Bytes;
}

/**
 * Represents the input data structure for a general paymaster.
 */
export interface GeneralPaymasterInput {
	/** The type of the paymaster input. */
	type: 'General';
	/** The additional input data. */
	innerInput: Bytes;
}

/**
 * Represents an Ethereum signature consisting of the components `v`, `r`, and `s`.
 */
export interface EthereumSignature {
	/** The recovery id. */
	v: number;
	/** The "r" value of the signature. */
	r: Bytes;
	/** The "s" value of the signature. */
	s: Bytes;
}

/**
 * Represents the input data structure for a paymaster.
 * It can be either approval-based or general.
 */
export type PaymasterInput = ApprovalBasedPaymasterInput | GeneralPaymasterInput;

/** Enumerated list of account abstraction versions. */
export enum AccountAbstractionVersion {
	/** Used for contracts that are not accounts */
	None = 0,
	/** Used for contracts that are accounts */
	Version1 = 1,
}

/**
 * Enumerated list of account nonce ordering formats.
 */
export enum AccountNonceOrdering {
	/**
	 * Nonces should be ordered in the same way as in externally owned accounts (EOAs).
	 * This means, for instance, that the operator will always wait for a transaction with nonce `X`
	 * before processing a transaction with nonce `X+1`.
	 */
	Sequential = 0,
	/** Nonces can be ordered in arbitrary order. */
	Arbitrary = 1,
}

/**
 * Interface representing contract account information containing details on the supported account abstraction version
 * and nonce ordering format.
 */
export interface ContractAccountInfo {
	/** The supported account abstraction version. */
	supportedAAVersion: AccountAbstractionVersion;
	/** The nonce ordering format. */
	nonceOrdering: AccountNonceOrdering;
}

/** Contains batch information. */
export interface BlockDetails {
	number: bigint;
	timestamp: bigint;
	l1BatchNumber: bigint;
	l1TxCount: bigint;
	l2TxCount: bigint;
	rootHash?: string;
	status: string;
	commitTxHash?: string;
	committedAt?: Date;
	proveTxHash?: string;
	provenAt?: Date;
	executeTxHash?: string;
	executedAt?: Date;
}

/** Contains transaction details information. */
export interface TransactionDetails {
	isL1Originated: boolean;
	status: string;
	fee: Numbers;
	initiatorAddress: Address;
	receivedAt: Date;
	ethCommitTxHash?: string;
	ethProveTxHash?: string;
	ethExecuteTxHash?: string;
}

/** Represents the full deposit fee containing fees for both L1 and L2 transactions. */
export interface FullDepositFee {
	/** The maximum fee per gas for L1 transaction. */
	maxFeePerGas?: BigInt;
	/** The maximum priority fee per gas for L1 transaction. */
	maxPriorityFeePerGas?: BigInt;
	/** The gas price for L2 transaction. */
	gasPrice?: BigInt;
	/** The base cost of the deposit transaction on L2. */
	baseCost: BigInt;
	/** The gas limit for L1 transaction. */
	l1GasLimit: BigInt;
	/** The gas limit for L2 transaction. */
	l2GasLimit: BigInt;
}

/** Represents a raw block transaction. */
export interface RawBlockTransaction {
	common_data: {
		L2: {
			nonce: number;
			fee: {
				gas_limit: bigint;
				max_fee_per_gas: bigint;
				max_priority_fee_per_gas: bigint;
				gas_per_pubdata_limit: bigint;
			};
			initiatorAddress: Address;
			signature: Uint8Array;
			transactionType: string;
			input: {
				hash: string;
				data: Uint8Array;
			};
			paymasterParams: {
				paymaster: Address;
				paymasterInput: Uint8Array;
			};
		};
	};
	execute: {
		calldata: string;
		contractAddress: Address;
		factoryDeps: Bytes[];
		value: bigint;
	};
	received_timestamp_ms: number;
	raw_bytes: string;
}

/** Contains parameters for finalizing the withdrawal transaction. */
export interface FinalizeWithdrawalParams {
	l1BatchNumber: number | null;
	l2MessageIndex: number;
	l2TxNumberInBlock: number | null;
	message: any;
	sender: string;
	proof: string[];
}

/** Represents storage proof */
export interface StorageProof {
	address: Address;
	storageProof: {
		index: Numbers;
		key: HexString;
		value: HexString;
		proof: HexString[];
	}[];
}

/**
 *  Signs various types of payloads, optionally using a some kind of secret.
 *
 *  @param payload The payload that needs to be sign already populated transaction to sign.
 *  @param [secret] The secret used for signing the `payload`.
 *  @param [provider] The provider is used to fetch data from the network if it is required for signing.
 *  @returns A promise that resolves to the serialized signature in hexadecimal format.
 */
export type PayloadSigner = (
	payload: Bytes,
	secret?: any,
	provider?: null | EIP1193Provider<RpcMethods>,
) => Promise<string>;

export interface WalletBalances {
	[key: Address]: Numbers;
}

export interface TokenInfo {
	name: string;
	symbol: string;
	decimals: bigint;
	totalSupply: bigint;
}

export interface BridgeAddresses {
	l1Erc20DefaultBridge: Address;
	l2Erc20DefaultBridge: Address;
	l1WethBridge: Address;
	l2WethBridge: Address;
}

export interface L2ToL1Proof {
	proof: HexString[];
	id: Numbers;
	root: HexString;
}

export interface EstimateFee {
	gas_limit: Numbers;
	gas_per_pubdata_limit: Numbers;
	max_fee_per_gas: Numbers;
	max_priority_fee_per_gas: Numbers;
}
