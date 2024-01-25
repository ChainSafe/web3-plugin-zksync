import {Address, Bytes, Numbers} from "web3";

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
    number: number;
    timestamp: number;
    l1BatchNumber: number;
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
                gas_limit: BigInt;
                max_fee_per_gas: BigInt;
                max_priority_fee_per_gas: BigInt;
                gas_per_pubdata_limit: BigInt;
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
        value: BigInt;
    };
    received_timestamp_ms: number;
    raw_bytes: string;
}
