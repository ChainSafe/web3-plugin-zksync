import type { Web3ContextInitOptions } from 'web3-core';
import * as web3Utils from 'web3-utils';
import type * as web3Types from 'web3-types';
import * as web3Accounts from 'web3-eth-accounts';
import { DEFAULT_RETURN_FORMAT } from 'web3';
import { getGasPrice, transactionBuilder, transactionSchema } from 'web3-eth';
import * as Web3 from 'web3';
import { ETH_DATA_FORMAT, Transaction } from 'web3-types';
import { format, toHex } from 'web3-utils';
import { ethRpcMethods } from 'web3-rpc-methods';
import type {
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
	TransactionOverrides,
	Eip712TxData,
	Eip712Meta,
} from './types';
import {
	DEFAULT_GAS_PER_PUBDATA_LIMIT,
	EIP712_TX_TYPE,
	ETH_ADDRESS_IN_CONTRACTS,
	L2_BASE_TOKEN_ADDRESS,
	LEGACY_ETH_ADDRESS,
	REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
	ZERO_ADDRESS,
} from './constants';
import { EIP712, isAddressEq, isETH } from './utils';
import { RpcMethods } from './rpc.methods';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { IERC20ABI } from './contracts/IERC20';
import { EIP712TransactionSchema } from './schemas';
import { toUint8Array, Web3Account } from 'web3-eth-accounts';
import * as utils from './utils';

/**
 * The base class for interacting with ZKsync Era.
 * It extends the `Web3Eth` class and provides additional methods for interacting with ZKsync Era.
 * It is the base class for the `Web3ZkSyncL1` and `Web3ZkSyncL2`.
 */
// Note: Code logic here is similar to JsonRpcApiProvider class in zksync-ethers
export class Web3ZkSync extends Web3.Web3 {
	protected _rpc: RpcMethods;

	protected _contractAddresses: {
		bridgehubContract?: web3Types.Address;
		mainContract?: web3Types.Address;
		erc20BridgeL1?: web3Types.Address;
		erc20BridgeL2?: web3Types.Address;
		wethBridgeL1?: web3Types.Address;
		wethBridgeL2?: web3Types.Address;
		sharedBridgeL1?: web3Types.Address;
		sharedBridgeL2?: web3Types.Address;
		baseToken?: web3Types.Address;
	};

	protected contractAddresses(): {
		bridgehubContract?: web3Types.Address;
		mainContract?: web3Types.Address;
		erc20BridgeL1?: web3Types.Address;
		erc20BridgeL2?: web3Types.Address;
		wethBridgeL1?: web3Types.Address;
		wethBridgeL2?: web3Types.Address;
		sharedBridgeL1?: web3Types.Address;
		sharedBridgeL2?: web3Types.Address;
		baseToken?: web3Types.Address;
	} {
		return this._contractAddresses;
	}

	constructor(
		providerOrContext?: web3Types.SupportedProviders<any> | Web3ContextInitOptions | string,
	) {
		// @ts-ignore
		super(providerOrContext as web3Types.SupportedProviders<any>);
		// @ts-ignore
		this._rpc = new RpcMethods(this.requestManager);

		this._contractAddresses = {};
	}

	/**
	 * Returns the chain id of the underlying L1.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async l1ChainId(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<bigint> {
		return this._rpc.l1ChainId(returnFormat);
	}
	/**
	 * Returns the latest L1 batch number.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getL1BatchNumber(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<bigint> {
		return this._rpc.getL1BatchNumber(returnFormat);
	}

	/**
	 * Returns data pertaining to a given batch.
	 *
	 * @param number - The layer 1 batch number.
	 * @param returnFormat - The format of the return value.
	 */
	public async getL1BatchDetails(
		number: web3Types.Numbers,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BatchDetails> {
		return this._rpc.getL1BatchDetails(number, returnFormat);
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
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BlockDetails> {
		return this._rpc.getBlockDetails(number, returnFormat);
	}

	/**
	 * Returns data from a specific transaction given by the transaction hash.
	 *
	 * @param txHash - Transaction hash as string.
	 * @param returnFormat - The format of the return value.
	 */
	public async getTransactionDetails(
		txHash: web3Types.Bytes,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<TransactionDetails> {
		return this._rpc.getTransactionDetails(txHash, returnFormat);
	}

	/**
	 * Returns bytecode of a transaction given by its hash.
	 *
	 * @param bytecodeHash - Bytecode hash as string.
	 * @param returnFormat - The format of the return value.
	 */
	public async getBytecodeByHash(
		bytecodeHash: web3Types.Bytes,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Uint8Array> {
		return this._rpc.getBytecodeByHash(bytecodeHash, returnFormat);
	}

	/**
	 * Returns data of transactions in a block.
	 *
	 * @param number - Block number.
	 * @param returnFormat - The format of the return value.
	 */
	public async getRawBlockTransactions(
		number: web3Types.Numbers,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<RawBlockTransaction[]> {
		return this._rpc.getRawBlockTransactions(number, returnFormat);
	}

	/**
	 * Returns the fee for the transaction.
	 *
	 * @param transaction - Transaction object.
	 * @param returnFormat - The format of the return value.
	 */
	public async estimateFee(
		transaction: Partial<web3Types.TransactionWithSenderAPI>,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<EstimateFee> {
		return this._rpc.estimateFee(transaction, returnFormat);
	}

	/**
	 * Returns the L1 base token address.
	 */
	async getBaseTokenContractAddress(): Promise<web3Types.Address> {
		if (!this.contractAddresses().baseToken) {
			this.contractAddresses().baseToken = await this._rpc.getBaseTokenL1Address();
		}
		return this.contractAddresses().baseToken!;
	}

	/**
	 * Returns whether the chain is ETH-based.
	 */
	async isEthBasedChain(): Promise<boolean> {
		return isAddressEq(await this.getBaseTokenContractAddress(), ETH_ADDRESS_IN_CONTRACTS);
	}

	/**
	 * Returns whether the `token` is the base token.
	 */
	async isBaseToken(token: web3Types.Address): Promise<boolean> {
		return isETH(token) || isAddressEq(token, await this.getBaseTokenContractAddress());
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
		return this._rpc.getTestnetPaymasterAddress();
	}

	/**
	 * Returns the addresses of the default ZKsync Era bridge contracts on both L1 and L2.
	 *
	 * Calls the {@link https://docs.zksync.io/build/api.html#zks-getbridgecontracts zks_getBridgeContracts} JSON-RPC method.
	 */
	async getDefaultBridgeAddresses(): Promise<{
		erc20L1: string;
		erc20L2: string;
		wethL1: string;
		wethL2: string;
		sharedL1: string;
		sharedL2: string;
	}> {
		if (!this.contractAddresses().erc20BridgeL1) {
			const addresses = await this._rpc.getBridgeContracts();

			this.contractAddresses().erc20BridgeL1 = addresses.l1Erc20DefaultBridge;
			this.contractAddresses().erc20BridgeL2 = addresses.l2Erc20DefaultBridge;
			this.contractAddresses().wethBridgeL1 = addresses.l1WethBridge;
			this.contractAddresses().wethBridgeL2 = addresses.l2WethBridge;
			this.contractAddresses().sharedBridgeL1 = addresses.l1SharedDefaultBridge;
			this.contractAddresses().sharedBridgeL2 = addresses.l2SharedDefaultBridge;
		}
		return {
			erc20L1: this.contractAddresses().erc20BridgeL1!,
			erc20L2: this.contractAddresses().erc20BridgeL2!,
			wethL1: this.contractAddresses().wethBridgeL1!,
			wethL2: this.contractAddresses().wethBridgeL2!,
			sharedL1: this.contractAddresses().sharedBridgeL1!,
			sharedL2: this.contractAddresses().sharedBridgeL2!,
		};
	}

	/**
	 * Returns an estimate of the gas required for a L1 to L2 transaction.
	 *
	 * @param transaction - Transaction object.
	 * @param returnFormat - The format of the return value.
	 */
	public async estimateGasL1ToL2(
		transaction: Partial<TransactionRequest>,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Numbers> {
		return this._rpc.estimateGasL1ToL2(transaction, returnFormat);
	}

	/**
	 * Returns all balances for confirmed tokens given by an account address.
	 *
	 * @param address - The account address.
	 * @param returnFormat - The format of the return value.
	 */
	public async getAllAccountBalances(
		address: web3Types.Address,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<WalletBalances> {
		return this._rpc.getAllAccountBalances(address, returnFormat);
	}

	/**
	 * Returns the address of the ZKsync Era contract.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getMainContract(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Address> {
		return this._rpc.getMainContract(returnFormat);
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
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Bytes[]> {
		return this._rpc.getL1BatchBlockRange(number, returnFormat);
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
	// @ts-ignore
	public async getProof(
		address: web3Types.Address,
		keys: string[],
		l1BatchNumber: web3Types.Numbers,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<StorageProof> {
		return this._rpc.getProof(address, keys, l1BatchNumber, returnFormat);
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
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<L2ToL1Proof> {
		return this._rpc.getL2ToL1LogProof(txHash, l2ToL1LogIndex, returnFormat);
	}

	/**
	 * Returns L1/L2 addresses of default bridges.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getBridgeContracts(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<BridgeAddresses> {
		return this._rpc.getBridgeContracts(returnFormat);
	}

	/**
	 * Returns the address of the BridgeHub contract.
	 *
	 * @param returnFormat - The format of the return value.
	 */
	public async getBridgehubContractAddress(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Address> {
		if (!this.contractAddresses().bridgehubContract) {
			this.contractAddresses().bridgehubContract =
				await this._rpc.getBridgehubContractAddress(returnFormat);
		}
		return this.contractAddresses().bridgehubContract!;
	}

	/**
	 * Returns gas estimation for an L1 to L2 execute operation.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.contractAddress The address of the contract.
	 * @param transaction.calldata The transaction call data.
	 * @param [transaction.caller] The caller's address.
	 * @param [transaction.l2Value] The current L2 gas value.
	 * @param [transaction.factoryDeps] An array of bytes containing contract bytecode.
	 * @param [transaction.gasPerPubdataByte] The current gas per byte value.
	 * @param [transaction.overrides] Transaction overrides including `gasLimit`, `gasPrice`, and `value`.
	 */
	// TODO (EVM-3): support refundRecipient for fee estimation
	async estimateL1ToL2Execute(
		transaction: {
			contractAddress: web3Types.Address;
			calldata: string;
			caller?: web3Types.Address;
			l2Value?: web3Types.Numbers;
			factoryDeps?: web3Types.Bytes[];
			gasPerPubdataByte?: web3Types.Numbers;
			overrides?: TransactionOverrides;
		},
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<web3Types.Numbers> {
		transaction.gasPerPubdataByte ??= REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;

		// If the `from` address is not provided, we use a random address, because
		// due to storage slot aggregation, the gas estimation will depend on the address
		// and so estimation for the zero address may be smaller than for the sender.
		transaction.caller ??= web3Accounts.create().address;

		const customData = {
			gasPerPubdata: transaction.gasPerPubdataByte,
		};
		if (transaction.factoryDeps) {
			Object.assign(customData, { factoryDeps: transaction.factoryDeps });
		}

		return this.estimateGasL1ToL2(
			{
				from: transaction.caller,
				data: transaction.calldata,
				to: transaction.contractAddress,
				value: transaction.l2Value
					? typeof transaction.l2Value !== 'string'
						? web3Utils.toHex(transaction.l2Value)
						: transaction.l2Value
					: undefined,
				customData,
			},
			returnFormat,
		);
	}

	/**
	 * Returns the L2 token address equivalent for a L1 token address as they are not equal.
	 * ETH address is set to zero address.
	 *
	 * @remarks Only works for tokens bridged on default ZKsync Era bridges.
	 *
	 * @param token The address of the token on L1.
	 */
	async l2TokenAddress(token: Address): Promise<string> {
		if (isAddressEq(token, LEGACY_ETH_ADDRESS)) {
			token = ETH_ADDRESS_IN_CONTRACTS;
		}

		const baseToken = await this.getBaseTokenContractAddress();
		if (isAddressEq(token, baseToken)) {
			return L2_BASE_TOKEN_ADDRESS;
		}

		const bridgeAddresses = await this.getDefaultBridgeAddresses();

		const contract = new Web3.Contract(IL2BridgeABI, bridgeAddresses.sharedL2);
		contract.setProvider(this.provider);
		return await contract.methods.l2TokenAddress(token).call();
	}

	/**
	 * Returns the main ZKsync Era smart contract address.
	 *
	 * Calls the {@link https://docs.zksync.io/build/api.html#zks-getmaincontract zks_getMainContract} JSON-RPC method.
	 */
	async getMainContractAddress(): Promise<Address> {
		if (!this.contractAddresses().mainContract) {
			this.contractAddresses().mainContract = await this._rpc.getMainContract();
		}
		return this.contractAddresses().mainContract!;
	}
	// /**
	//  * Returns `tx` as a normalized JSON-RPC transaction request, which has all values `hexlified` and any numeric
	//  * values converted to Quantity values.
	//  * @param tx The transaction request that should be normalized.
	//  */
	// override getRpcTransaction(tx: TransactionRequest): JsonRpcTransactionRequest {
	// 	const result: any = super.getRpcTransaction(tx);
	// 	if (!tx.customData) {
	// 		return result;
	// 	}
	// 	result.type = ethers.toBeHex(EIP712_TX_TYPE);
	// 	result.eip712Meta = {
	// 		gasPerPubdata: ethers.toBeHex(tx.customData.gasPerPubdata ?? 0),
	// 	} as any;
	// 	if (tx.customData.factoryDeps) {
	// 		result.eip712Meta.factoryDeps = tx.customData.factoryDeps.map((dep: ethers.BytesLike) =>
	// 			// TODO (SMA-1605): we arraify instead of hexlifying because server expects Vec<u8>.
	// 			//  We should change deserialization there.
	// 			Array.from(ethers.getBytes(dep)),
	// 		);
	// 	}
	// 	if (tx.customData.paymasterParams) {
	// 		result.eip712Meta.paymasterParams = {
	// 			paymaster: ethers.hexlify(tx.customData.paymasterParams.paymaster),
	// 			paymasterInput: Array.from(ethers.getBytes(tx.customData.paymasterParams.paymasterInput)),
	// 		};
	// 	}
	// 	return result;
	// }
	async getTokenBalance(token: Address, walletAddress: Address): Promise<bigint> {
		const erc20 = new this.eth.Contract(IERC20ABI, token);

		return await erc20.methods.balanceOf(walletAddress).call();
	}

	fillCustomData(data: Eip712Meta): Eip712Meta {
		const customData = { ...data };
		customData.gasPerPubdata ??= DEFAULT_GAS_PER_PUBDATA_LIMIT;
		customData.factoryDeps ??= [];
		return customData;
	}

	prepareTransaction(transaction: Eip712TxData) {
		if (!transaction.customData) {
			return transaction;
		}
		const { customData, ...tx } = transaction as Eip712TxData;
		tx.eip712Meta = {
			gasPerPubdata: web3Utils.toHex(customData?.gasPerPubdata ?? 0),
		} as any;
		if (customData?.factoryDeps) {
			const factoryDeps = customData.factoryDeps.map(dep =>
				// TODO (SMA-1605): we arraify instead of hexlifying because server expects Vec<u8>.
				//  We should change deserialization there.
				Array.from(toUint8Array(dep)),
			);
			// @ts-ignore
			tx.eip712Meta.factoryDeps = factoryDeps;
		}
		if (customData?.paymasterParams) {
			// @ts-ignore
			tx.eip712Meta.paymasterParams = {
				paymaster: toHex(customData.paymasterParams.paymaster),
				// @ts-ignore
				paymasterInput: Array.from(toUint8Array(customData.paymasterParams.paymasterInput)),
			};
		}
		return tx;
	}

	async estimateGas(transaction: Transaction) {
		// if `to` is not set, when `eth_estimateGas` was called, the connected node returns the error: "Failed to serialize transaction: toAddressIsNull".
		// for this pass the zero address as the `to` parameter, in-case if `to` was not provided if it is a contract deployment transaction.
		const tx = format(
			transactionSchema,
			{ ...transaction, to: transaction.to ?? ZERO_ADDRESS } as Transaction,
			ETH_DATA_FORMAT,
		);

		const dataToSend = this.prepareTransaction({
			...tx,
			customData: (transaction as Eip712TxData).customData,
		} as Eip712TxData);
		const gas = await this.requestManager.send({
			method: 'eth_estimateGas',
			params: [dataToSend],
		});

		return web3Utils.toBigInt(gas);
	}

	private async populateTransactionAndGasPrice(transaction: Transaction): Promise<Transaction> {
		transaction.nonce =
			transaction.nonce ?? (await this.eth.getTransactionCount(transaction.from!, 'pending'));

		const txForBuilder: Transaction = { ...transaction };

		if (txForBuilder.type && toHex(txForBuilder.type) === toHex(EIP712_TX_TYPE)) {
			delete txForBuilder.type;
		}
		const populated = await transactionBuilder({
			transaction: txForBuilder,
			web3Context: this,
		});
		if ((transaction as Eip712TxData).customData) {
			(populated as Eip712TxData).customData = (transaction as Eip712TxData).customData;
			populated.type = EIP712_TX_TYPE;
		} else {
			populated.type = transaction.type === undefined ? 2n : transaction.type;
		}

		const formatted = web3Utils.format(EIP712TransactionSchema, populated);

		delete formatted.input;
		delete formatted.chain;
		delete formatted.hardfork;
		delete formatted.networkId;

		if (
			formatted.accessList &&
			Array.isArray(formatted.accessList) &&
			formatted.accessList.length === 0
		) {
			delete formatted.accessList;
		}
		formatted.gasLimit = formatted.gasLimit ?? (await this.estimateGas(formatted));
		if (formatted.type === 0n) {
			formatted.gasPrice = formatted.gasPrice ?? (await getGasPrice(this, DEFAULT_RETURN_FORMAT));
			return formatted;
		}
		if (formatted.type === 2n && formatted.gasPrice) {
			formatted.maxFeePerGas = formatted.maxFeePerGas ?? formatted.gasPrice;
			formatted.maxPriorityFeePerGas = formatted.maxPriorityFeePerGas ?? formatted.gasPrice;
			delete formatted.gasPrice;
			return formatted;
		}
		if (formatted.maxPriorityFeePerGas && formatted.maxFeePerGas) {
			return formatted;
		}

		const gasFees = await this.eth.calculateFeeData();
		if (gasFees.maxFeePerGas && gasFees.maxPriorityFeePerGas) {
			if (formatted.type !== BigInt(EIP712_TX_TYPE)) {
				formatted.maxFeePerGas =
					formatted.maxFeePerGas ?? web3Utils.toBigInt(gasFees.maxFeePerGas);
				formatted.maxPriorityFeePerGas =
					formatted.maxPriorityFeePerGas ??
					(web3Utils.toBigInt(formatted.maxFeePerGas) >
					web3Utils.toBigInt(gasFees.maxPriorityFeePerGas)
						? formatted.maxFeePerGas
						: gasFees.maxPriorityFeePerGas);
			}
		} else {
			formatted.maxFeePerGas = formatted.maxFeePerGas ?? formatted.gasPrice;
			formatted.maxPriorityFeePerGas = formatted.maxPriorityFeePerGas ?? formatted.gasPrice;
		}

		if (gasFees.gasPrice && (!formatted.maxFeePerGas || !formatted.maxPriorityFeePerGas)) {
			formatted.gasPrice = gasFees.gasPrice;
		}

		return formatted;
	}

	async populateTransaction(transaction: Transaction) {
		if (
			(!transaction.type ||
				(transaction.type && toHex(transaction.type) !== toHex(EIP712_TX_TYPE))) &&
			!(transaction as Eip712TxData).customData
		) {
			return this.populateTransactionAndGasPrice(transaction);
		}

		const populated = (await this.populateTransactionAndGasPrice(transaction)) as Eip712TxData;
		populated.value ??= 0n;
		populated.data ??= '0x';

		populated.customData = this.fillCustomData(
			(transaction as Eip712TxData).customData as Eip712Meta,
		);
		return populated;
	}

	async signTransaction(tx: Transaction): Promise<string> {
		if (tx.type && toHex(tx.type) === toHex(EIP712_TX_TYPE)) {
			const signer = new utils.EIP712Signer(
				this.eth.accounts.wallet.get(tx.from!) as Web3Account,
				Number(tx.chainId),
			);
			// tx.chainId = signer.getDomain().chainId;
			// @ts-ignore
			tx.customData = {
				// @ts-ignore
				...(tx.customData || {}),
				customSignature: await signer.sign(tx as Eip712TxData),
			};
			// @ts-ignore
			return EIP712.serialize(tx);
		}
		const account = this.eth.accounts.wallet.get(tx.from!);

		if (!account) {
			throw new Error('Account not found');
		}

		const res = await this.eth.accounts.signTransaction(tx, account?.privateKey);
		return res.rawTransaction;
	}
	async sendRawTransaction(signedTx: string) {
		return ethRpcMethods.sendRawTransaction(this.requestManager, signedTx);
	}
}
