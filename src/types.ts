import type { Address, Bytes, HexString, Numbers } from 'web3';

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

export interface Proof {
	address: Address;
	storageProof: {
		index: Numbers;
		key: HexString;
		value: HexString;
		proof: HexString[];
	}[];
}

export interface EstimateFee {
	gas_limit: Numbers;
	gas_per_pubdata_limit: Numbers;
	max_fee_per_gas: Numbers;
	max_priority_fee_per_gas: Numbers;
}
