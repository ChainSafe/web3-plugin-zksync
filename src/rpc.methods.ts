import type { Web3RequestManager } from 'web3-core';
import { format } from 'web3-utils';
import type { Address, Bytes, HexString32Bytes, Numbers, TransactionWithSenderAPI } from 'web3';
import { DEFAULT_RETURN_FORMAT } from 'web3';
import type { DataFormat } from 'web3-types/src/data_format_types';
import type {
	BatchDetails,
	BlockDetails,
	BridgeAddresses,
	EstimateFee,
	L2ToL1Proof,
	Proof,
	RawBlockTransaction,
	TransactionDetails,
	WalletBalances,
} from './types';
import {
	AddressSchema,
	BatchDetailsSchema,
	BlockDetailsSchema,
	BridgeAddressesSchema,
	BytesArraySchema,
	BytesSchema,
	EstimateFeeSchema,
	IntSchema,
	L2ToL1ProofSchema,
	ProofSchema,
	RawBlockTransactionSchema,
	TransactionDetailsSchema,
	UintSchema,
} from './schemas';

// The ZkSync methods described here https://docs.zksync.io/build/api.html

export class RpcMethods {
	requestManager: Web3RequestManager<unknown>;

	constructor(requestManager: Web3RequestManager<unknown>) {
		this.requestManager = requestManager;
	}

	private async _send(method: string, params: unknown[]): Promise<unknown> {
		return this.requestManager.send({
			method,
			params,
		});
	}

	public async l1ChainId(returnFormat: DataFormat = DEFAULT_RETURN_FORMAT): Promise<bigint> {
		return format(IntSchema, await this._send('zks_L1ChainId', []), returnFormat) as bigint;
	}

	public async getL1BatchNumber(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<bigint> {
		return format(IntSchema, await this._send('zks_L1BatchNumber', []), returnFormat) as bigint;
	}

	public async getL1BatchDetails(
		number: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BatchDetails> {
		return format(
			BatchDetailsSchema,
			await this._send('zks_getL1BatchDetails', [number]),
			returnFormat,
		) as BatchDetails;
	}

	public async getBlockDetails(
		number: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BlockDetails> {
		return format(
			BlockDetailsSchema,
			await this._send('zks_getBlockDetails', [number]),
			returnFormat,
		) as BlockDetails;
	}

	public async getTransactionDetails(
		txHash: Bytes,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<TransactionDetails> {
		return format(
			TransactionDetailsSchema,
			await this._send('zks_getTransactionDetails', [txHash]),
			returnFormat,
		) as TransactionDetails;
	}

	public async getBytecodeByHash(
		bytecodeHash: Bytes,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Uint8Array> {
		return format(
			BytesSchema,
			await this._send('zks_getBytecodeByHash', [bytecodeHash]),
			returnFormat,
		) as Uint8Array;
	}

	public async getRawBlockTransactions(
		number: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<RawBlockTransaction[]> {
		const result = await this._send('zks_getRawBlockTransactions', [number]);
		if (Array.isArray(result)) {
			return result.map(tx => {
				return format(RawBlockTransactionSchema, tx, returnFormat) as RawBlockTransaction;
			});
		}
		return [];
	}
	public async estimateFee(
		transaction: Partial<TransactionWithSenderAPI>,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<EstimateFee> {
		return format(
			EstimateFeeSchema,
			await this._send('zks_estimateFee', [transaction]),
			returnFormat,
		) as EstimateFee;
	}
	public async estimateGasL1ToL2(
		transaction: Partial<TransactionWithSenderAPI>,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Numbers> {
		return format(
			UintSchema,
			await this._send('zks_estimateGasL1ToL2', [transaction]),
			returnFormat,
		) as Numbers;
	}

	public async getAllAccountBalances(
		address: Address,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<WalletBalances> {
		const res = (await this._send('zks_getAllAccountBalances', [address])) as WalletBalances;
		if (!res) {
			return {};
		}
		for (let i = 0; i < Object.keys(res).length; i++) {
			res[Object.keys(res)[i]] = format(
				UintSchema,
				res[Object.keys(res)[i]],
				returnFormat,
			) as Numbers;
		}

		return res;
	}

	public async getMainContract(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Address> {
		return format(
			AddressSchema,
			await this._send('zks_getMainContract', []),
			returnFormat,
		) as Address;
	}

	public async getL1BatchBlockRange(
		number: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Bytes[]> {
		return format(
			BytesArraySchema,
			await this._send('zks_getL1BatchBlockRange', [number]),
			returnFormat,
		) as Bytes[];
	}

	public async getProof(
		address: Address,
		keys: string[],
		l1BatchNumber: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Proof> {
		const res = (await this._send('zks_getProof', [address, keys, l1BatchNumber])) as Proof;
		const result = format(ProofSchema, res, returnFormat) as Proof;
		result.storageProof = [];
		for (let i = 0; i < res.storageProof.length; i++) {
			result.storageProof[i] = format(
				{
					type: 'object',
					properties: ProofSchema.properties.storageProof.properties,
				},
				res.storageProof[i],
				returnFormat,
			);
		}

		return result;
	}

	public async getTestnetPaymaster(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Address> {
		return format(
			AddressSchema,
			await this._send('zks_getTestnetPaymaster', []),
			returnFormat,
		) as Address;
	}
	public async getL2ToL1LogProof(
		txHash: HexString32Bytes,
		l2ToL1LogIndex?: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<L2ToL1Proof> {
		const params: [HexString32Bytes, number?] = [txHash];
		if (l2ToL1LogIndex) {
			params.push(l2ToL1LogIndex);
		}
		return format(
			L2ToL1ProofSchema,
			await this._send('zks_getL2ToL1LogProof', params),
			returnFormat,
		) as L2ToL1Proof;
	}

	public async getBridgeContracts(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BridgeAddresses> {
		return format(
			BridgeAddressesSchema,
			await this._send('zks_getBridgeContracts', []),
			returnFormat,
		) as BridgeAddresses;
	}
}
