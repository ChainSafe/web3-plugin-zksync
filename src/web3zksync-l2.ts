// import type { Web3ContextInitOptions } from 'web3-core';
// import { Web3Eth } from 'web3-eth';
// import * as web3Utils from 'web3-utils';
// import type { Address, HexString } from 'web3';

import { Block } from 'web3';
import { type BlockNumberOrTag, DEFAULT_RETURN_FORMAT, ETH_DATA_FORMAT } from 'web3-types';
import type { Bytes, DataFormat, Numbers, Transaction, TransactionReceipt } from 'web3-types';
import { format, toHex } from 'web3-utils';
import { ethRpcMethods } from 'web3-rpc-methods';
import { isNullish } from 'web3-validator';
import type * as web3Types from 'web3-types';
import { getL2HashFromPriorityOp, isAddressEq, isETH, sleep } from './utils';
import {
	BatchDetails,
	BlockDetails,
	BridgeAddresses,
	EstimateFee,
	L2ToL1Proof,
	Network as ZkSyncNetwork,
	RawBlockTransaction,
	TransactionDetails,
	TransactionRequest,
	TransactionStatus,
	WalletBalances,
	StorageProof,
} from './types';
import type { Address, TransactionOverrides, PaymasterParams, ZKTransactionReceipt } from './types';
import { Web3ZkSync } from './web3zksync';
import { ZKTransactionReceiptSchema } from './schemas';
import { Abi as IEthTokenAbi } from './contracts/IEthToken';
import {
	BOOTLOADER_FORMAL_ADDRESS,
	EIP712_TX_TYPE,
	ETH_ADDRESS_IN_CONTRACTS,
	L2_BASE_TOKEN_ADDRESS,
	LEGACY_ETH_ADDRESS,
	REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
} from './constants';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { IERC20ABI } from './contracts/IERC20';
import { RpcMethods } from './rpc.methods';
import * as web3Accounts from 'web3-eth-accounts';
import * as web3Utils from 'web3-utils';
import * as Web3 from 'web3';
import type { Web3ContextInitOptions } from 'web3-core';

// Equivalent to both Provider and Signer in zksync-ethers
export class Web3ZKsyncL2 extends Web3ZkSync {
	protected _rpc: RpcMethods;
	constructor(
		providerOrContext?: web3Types.SupportedProviders<any> | Web3ContextInitOptions | string,
	) {
		super(providerOrContext);
		this._rpc = new RpcMethods(this.requestManager);
	}
	async getZKTransactionReceipt<ReturnFormat extends DataFormat>(
		transactionHash: Bytes,
		returnFormat: ReturnFormat = DEFAULT_RETURN_FORMAT as ReturnFormat,
	) {
		const transactionHashFormatted = format(
			{ format: 'bytes32' },
			transactionHash,
			DEFAULT_RETURN_FORMAT,
		);
		const response = await ethRpcMethods.getTransactionReceipt(
			this.requestManager,
			transactionHashFormatted,
		);

		return isNullish(response)
			? response
			: format(
					ZKTransactionReceiptSchema,
					response as unknown as ZKTransactionReceipt,
					returnFormat ?? this.defaultReturnFormat,
				);
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

	async _getPriorityOpConfirmationL2ToL1Log(txHash: string, index = 0) {
		const hash = toHex(txHash);
		const receipt = await this.getZKTransactionReceipt(hash);
		if (!receipt) {
			throw new Error('Transaction is not mined!');
		}
		const messages = Array.from(receipt.l2ToL1Logs.entries()).filter(([, log]) =>
			isAddressEq(log.sender, BOOTLOADER_FORMAL_ADDRESS),
		);
		const [l2ToL1LogIndex, l2ToL1Log] = messages[index];

		return {
			l2ToL1LogIndex,
			l2ToL1Log,
			l1BatchTxId: receipt.l1BatchTxIndex,
		};
	}

	/**
	 * Returns the transaction confirmation data that is part of `L2->L1` message.
	 *
	 * @param txHash The hash of the L2 transaction where the message was initiated.
	 * @param [index=0] In case there were multiple transactions in one message, you may pass an index of the
	 * transaction which confirmation data should be fetched.
	 * @throws {Error} If log proof can not be found.
	 */
	async getPriorityOpConfirmation(txHash: string, index = 0) {
		const { l2ToL1LogIndex, l2ToL1Log, l1BatchTxId } =
			await this._getPriorityOpConfirmationL2ToL1Log(txHash, index);
		const proof = await this._rpc.getL2ToL1LogProof(txHash, l2ToL1LogIndex);
		return {
			l1BatchNumber: l2ToL1Log.l1BatchNumber,
			l2MessageIndex: proof.id,
			l2TxNumberInBlock: l1BatchTxId,
			proof: proof.proof,
		};
	}

	/**
	 * Returns a L2 transaction response from L1 transaction response.
	 *
	 * @param context
	 * @param txHash
	 */
	async getL2TransactionFromPriorityOp(receipt: TransactionReceipt) {
		const l2Hash = getL2HashFromPriorityOp(receipt, await this.getMainContractAddress());

		let status = null;
		do {
			status = await this.getTransactionStatus(l2Hash);
			await sleep(this.transactionPollingInterval);
		} while (status === TransactionStatus.NotFound);

		return l2Hash;
	}

	/**
	 * Returns the status of a specified transaction.
	 *
	 * @param txHash The hash of the transaction.
	 */
	// This is inefficient. Status should probably be indicated in the transaction receipt.
	async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
		let tx;
		try {
			tx = await this.eth.getTransaction(txHash);
		} catch {}

		if (!tx) {
			return TransactionStatus.NotFound;
		}
		if (!tx.blockNumber) {
			return TransactionStatus.Processing;
		}
		const verifiedBlock = (await this.eth.getBlock('finalized')) as Block;
		if (tx.blockNumber <= verifiedBlock.number) {
			return TransactionStatus.Finalized;
		}
		return TransactionStatus.Committed;
	}
	/**
	 * Returns the populated withdrawal transaction.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.token The token address.
	 * @param transaction.amount The amount of token.
	 * @param [transaction.from] The sender's address.
	 * @param [transaction.to] The recipient's address.
	 * @param [transaction.bridgeAddress] The bridge address.
	 * @param [transaction.paymasterParams] Paymaster parameters.
	 * @param [transaction.overrides] Transaction overrides including `gasLimit`, `gasPrice`, and `value`.
	 */
	async getWithdrawTx(transaction: {
		token: Address;
		amount: Numbers;
		from?: Address;
		to?: Address;
		bridgeAddress?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		const { ...tx } = transaction;
		tx.amount = format({ format: 'uint' }, transaction.amount, ETH_DATA_FORMAT);
		const isEthBasedChain = await this.isEthBasedChain();

		// In case of Ether on non Ether based chain it should get l2 Ether address,
		// and in case of base token it should use L2_BASE_TOKEN_ADDRESS
		if (isAddressEq(tx.token, LEGACY_ETH_ADDRESS) && !isEthBasedChain) {
			tx.token = await this.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
		} else if (await this.isBaseToken(tx.token)) {
			tx.token = L2_BASE_TOKEN_ADDRESS;
		}

		if (
			(tx.to === null || tx.to === undefined) &&
			(tx.from === null || tx.from === undefined)
		) {
			throw new Error('Withdrawal target address is undefined!');
		}

		tx.to ??= tx.from;
		tx.overrides ??= {} as TransactionOverrides;
		tx.overrides.from ??= tx.from as Address;

		if (isETH(tx.token)) {
			if (!tx.overrides?.value) {
				tx.overrides.value = toHex(tx.amount);
			}
			const passedValue = BigInt(tx.overrides?.value ?? 0);

			if (passedValue !== BigInt(tx.amount)) {
				// To avoid users shooting themselves into the foot, we will always use the amount to withdraw
				// as the value

				throw new Error('The tx.value is not equal to the value withdrawn!');
			}

			const ethL2Token = new this.eth.Contract(IEthTokenAbi, L2_BASE_TOKEN_ADDRESS);
			const populatedTx = ethL2Token.methods
				.withdraw(tx.to)
				// @ts-ignore
				.populateTransaction(tx.overrides);
			if (tx.paymasterParams) {
				return {
					...populatedTx,
					customData: {
						paymasterParams: tx.paymasterParams,
					},
				};
			}
			return populatedTx;
		}

		if (!tx.bridgeAddress) {
			const bridgeAddresses = await this.getDefaultBridgeAddresses();
			tx.bridgeAddress = bridgeAddresses.sharedL2;
		}
		const bridge = new this.eth.Contract(IL2BridgeABI, tx.bridgeAddress);

		const populatedTx = bridge.methods
			.withdraw(tx.to, tx.token, tx.amount)
			// @ts-ignore
			.populateTransaction(tx.overrides);

		if (tx.paymasterParams) {
			return {
				...populatedTx,
				customData: {
					paymasterParams: tx.paymasterParams,
				},
			};
		}
		return populatedTx;
	}

	/**
	 * Returns the populated transfer transaction.
	 *
	 * @param transaction Transfer transaction request.
	 * @param transaction.to The address of the recipient.
	 * @param transaction.amount The amount of the token to transfer.
	 * @param [transaction.token] The address of the token. Defaults to ETH.
	 * @param [transaction.paymasterParams] Paymaster parameters.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	async getTransferTx(transaction: {
		to: Address;
		amount: Numbers;
		from?: Address;
		token?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		const { ...tx } = transaction;
		tx.amount = format({ format: 'uint' }, tx.amount, ETH_DATA_FORMAT);
		const isEthBasedChain = await this.isEthBasedChain();

		// In case of Ether on non Ether based chain it should get l2 Ether address,
		// and in case of base token it should use L2_BASE_TOKEN_ADDRESS
		if (tx.token && isAddressEq(tx.token, LEGACY_ETH_ADDRESS) && !isEthBasedChain) {
			tx.token = await this.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
		} else if (!tx.token || (await this.isBaseToken(tx.token))) {
			tx.token = L2_BASE_TOKEN_ADDRESS;
		}

		tx.overrides ??= {} as TransactionOverrides;
		tx.overrides.from ??= tx.from as Address;

		if (isETH(tx.token)) {
			if (tx.paymasterParams) {
				return {
					...tx.overrides,
					type: EIP712_TX_TYPE,
					to: tx.to,
					value: tx.amount,
					customData: {
						paymasterParams: tx.paymasterParams,
					} as Transaction,
				};
			}

			return {
				...tx.overrides,
				to: tx.to,
				value: tx.amount,
			} as Transaction;
		} else {
			const token = new this.eth.Contract(IERC20ABI, tx.token);
			const populatedTx = token.methods
				.transfer(tx.to, tx.amount)
				// @ts-ignore
				.populateTransaction(tx.overrides);

			if (tx.paymasterParams) {
				return {
					...populatedTx,
					customData: {
						paymasterParams: tx.paymasterParams,
					},
				};
			}
			return populatedTx as Transaction;
		}
	}

	/**
	 * Creates a new `Provider` from provided URL or network name.
	 *
	 * @param zksyncNetwork The type of ZKsync network.
	 *
	 * @example
	 *
	 * import { initWithDefaultProvider, types } from "web3-plugin-zksync";
	 *
	 * const provider = ZkSyncNetwork.initWithDefaultProvider(types.Network.Sepolia);
	 */
	static initWithDefaultProvider(
		zksyncNetwork: ZkSyncNetwork = ZkSyncNetwork.Localhost,
	): Web3ZKsyncL2 {
		switch (zksyncNetwork) {
			case ZkSyncNetwork.Localhost:
				return new Web3ZKsyncL2('http://localhost:3050');
			case ZkSyncNetwork.Sepolia:
				return new Web3ZKsyncL2('https://sepolia.era.zksync.dev');
			case ZkSyncNetwork.Mainnet:
				return new Web3ZKsyncL2('https://mainnet.era.zksync.io');
			case ZkSyncNetwork.EraTestNode:
				return new Web3ZKsyncL2('http://localhost:8011');
			default:
				return new Web3ZKsyncL2('http://localhost:3050');
		}
	}
	async getBalance(
		address: Address,
		blockTag?: BlockNumberOrTag,
		tokenAddress?: Address,
	): Promise<bigint> {
		if (!tokenAddress || (await this.isBaseToken(tokenAddress))) {
			return this.eth.getBalance(address, blockTag);
		} else {
			try {
				return this.getTokenBalance(tokenAddress, address);
			} catch {
				return 0n;
			}
		}
	}
}
