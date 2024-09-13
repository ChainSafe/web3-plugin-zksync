import type { FeeMarketEIP1559TxData } from 'web3-eth-accounts';
import type { Contract } from 'web3-eth-contract';
import type {
	Bytes,
	HexString,
	Numbers,
	Transaction,
	TransactionReceipt,
	Log,
	TransactionReceiptBase,
} from 'web3-types';

import type { Web3ZKsyncL2 } from './web3zksync-l2';
import type { IERC20ABI } from './contracts/IERC20';
import type { IL2BridgeABI } from './contracts/IL2Bridge';
import type { IZkSyncABI } from './contracts/IZkSyncStateTransition';
import type { IBridgehubABI } from './contracts/IBridgehub';
import type { IContractDeployerABI } from './contracts/IContractDeployer';
import type { IL1MessengerABI } from './contracts/IL1Messenger';
import type { IERC1271ABI } from './contracts/IERC1271';
import type { IL1BridgeABI } from './contracts/IL1ERC20Bridge';
import type { INonceHolderABI } from './contracts/INonceHolder';
import type * as web3Types from 'web3-types';
import * as Web3 from 'web3';

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type { Bytes, HexString, Numbers } from 'web3-types';
export interface TransactionOverrides extends Omit<Transaction, 'to' | 'data' | 'input'> {}

export const ZeroAddress: Address = '0x0000000000000000000000000000000000000000';
export const ZeroHash: string =
	'0x0000000000000000000000000000000000000000000000000000000000000000';

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

/**
 * A transaction request that includes additional features for interacting with ZKsync Era.
 */
export declare type TransactionRequest = DeepWriteable<
	Transaction & {
		/** The custom data for EIP712 transaction metadata. */
		customData?: null | Eip712Meta;
		type?: Numbers;
	}
>;

/**
 * Interface representation of priority op response with a function
 * that waits to commit a L1 transaction, including when given on optional confirmation number.
 */
export interface PriorityL1OpResponse {
	/**
	 * Waits for the L1 transaction to be committed, including waiting for the specified number of confirmations.
	 * @param confirmation The number of confirmations to wait for. Defaults to 1.
	 * @returns A promise that resolves to the transaction receipt once committed.
	 */
	waitL1Commit(confirmation?: number): Promise<TransactionReceipt>;
	wait(confirmation?: number): Promise<TransactionReceipt>;
	waitFinalize(confirmation?: number): Promise<TransactionReceipt>;
	hash: string;
}
export interface PriorityL2OpResponse {
	hash: string;
	wait(confirmation?: number): Promise<TransactionReceipt>;
	waitFinalize(confirmation?: number): Promise<TransactionReceipt>;
}
export type PriorityOpResponse = PriorityL1OpResponse | PriorityL2OpResponse;
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
export interface BatchDetails {
	number: number;
	timestamp: number;
	l1TxCount: number;
	l2TxCount: number;
	rootHash?: string;
	status: string;
	commitTxHash?: string;
	committedAt?: Date;
	proveTxHash?: string;
	provenAt?: Date;
	executeTxHash?: string;
	executedAt?: Date;
	l1GasPrice: number;
	l2FairGasPrice: number;
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
	maxFeePerGas?: bigint;
	/** The maximum priority fee per gas for L1 transaction. */
	maxPriorityFeePerGas?: bigint;
	/** The gas price for L2 transaction. */
	gasPrice?: bigint;
	/** The base cost of the deposit transaction on L2. */
	baseCost: bigint;
	/** The gas limit for L1 transaction. */
	l1GasLimit: bigint;
	/** The gas limit for L2 transaction. */
	l2GasLimit: bigint;
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
	l1BatchNumber: number | null | Numbers;
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
export type PayloadSigner = (payload: Bytes, secret?: any, provider?: Web3ZKsyncL2) => string;

export interface WalletBalances {
	[key: Address]: Numbers;
}
/**
 * Populates missing fields in a transaction with default values.
 *
 * @param transaction The transaction that needs to be populated.
 * @param [secret] The secret used for populating the transaction.
 * @param [provider] The provider is used to fetch data from the network if it is required for signing.
 * @returns A promise that resolves to the populated transaction.
 */
export type TransactionBuilder = (
	transaction: TransactionRequest,
	secret?: any,
	provider?: Web3ZKsyncL2,
) => Promise<TransactionRequest>;

/**
 * Encapsulates the required input parameters for creating a signer for `SmartAccount`.
 */
export interface SmartAccountSigner {
	/** Address to which the `SmartAccount` is bound. */
	address: string;
	/** Secret in any form that can be used for signing different payloads. */
	secret: any;
	/** Custom method for signing different payloads. */
	payloadSigner?: PayloadSigner;
	/** Custom method for populating transaction requests. */
	transactionBuilder?: TransactionBuilder;
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
	l1SharedDefaultBridge: Address;
	l2SharedDefaultBridge: Address;
}

export interface ContractsAddresses extends BridgeAddresses {
	mainContract: string;
	bridgehubContractAddress: string;
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

export interface TypedDataDomain {
	/**
	 *  The human-readable name of the signing domain.
	 */
	name?: null | string;

	/**
	 *  The major version of the signing domain.
	 */
	version?: null | string;

	/**
	 *  The chain ID of the signing domain.
	 */
	chainId?: null | Numbers;

	/**
	 *  The the address of the contract that will verify the signature.
	 */
	verifyingContract?: null | string;

	/**
	 *  A salt used for purposes decided by the specific domain.
	 */
	salt?: null | Bytes;
}

/**
 *  A specific field of a structured [[link-eip-712]] type.
 */
export interface TypedDataField {
	/**
	 *  The field name.
	 */
	name: string;

	/**
	 *  The type of the field.
	 */
	type: string;
}

export type Eip712TxData = Omit<FeeMarketEIP1559TxData, 'gasPrice'> & {
	/** The custom data for EIP712 transaction metadata. */
	eip712Meta?: null | Eip712Meta;
	customData?: null | Eip712Meta;
	from?: Address;
	hash?: string;
	signature?: string;
	/**
	 * The transaction's gas price. To be used if maxPriorityFeePerGas and maxFeePerGas were not provided
	 */
	gasPrice?: Numbers | Uint8Array | null;
};

export type Eip712SignedInput = FeeMarketEIP1559TxData & {
	customData?: null | Eip712Meta;
	data: Bytes;
	value: Numbers;
	nonce: Numbers;
	gasLimit: Numbers;
	maxFeePerGas: Numbers;
	maxPriorityFeePerGas: Numbers;
	from?: Address;
	txType: Numbers;
	gasPerPubdataByteLimit?: Numbers;
	paymaster: Address;
	factoryDeps: Bytes[];
	paymasterInput: Bytes;
	[key: string]: unknown;
};

export type ZKTransactionReceiptLog = Log & {
	l1BatchNumber: Numbers;
};

export type ZKTransactionReceipt = TransactionReceiptBase<
	Numbers,
	Bytes,
	Bytes,
	ZKTransactionReceiptLog
> & {
	l1BatchNumber: Numbers;
	l1BatchTxIndex: Numbers;
	l2ToL1Logs: L2ToL1Log[];
};

export interface OverridesReadOnly extends Omit<TransactionRequest, 'to' | 'data'> {}
export type Overrides = DeepWriteable<OverridesReadOnly>;
export interface NameResolver {
	/**
	 *  Resolve to the address for the ENS %%name%%.
	 *
	 *  Resolves to ``null`` if the name is unconfigued. Use
	 *  [[resolveAddress]] (passing this object as %%resolver%%) to
	 *  throw for names that are unconfigured.
	 */
	resolveName(name: string): Promise<null | string>;
}

export type ZKSyncContractsCollection = {
	Generic: {
		/**
		 * The web3.js Contract instance for the `IERC20` interface, which is utilized for interacting with ERC20 tokens.
		 */
		IERC20Contract: Contract<typeof IERC20ABI>;
		/**
		 * The web3.js Contract instance for the `IERC1271` interface, which is utilized for signature validation by contracts.
		 */
		IERC1271Contract: Contract<typeof IERC1271ABI>;
	};
	L1: {
		/**
		 * The web3.js Contract instance for the `ZkSync` interface.
		 */
		ZkSyncMainContract: Contract<typeof IZkSyncABI>;
		/**
		 * The ABI of the `Bridgehub` interface.
		 */
		BridgehubContract: Contract<typeof IBridgehubABI>;
		/**
		 * The web3.js Contract instance for the `IL1Bridge` interface, which is utilized for transferring ERC20 tokens from L1 to L2.
		 */
		L1BridgeContract: Contract<typeof IL1BridgeABI>;
	};
	L2: {
		/**
		 * The web3.js Contract instance for the `IContractDeployer` interface, which is utilized for deploying smart contracts.
		 */
		ContractDeployerContract: Contract<typeof IContractDeployerABI>;
		/**
		 * The web3.js Contract instance for the `IL1Messenger` interface, which is utilized for sending messages from the L2 to L1.
		 */
		L1MessengerContract: Contract<typeof IL1MessengerABI>;
		/**
		 * The web3.js Contract instance for the `IL2Bridge` interface, which is utilized for transferring ERC20 tokens from L2 to L1.
		 */
		L2BridgeContract: Contract<typeof IL2BridgeABI>;

		/**
		 * The web3.js Contract instance for the `INonceHolder` interface, which is utilized for managing deployment nonces.
		 */
		NonceHolderContract: Contract<typeof INonceHolderABI>;
	};
};

export type RawTransactionWithDetailedOutput = {
	transactionHash: string;
	storageLogs: {
		address: string;
		key: string;
		writtenValue: string;
	}[];
	events: {
		address: string;
		topics: string[];
		data: string;
		blockHash: string;
		blockNumber: Numbers;
		l1BatchNumber: Numbers;
		transactionHash: string;
		transactionIndex: Numbers;
		logIndex: Numbers;
		transactionLogIndex: Numbers;
		logType: string;
		removed: boolean;
	}[];
};

export type ProtocolVersion = {
	version_id: number;
	timestamp: number;
	verification_keys_hashes: {
		params: {
			recursion_node_level_vk_hash: string;
			recursion_leaf_level_vk_hash: string;
			recursion_circuits_set_vks_hash: string;
		};
		recursion_scheduler_level_vk_hash: string;
	};
	base_system_contracts: {
		bootloader: string;
		default_aa: string;
	};
	l2_system_upgrade_tx_hash: string;
};

export type FeeParams = {
	V2: {
		config: {
			minimal_l2_gas_price: Numbers;
			compute_overhead_part: Numbers;
			pubdata_overhead_part: Numbers;
			batch_overhead_l1_gas: Numbers;
			max_gas_per_batch: Numbers;
			max_pubdata_per_batch: Numbers;
		};
		l1_gas_price: Numbers;
		l1_pubdata_price: Numbers;
	};
};
export type DepositTransactionDetails = {
	/**
	 * The address of the token to deposit.
	 */
	token: Address;
	/**
	 * The amount of the token to deposit.
	 */
	amount: web3Types.Numbers;
	/**
	 * The address that will receive the deposited tokens on L2.
	 */
	to?: Address;
	/**
	 * If the ETH value passed with the transaction is not explicitly stated in the overrides, this
	 * field will be equal to the tip the operator will receive on top of the base cost of the
	 * transaction.
	 */
	operatorTip?: web3Types.Numbers;
	/**
	 * The address of the bridge contract to be used.
	 * Defaults to the default ZKsync Era bridge (either `L1EthBridge` or `L1Erc20Bridge`).
	 */
	bridgeAddress?: Address;
	/**
	 * Whether or not token approval should be performed under the hood.
	 * Set this flag to true if you bridge an ERC20 token and didn't call the `approveERC20`
	 * function beforehand.
	 */
	approveERC20?: boolean;
	/**
	 * Whether or not base token approval should be performed under the hood.
	 * Set this flag to true if you bridge a base token and didn't call the `approveERC20` function
	 * beforehand.
	 */
	approveBaseERC20?: boolean;
	/**
	 * Maximum amount of L2 gas that the transaction can consume during execution on L2.
	 */
	l2GasLimit?: web3Types.Numbers;
	/**
	 * The L2 gas price for each published L1 calldata byte.
	 */
	gasPerPubdataByte?: web3Types.Numbers;
	/**
	 * The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 */
	refundRecipient?: Address;
	/**
	 * Transaction's overrides for deposit which may be used to pass L1 `gasLimit`, `gasPrice`,
	 * `value`, etc.
	 */
	overrides?: TransactionOverrides;
	/**
	 * Transaction's overrides for approval of an ERC20 token which may be used to pass L1
	 * `gasLimit`, `gasPrice`, `value`, etc.
	 */
	approveOverrides?: TransactionOverrides;
	/**
	 * Transaction's overrides for approval of a base token which may be used to pass L1
	 * `gasLimit`, `gasPrice`, `value`, etc.
	 */
	approveBaseOverrides?: TransactionOverrides;
	/**
	 * Additional data that can be sent to a bridge.
	 */
	customBridgeData?: web3Types.Bytes;
};

export type WithdrawTransactionDetails = {
	/**
	 * The address of the token.
	 */
	token: Address;
	/**
	 * The amount of the token to withdraw.
	 */
	amount: web3Types.Numbers;
	/**
	 * The address of the recipient on L1.
	 */
	to?: Address;
	from?: Address;
	/**
	 * The address of the bridge contract to be used.
	 */
	bridgeAddress?: Address;
	/**
	 * Paymaster parameters.
	 */
	paymasterParams?: PaymasterParams;
	/**
	 * Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	overrides?: TransactionOverrides;
};

export type TransferTransactionDetails = {
	/**
	 * The address of the recipient.
	 */
	to: Address;
	from?: Address;
	/**
	 * The amount of the token to transfer.
	 */
	amount: web3Types.Numbers;
	/**
	 * The address of the token. Defaults to ETH.
	 */
	token?: Address;
	/**
	 * Paymaster parameters.
	 */
	paymasterParams?: PaymasterParams;
	/**
	 * Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	overrides?: TransactionOverrides;
};

export type L2GasLimitDetails = {
	token: Address;
	amount: web3Types.Numbers;
	to?: Address;
	operatorTip?: web3Types.Numbers;
	bridgeAddress?: Address;
	l2GasLimit?: web3Types.Numbers;
	gasPerPubdataByte?: web3Types.Numbers;
	customBridgeData?: web3Types.Bytes;
	refundRecipient?: Address;
	overrides?: TransactionOverrides;
};

export type FullRequiredDepositFeeDetails = {
	/**
	 * The address of the token to deposit.
	 */
	token: Address;
	/**
	 * The address that will receive the deposited tokens on L2.
	 */
	to?: Address;
	/**
	 * The address of the bridge contract to be used. Defaults to the default ZKsync Era bridge
	 * (either `L1EthBridge` or `L1Erc20Bridge`).
	 */
	bridgeAddress?: Address;
	/**
	 * Additional data that can be sent to a bridge.
	 */
	customBridgeData?: web3Types.Bytes;
	/**
	 * The L2 gas price for each published L1 calldata byte.
	 */
	gasPerPubdataByte?: web3Types.Numbers;
	/**
	 * Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	overrides?: TransactionOverrides;
};

export type BaseCostDetails = {
	/**
	 * The gasLimit for the L2 contract call.
	 */
	gasLimit: web3Types.Numbers;
	/**
	 * The L2 gas price for each published L1 calldata byte.
	 */
	gasPerPubdataByte?: web3Types.Numbers;
	/**
	 * The L1 gas price of the L1 transaction that will send the request for an execute call.
	 */
	gasPrice?: web3Types.Numbers;
	chainId?: web3Types.Numbers;
};

export type TokenAllowanceResult = { token: Address; allowance: web3Types.Numbers };

export type RequestExecuteDetails = {
	/**
	 * The L2 contract to be called.
	 */
	contractAddress: Address;
	/**
	 * The input of the L2 transaction.
	 */
	calldata: string;
	/**
	 * Maximum amount of L2 gas that transaction can consume during execution on L2.
	 */
	l2GasLimit?: web3Types.Numbers;
	/**
	 * The amount of base token that needs to be minted on non-ETH-based L2.
	 */
	mintValue?: web3Types.Numbers;
	/**
	 * `msg.value` of L2 transaction.
	 */
	l2Value?: web3Types.Numbers;
	/**
	 * An array of L2 bytecodes that will be marked as known on L2.
	 */
	factoryDeps?: web3Types.Bytes[];
	/**
	 * If the ETH value passed with the transaction is not explicitly stated in the overrides, this
	 * field will be equal to the tip the operator will receive on top of the base cost of the
	 * transaction.
	 */
	operatorTip?: web3Types.Numbers;
	/**
	 * The L2 gas price for each published L1 calldata byte.
	 */
	gasPerPubdataByte?: web3Types.Numbers;
	/**
	 * The address on L2 that will receive the refund for the transaction. If the transaction
	 * fails, it will also be the address to receive `l2Value`.
	 */
	refundRecipient?: Address;
	/**
	 * Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	overrides?: TransactionOverrides;
};
export type EstimateL1ToL2ExecuteDetails = {
	/**
	 * The address of the contract.
	 */
	contractAddress: web3Types.Address;
	/**
	 * The transaction call data.
	 */
	calldata: string;
	/**
	 * The caller's address.
	 */
	caller?: web3Types.Address;
	/**
	 * The current L2 gas value.
	 */
	l2Value?: web3Types.Numbers;
	/**
	 * An array of bytes containing contract bytecode.
	 */
	factoryDeps?: web3Types.Bytes[];
	/**
	 * The current gas per byte value.
	 */
	gasPerPubdataByte?: web3Types.Numbers;
	/**
	 * Transaction overrides including `gasLimit`, `gasPrice`, and `value`.
	 */
	overrides?: TransactionOverrides;
};

export type L2BridgeContractsResult = {
	erc20: Web3.Contract<typeof IL2BridgeABI>;
	weth: Web3.Contract<typeof IL2BridgeABI>;
	shared: Web3.Contract<typeof IL2BridgeABI>;
};

export type DefaultBridgeAddressesResult = {
	erc20L1: string;
	erc20L2: string;
	wethL1: string;
	wethL2: string;
	sharedL1: string;
	sharedL2: string;
};
