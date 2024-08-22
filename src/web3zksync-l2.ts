// import type { Web3ContextInitOptions } from 'web3-core';
// import { Web3Eth } from 'web3-eth';
// import * as web3Utils from 'web3-utils';
// import type { Address, HexString } from 'web3';

import type { Block } from 'web3';
import { type BlockNumberOrTag, DEFAULT_RETURN_FORMAT } from 'web3-types';
import type { Bytes, DataFormat, Numbers, Transaction, TransactionReceipt } from 'web3-types';
import { format, toHex } from 'web3-utils';
import { ethRpcMethods } from 'web3-rpc-methods';
import { isNullish } from 'web3-validator';
import { getL2HashFromPriorityOp, isAddressEq, isETH, sleep } from './utils';
import { Network as ZkSyncNetwork, TransactionStatus } from './types';
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
} from './constants';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { IERC20ABI } from './contracts/IERC20';
import * as utils from './utils';

// Equivalent to both Provider and Signer in zksync-ethers
export class Web3ZKsyncL2 extends Web3ZkSync {
	eip712!: utils.EIP712Signer;
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
				return await this.getTokenBalance(tokenAddress, address);
			} catch {
				return 0n;
			}
		}
	}
}
