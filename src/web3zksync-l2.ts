// import type { Web3ContextInitOptions } from 'web3-core';
// import { Web3Eth } from 'web3-eth';
// import * as web3Utils from 'web3-utils';
// import type { Address, HexString } from 'web3';

import {
	Address,
	Network as ZkSyncNetwork,
	PaymasterParams,
	PriorityOpResponse,
	TransactionStatus,
	ZKTransactionReceipt,
} from './types';
import * as Web3 from 'web3';
import { Web3ZkSync } from './web3zksync';
import {
	getL2HashFromPriorityOp,
	isAddressEq,
	isETH,
	sleep,
	waitFinalize,
	waitTxConfirmation,
} from './utils';
import { Block, TransactionReceiptBase, Web3PromiEvent } from 'web3';
import {
	Bytes,
	DataFormat,
	DEFAULT_RETURN_FORMAT,
	EthExecutionAPI,
	FormatType,
	Numbers,
	TransactionReceipt,
} from 'web3-types';
import { Web3Eth } from 'web3-eth';
import { format, toHex } from 'web3-utils';
import { Web3Context } from 'web3-core';
import { ethRpcMethods } from 'web3-rpc-methods';
import { isNullish } from 'web3-validator';
import { transactionReceiptSchema } from 'web3-eth/src/schemas';
import { ZKTransactionReceiptSchema } from './schemas';
import { Abi as IEthTokenAbi } from './contracts/IEthToken';
import {
	EIP712_TX_TYPE,
	ETH_ADDRESS_IN_CONTRACTS,
	L2_BASE_TOKEN_ADDRESS,
	LEGACY_ETH_ADDRESS,
} from './constants';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { IERC20ABI } from './contracts/IERC20';

// Equivalent to both Provider and Signer in zksync-ethers
export class Web3ZkSyncL2 extends Web3ZkSync {
	// protected _contractAddresses: {
	// 	mainContract?: Address;
	// 	erc20BridgeL1?: Address;
	// 	erc20BridgeL2?: Address;
	// 	wethBridgeL1?: Address;
	// 	wethBridgeL2?: Address;
	// };

	// override contractAddresses(): {
	// 	mainContract?: Address;
	// 	erc20BridgeL1?: Address;
	// 	erc20BridgeL2?: Address;
	// 	wethBridgeL1?: Address;
	// 	wethBridgeL2?: Address;
	// } {
	// 	return this._contractAddresses;
	// }

	// /**
	//  * Creates a new `Provider` instance for connecting to an L2 network.
	//  * Caching is disabled for local networks.
	//  * @param [url] The network RPC URL. Defaults to the local network.
	//  * @param [network] The network name, chain ID, or object with network details.
	//  * @param [options] Additional options for the provider.
	//  */
	// constructor(url?: ethers.FetchRequest | string, network?: Networkish, options?: any) {
	// 	if (!url) {
	// 		url = 'http://localhost:3050';
	// 	}

	// 	const isLocalNetwork =
	// 		typeof url === 'string'
	// 			? url.includes('localhost') || url.includes('127.0.0.1')
	// 			: url.url.includes('localhost') || url.url.includes('127.0.0.1');

	// 	const optionsWithDisabledCache = isLocalNetwork ? { ...options, cacheTimeout: -1 } : options;

	// 	super(url, network, optionsWithDisabledCache);
	// 	typeof url === 'string'
	// 		? (this.#connect = new FetchRequest(url))
	// 		: (this.#connect = url.clone());
	// 	this.pollingInterval = 500;
	// 	this._contractAddresses = {};
	// }

	// override async _send(
	// 	payload: JsonRpcPayload | Array<JsonRpcPayload>,
	// ): Promise<Array<JsonRpcResult>> {
	// 	const request = this._getConnection();
	// 	request.body = JSON.stringify(payload);
	// 	request.setHeader('content-type', 'application/json');

	// 	const response = await request.send();
	// 	response.assertOk();

	// 	let resp = response.bodyJson;
	// 	if (!Array.isArray(resp)) {
	// 		resp = [resp];
	// 	}

	// 	return resp;
	// }

	/**
	 * Returns a {@link PriorityOpResponse} from L1 transaction response.
	 *
	 * @param l1TxResponse The L1 transaction response.
	 */
	getPriorityOpResponse(l1TxResponse: Web3PromiEvent<any, any>): PriorityOpResponse {
		return {
			...l1TxResponse,
			waitL1Commit: () => waitTxConfirmation(l1TxResponse),
			wait: async () => {
				const l2Tx = this.getL2TransactionFromPriorityOp(l1TxResponse);
				return waitTxConfirmation(l2Tx);
			},
			waitFinalize: async () => {
				const l2Tx = this.getL2TransactionFromPriorityOp(l1TxResponse);
				return waitFinalize(this as unknown as Web3Eth, l2Tx);
			},
		};
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

	async _getPriorityOpConfirmationL2ToL1Log(txHash: string, index = 0) {
		const hash = toHex(txHash);
		const receipt = await this.getTransactionReceipt(hash);
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
			l2MessageIndex: proof!.id,
			l2TxNumberInBlock: l1BatchTxId,
			proof: proof!.proof,
		};
	}

	/**
	 * Returns a L2 transaction response from L1 transaction response.
	 *
	 * @param l1TxResponse The L1 transaction response.
	 */
	async getL2TransactionFromPriorityOp(
		l1TxResponse: Web3PromiEvent<any, any>,
	): Promise<TransactionReceiptBase<any, any, any, any>> {
		const receipt = await waitTxConfirmation(l1TxResponse);
		const l2Hash = getL2HashFromPriorityOp(receipt, await this.getMainContractAddress());

		let status = null;
		do {
			status = await this.getTransactionStatus(l2Hash);
			await sleep(this.transactionPollingInterval);
		} while (status === TransactionStatus.NotFound);

		return this.getTransaction(l2Hash);
	}

	/**
	 * Returns the status of a specified transaction.
	 *
	 * @param txHash The hash of the transaction.
	 */
	// This is inefficient. Status should probably be indicated in the transaction receipt.
	async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
		const tx = await this.getTransaction(txHash);
		if (!tx) {
			return TransactionStatus.NotFound;
		}
		if (!tx.blockNumber) {
			return TransactionStatus.Processing;
		}
		const verifiedBlock = (await this.getBlock('finalized')) as Block;
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
		overrides?: ethers.Overrides;
	}) {
		const { ...tx } = transaction;
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
		tx.overrides ??= {};
		tx.overrides.from ??= tx.from;

		if (isETH(tx.token)) {
			if (!tx.overrides.value) {
				tx.overrides.value = tx.amount;
			}
			const passedValue = BigInt(tx.overrides.value);

			if (passedValue !== BigInt(tx.amount)) {
				// To avoid users shooting themselves into the foot, we will always use the amount to withdraw
				// as the value

				throw new Error('The tx.value is not equal to the value withdrawn!');
			}

			const ethL2Token = new Web3.Contract(IEthTokenAbi, L2_BASE_TOKEN_ADDRESS);
			ethL2Token.setProvider(this.provider);
			const sendOptions = {
				...tx.overrides,
			};
			if (tx.paymasterParams) {
				sendOptions.customData = {
					paymasterParams: tx.paymasterParams,
				};
			}

			return ethL2Token.methods.withdraw(tx.from, tx.to, tx.amount).send(sendOptions);
		}

		if (!tx.bridgeAddress) {
			const bridgeAddresses = await this.getDefaultBridgeAddresses();
			tx.bridgeAddress = bridgeAddresses.sharedL2;
		}
		const bridge = new Web3.Contract(IL2BridgeABI, tx.bridgeAddress);
		bridge.setProvider(this.provider);

		bridge.methods.withdraw();

		const sendOptions = {
			...tx.overrides,
		};
		if (tx.paymasterParams) {
			sendOptions.customData = {
				paymasterParams: tx.paymasterParams,
			};
		}

		return bridge.methods.withdraw(tx.from, tx.to, tx.token, tx.amount).send(sendOptions);
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
		overrides?: ethers.Overrides;
	}) {
		const { ...tx } = transaction;
		const isEthBasedChain = await this.isEthBasedChain();

		// In case of Ether on non Ether based chain it should get l2 Ether address,
		// and in case of base token it should use L2_BASE_TOKEN_ADDRESS
		if (tx.token && isAddressEq(tx.token, LEGACY_ETH_ADDRESS) && !isEthBasedChain) {
			tx.token = await this.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
		} else if (!tx.token || (await this.isBaseToken(tx.token))) {
			tx.token = L2_BASE_TOKEN_ADDRESS;
		}

		tx.overrides ??= {};
		tx.overrides.from ??= tx.from;

		if (isETH(tx.token)) {
			if (tx.paymasterParams) {
				return {
					...tx.overrides,
					type: EIP712_TX_TYPE,
					to: tx.to,
					value: tx.amount,
					customData: {
						paymasterParams: tx.paymasterParams,
					},
				};
			}

			return this.sendTransaction({
				...tx.overrides,
				to: tx.to,
				value: tx.amount,
			});
		} else {
			const token = new Web3.Contract(IERC20ABI, tx.token);
			token.setProvider(this.provider);

			const sendOptions = { ...tx.overrides };
			if (tx.paymasterParams) {
				sendOptions.customData = {
					paymasterParams: tx.paymasterParams,
				};
			}
			return token.methods.transfer(tx.to, tx.amount).send(sendOptions);
		}
	}

	/**
	 * Creates a new `Provider` from provided URL or network name.
	 *
	 * @param zksyncNetwork The type of zkSync network.
	 *
	 * @example
	 *
	 * import { initWithDefaultProvider, types } from "web3-plugin-zksync";
	 *
	 * const provider = ZkSyncNetwork.initWithDefaultProvider(types.Network.Sepolia);
	 */
	static initWithDefaultProvider(
		zksyncNetwork: ZkSyncNetwork = ZkSyncNetwork.Localhost,
	): Web3ZkSync {
		switch (zksyncNetwork) {
			case ZkSyncNetwork.Localhost:
				return new Web3ZkSync('http://localhost:3050');
			case ZkSyncNetwork.Sepolia:
				return new Web3ZkSync('https://sepolia.era.zksync.dev');
			case ZkSyncNetwork.Mainnet:
				return new Web3ZkSync('https://mainnet.era.zksync.io');
			case ZkSyncNetwork.EraTestNode:
				return new Web3ZkSync('http://localhost:8011');
			default:
				return new Web3ZkSync('http://localhost:3050');
		}
	}
}
