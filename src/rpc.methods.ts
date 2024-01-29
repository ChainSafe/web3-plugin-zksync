import type { Web3RequestManager } from 'web3-core';
import type { Address, Bytes, HexString32Bytes, Numbers, TransactionWithSenderAPI } from 'web3';
import type {
	BatchDetails,
	BlockDetails,
	BridgeAddresses,
	RawBlockTransaction,
	TransactionDetails,
	WalletBalances,
} from './types';

// The ZkSync methods described here https://docs.zksync.io/build/api.html

export class RpcMethods {
	requestManager: Web3RequestManager<unknown>;

	constructor(requestManager: Web3RequestManager<unknown>) {
		this.requestManager = requestManager;
	}

	private _send(method: string, params: unknown[]): Promise<unknown> {
		return this.requestManager.send({
			method,
			params,
		});
	}

	public async l1ChainId(): Promise<number> {
		return Number(await this._send('zks_L1ChainId', []));
	}

	public async getL1BatchNumber(): Promise<number> {
		return Number(await this._send('zks_L1BatchNumber', []));
	}

	public async getL1BatchDetails(number: number): Promise<BatchDetails> {
		return (await this._send('zks_getL1BatchDetails', [number])) as BatchDetails;
	}

	public async getBlockDetails(number: number): Promise<BlockDetails> {
		return (await this._send('zks_getBlockDetails', [number])) as BlockDetails;
	}

	public async getTransactionDetails(txHash: Bytes): Promise<TransactionDetails> {
		return (await this._send('zks_getTransactionDetails', [txHash])) as TransactionDetails;
	}

	public async getBytecodeByHash(bytecodeHash: Bytes): Promise<Uint8Array> {
		return (await this._send('zks_getBytecodeByHash', [bytecodeHash])) as Uint8Array;
	}

	public async getRawBlockTransactions(number: number): Promise<RawBlockTransaction[]> {
		return (await this._send('zks_getRawBlockTransactions', [number])) as RawBlockTransaction[];
	}

	public async estimateGasFee(transaction: Partial<TransactionWithSenderAPI>): Promise<number> {
		return Number(await this._send('zks_estimateGasFee', [transaction]));
	}

	public async estimateGasL1ToL2(
		transaction: Partial<TransactionWithSenderAPI>,
	): Promise<number> {
		return Number(await this._send('zks_estimateGasL1ToL2', [transaction]));
	}

	public async getAllAccountBalances(address: Address): Promise<WalletBalances> {
		return (await this._send('zks_getAllAccountBalances', [address])) as WalletBalances;
	}

	public async getMainContract(): Promise<string> {
		return String(await this._send('zks_getMainContract', []));
	}

	public async getL1BatchBlockRange(number: number): Promise<unknown> {
		return await this._send('zks_getL1BatchBlockRange', [number]);
	}

	public async getProof(
		address: Address,
		keys: string[],
		l1BatchNumber: number,
	): Promise<unknown> {
		return await this._send('zks_getProof', [address, keys, l1BatchNumber]);
	}

	public async getL2ToL1MsgProof(
		block: Numbers,
		sender: Address,
		msg: HexString32Bytes,
		l2LogPosition: Numbers,
	): Promise<unknown> {
		return await this._send('zks_getL2ToL1MsgProof', [block, sender, msg, l2LogPosition]);
	}

	public async getTestnetPaymaster(): Promise<unknown> {
		return await this._send('zks_getTestnetPaymaster', []);
	}

	public async getL2ToL1LogProof(
		txHash: HexString32Bytes,
		l2ToL1LogIndex?: number,
	): Promise<unknown> {
		const params: [HexString32Bytes, number?] = [txHash];
		if (l2ToL1LogIndex) {
			params.push(l2ToL1LogIndex);
		}
		return await this._send('zks_getL2ToL1LogProof', params);
	}

	public async getBridgeContracts(): Promise<BridgeAddresses> {
		return (await this._send('zks_getBridgeContracts', [])) as BridgeAddresses;
	}
}
