import type { Web3RequestManager } from 'web3-core';
import * as web3Utils from 'web3-utils';
import type * as web3Types from 'web3-types';
import { DEFAULT_RETURN_FORMAT } from 'web3';
import type { DataFormat } from 'web3-types/src/data_format_types';
import {
	BatchDetails,
	BlockDetails,
	BridgeAddresses,
	EstimateFee,
	L2ToL1Proof,
	StorageProof,
	RawBlockTransaction,
	TransactionDetails,
	WalletBalances,
	TransactionRequest,
	Address,
	ProtocolVersion,
	FeeParams,
	Token,
	RawTransactionWithDetailedOutput,
	MessageProof,
} from './types';
import {
	AddressSchema,
	BatchDetailsSchema,
	BlockDetailsSchema,
	BridgeAddressesSchema,
	BytesArraySchema,
	BytesSchema,
	ConfirmedTokensSchema,
	EstimateFeeSchema,
	FeeParamsSchema,
	IntSchema,
	L2ToL1ProofSchema,
	ProofSchema,
	ProtocolVersionSchema,
	RawBlockTransactionSchema,
	RawTransactionWithDetailedOutputSchema,
	TransactionDetailsSchema,
	UintSchema,
} from './schemas';

// The ZkSync methods described here https://docs.zksync.io/build/api.html

// TODO: Think about inheritance from Web3Eth
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

	/**
	 * Returns the chain id of the underlying L1.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async l1ChainId(returnFormat: DataFormat = DEFAULT_RETURN_FORMAT): Promise<bigint> {
		return web3Utils.format(
			IntSchema,
			await this._send('zks_L1ChainId', []),
			returnFormat,
		) as bigint;
	}

	/**
	 * Returns the latest L1 batch number.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getL1BatchNumber(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<bigint> {
		return web3Utils.format(
			IntSchema,
			await this._send('zks_L1BatchNumber', []),
			returnFormat,
		) as bigint;
	}

	/**
	 * Returns data pertaining to a given batch.
	 *
	 * @param number - The layer 1 batch number.
	 * @param returnFormat - The format of the return value.
	 */
	public async getL1BatchDetails(
		number: web3Types.Numbers,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BatchDetails> {
		return web3Utils.format(
			BatchDetailsSchema,
			await this._send('zks_getL1BatchDetails', [
				typeof number === 'number' ? number : Number(web3Utils.toNumber(number)),
			]),
			returnFormat,
		) as BatchDetails;
	}

	/**
	 * Returns additional ZKsync-specific information about the L2 block.
	 *
	 * committed: The batch is closed and the state transition it creates exists on layer 1.
	 * proven: The batch proof has been created, submitted, and accepted on layer 1.
	 * executed: The batch state transition has been executed on L1; meaning the root state has been updated.
	 *
	 * @param number - The number of the block.
	 * @param returnFormat - The format of the return value.
	 */
	public async getBlockDetails(
		number: web3Types.Numbers,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BlockDetails> {
		return web3Utils.format(
			BlockDetailsSchema,
			await this._send('zks_getBlockDetails', [
				typeof number === 'number' ? number : Number(web3Utils.toNumber(number)),
			]),
			returnFormat,
		) as BlockDetails;
	}

	/**
	 * Returns data from a specific transaction given by the transaction hash.
	 *
	 * @param txHash - Transaction hash as string.
	 * @param returnFormat - The format of the return value.
	 */
	public async getTransactionDetails(
		txHash: web3Types.Bytes,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<TransactionDetails> {
		return web3Utils.format(
			TransactionDetailsSchema,
			await this._send('zks_getTransactionDetails', [txHash]),
			returnFormat,
		) as TransactionDetails;
	}

	/**
	 * Returns bytecode of a transaction given by its hash.
	 *
	 * @param bytecodeHash - Bytecode hash as string.
	 * @param returnFormat - The format of the return value.
	 */
	public async getBytecodeByHash(
		bytecodeHash: web3Types.Bytes,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Uint8Array> {
		return web3Utils.format(
			BytesSchema,
			await this._send('zks_getBytecodeByHash', [bytecodeHash]),
			returnFormat,
		) as Uint8Array;
	}

	/**
	 * Returns data of transactions in a block.
	 *
	 * @param number - Block number.
	 * @param returnFormat - The format of the return value.
	 */
	public async getRawBlockTransactions(
		number: web3Types.Numbers,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<RawBlockTransaction[]> {
		const result = await this._send('zks_getRawBlockTransactions', [
			typeof number === 'number' ? number : Number(web3Utils.toNumber(number)),
		]);
		if (Array.isArray(result)) {
			return result.map(tx => {
				return web3Utils.format(
					RawBlockTransactionSchema,
					tx,
					returnFormat,
				) as RawBlockTransaction;
			});
		}
		return [];
	}

	/**
	 * Returns the fee for the transaction.
	 *
	 * @param transaction - Transaction object.
	 * @param returnFormat - The format of the return value.
	 */
	public async estimateFee(
		transaction: Partial<web3Types.TransactionWithSenderAPI>,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<EstimateFee> {
		return web3Utils.format(
			EstimateFeeSchema,
			await this._send('zks_estimateFee', [transaction]),
			returnFormat,
		) as EstimateFee;
	}

	/**
	 * Returns the L1 base token address.
	 */
	async getBaseTokenL1Address(): Promise<web3Types.Address> {
		const baseTokenL1Address = (await this._send(
			'zks_getBaseTokenL1Address',
			[],
		)) as web3Types.Address;

		return web3Utils.toChecksumAddress(baseTokenL1Address);
	}

	/**
	 * Returns the testnet {@link https://docs.zksync.io/build/developer-reference/account-abstraction.html#paymasters paymaster address}
	 * if available, or `null`.
	 *
	 * Calls the {@link https://docs.zksync.io/build/api.html#zks-gettestnetpaymaster zks_getTestnetPaymaster} JSON-RPC method.
	 */
	async getTestnetPaymasterAddress(): Promise<web3Types.Address | null> {
		// Unlike contract's addresses, the testnet paymaster is not cached, since it can be trivially changed
		// on the fly by the server and should not be relied on to be constant
		return (await this._send('zks_getTestnetPaymaster', [])) as web3Types.Address | null;
	}

	/**
	 * Returns an estimate of the gas required for a L1 to L2 transaction.
	 *
	 * @param transaction - Transaction object.
	 * @param returnFormat - The format of the return value.
	 */
	public async estimateGasL1ToL2(
		transaction: Partial<TransactionRequest>,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Numbers> {
		return web3Utils.format(
			UintSchema,
			await this._send('zks_estimateGasL1ToL2', [transaction]),
			returnFormat,
		) as web3Types.Numbers;
	}

	/**
	 * Returns all balances for confirmed tokens given by an account address.
	 *
	 * @param address - The account address.
	 * @param returnFormat - The format of the return value.
	 */
	public async getAllAccountBalances(
		address: web3Types.Address,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<WalletBalances> {
		const res = (await this._send('zks_getAllAccountBalances', [address])) as WalletBalances;
		if (!res) {
			return {};
		}
		for (let i = 0; i < Object.keys(res).length; i++) {
			res[Object.keys(res)[i]] = web3Utils.format(
				UintSchema,
				res[Object.keys(res)[i]],
				returnFormat,
			) as web3Types.Numbers;
		}

		return res;
	}

	/**
	 * Returns the address of the ZKsync Era contract.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getMainContract(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Address> {
		return web3Utils.format(
			AddressSchema,
			await this._send('zks_getMainContract', []),
			returnFormat,
		) as web3Types.Address;
	}

	/**
	 * Returns the range of blocks contained within a batch given by batch number.
	 * The range is given by beginning/end block numbers in hexadecimal.
	 *
	 * @param number The layer 1 batch number.
	 * @param returnFormat - The format of the return value.
	 */
	public async getL1BatchBlockRange(
		number: web3Types.Numbers,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Bytes[]> {
		return web3Utils.format(
			BytesArraySchema,
			await this._send('zks_getL1BatchBlockRange', [
				typeof number === 'number' ? number : Number(web3Utils.toNumber(number)),
			]),
			returnFormat,
		) as web3Types.Bytes[];
	}

	/**
	 * Returns Merkle proofs for one or more storage values at the specified account along with a Merkle proof of their authenticity. This allows to verify that the values have not been tampered with.
	 * More details: https://docs.zksync.io/build/api.html#zks-getproof
	 *
	 * @param address - The account to fetch storage values and proofs for.
	 * @param keys - Vector of storage keys in the account.
	 * @param l1BatchNumber - Number of the L1 batch specifying the point in time at which the requested values are returned.
	 * @param returnFormat - The format of the return value.
	 */
	public async getProof(
		address: web3Types.Address,
		keys: string[],
		l1BatchNumber: web3Types.Numbers,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<StorageProof> {
		const res = (await this._send('zks_getProof', [
			address,
			keys,
			typeof l1BatchNumber === 'number'
				? l1BatchNumber
				: Number(web3Utils.toNumber(l1BatchNumber)),
		])) as StorageProof;
		const result = web3Utils.format(ProofSchema, res, returnFormat) as StorageProof;
		result.storageProof = [];
		for (let i = 0; i < res.storageProof.length; i++) {
			result.storageProof[i] = web3Utils.format(
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

	/**
	 * Given a transaction hash, and an index of the L2 to L1 log produced within the transaction, it returns the proof for the corresponding L2 to L1 log.
	 *
	 * The index of the log that can be obtained from the transaction receipt (it includes a list of every log produced by the transaction)
	 *
	 * @param txHash - Hash of the L2 transaction the L2 to L1 log was produced within.
	 * @param l2ToL1LogIndex - The index of the L2 to L1 log in the transaction (optional).
	 * @param returnFormat - The format of the return value.
	 */
	public async getL2ToL1LogProof(
		txHash: web3Types.HexString32Bytes,
		l2ToL1LogIndex?: web3Types.Numbers,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<L2ToL1Proof> {
		const params: [web3Types.HexString32Bytes, number?] = [txHash];
		if (l2ToL1LogIndex) {
			params.push(
				typeof l2ToL1LogIndex === 'number'
					? l2ToL1LogIndex
					: Number(web3Utils.toNumber(l2ToL1LogIndex)),
			);
		}
		return web3Utils.format(
			L2ToL1ProofSchema,
			await this._send('zks_getL2ToL1LogProof', params),
			returnFormat,
		) as L2ToL1Proof;
	}

	/**
	 * Returns L1/L2 addresses of default bridges.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getBridgeContracts(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BridgeAddresses> {
		return web3Utils.format(
			BridgeAddressesSchema,
			await this._send('zks_getBridgeContracts', []),
			returnFormat,
		) as BridgeAddresses;
	}

	/**
	 * Retrieves the bridge hub contract address
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getBridgehubContractAddress(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Address> {
		return web3Utils.format(
			AddressSchema,
			await this._send('zks_getBridgehubContract', []),
			returnFormat,
		) as Address;
	}

	/**
	 * Lists confirmed tokens. Confirmed in the method name means any token bridged to ZKsync Era via the official bridge.
	 * The tokens are returned in alphabetical order by their symbol. This means the token id is its position in an alphabetically sorted array of tokens.
	 *
	 * @param fromTokenId - The token id to start from.
	 * @param limit - The number of tokens to return.
	 * @param returnFormat - The format of the return value.
	 */
	public async getConfirmedTokens(
		fromTokenId: number,
		limit: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Token[]> {
		return web3Utils.format(
			ConfirmedTokensSchema,
			await this._send('zks_getConfirmedTokens', [fromTokenId, limit]),
			returnFormat,
		) as Token[];
	}

	/**
	 * Retrieves the proof for an L2 to L1 message.
	 *
	 * @param l2BlockNumber - The L2 block number.
	 * @param senderAddress - The sender address.
	 * @param messageHash - The message hash.
	 * @param l2LogPosition - The log position in L2.
	 * @param returnFormat - The format of the return value.
	 */
	public async getL2ToL1MsgProof(
		l2BlockNumber: number,
		senderAddress: web3Types.Address,
		messageHash: web3Types.Bytes,
		l2LogPosition?: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<MessageProof> {
		return web3Utils.format(
			L2ToL1ProofSchema,
			await this._send('zks_getL2ToL1MsgProof', [
				l2BlockNumber,
				senderAddress,
				messageHash,
				l2LogPosition || 0,
			]),
			returnFormat,
		) as MessageProof;
	}

	/**
	 * Retrieves the current L1 gas price.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getL1GasPrice(returnFormat: DataFormat = DEFAULT_RETURN_FORMAT): Promise<BigInt> {
		return web3Utils.format(
			{ format: 'uint' },
			await this._send('zks_getL1GasPrice', []),
			returnFormat,
		) as BigInt;
	}

	/**
	 * Retrieves the current fee parameters.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getFeeParams(
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<FeeParams> {
		return web3Utils.format(
			FeeParamsSchema,
			await this._send('zks_getFeeParams', []),
			returnFormat,
		) as FeeParams;
	}

	/**
	 * Gets the protocol version.
	 * Parameter
	 * uint16 - Optional. Specific version ID.
	 *
	 * @param versionId - The version ID.
	 * @param returnFormat - The format of the return value.
	 */
	public async getProtocolVersion(
		versionId?: number,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<ProtocolVersion> {
		return web3Utils.format(
			ProtocolVersionSchema,
			await this._send('zks_getProtocolVersion', [versionId]),
			returnFormat,
		) as ProtocolVersion;
	}

	/**
	 * Executes a transaction and returns its hash, storage logs, and events that would have been generated if the transaction had already been included in the block. The API has a similar behaviour to eth_sendRawTransaction but with some extra data returned from it.
	 * With this API Consumer apps can apply "optimistic" events in their applications instantly without having to wait for ZKsync block confirmation time.
	 * It’s expected that the optimistic logs of two uncommitted transactions that modify the same state will not have causal relationships between each other.
	 *
	 * @param data - The transaction data.
	 * @param returnFormat - The format of the return value.
	 */
	public async sendRawTransactionWithDetailedOutput(
		data: web3Types.Bytes,
		returnFormat: DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<RawTransactionWithDetailedOutput> {
		return web3Utils.format(
			RawTransactionWithDetailedOutputSchema,
			await this._send('zks_sendRawTransactionWithDetailedOutput', [data]),
			returnFormat,
		) as RawTransactionWithDetailedOutput;
	}
}
