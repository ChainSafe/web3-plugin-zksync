import type { Web3ContextInitOptions } from 'web3-core';
import * as web3Utils from 'web3-utils';
import type * as web3Types from 'web3-types';
import { DEFAULT_RETURN_FORMAT } from 'web3';
import { getGasPrice, transactionBuilder, transactionSchema } from 'web3-eth';
import * as Web3 from 'web3';
import { Bytes, ETH_DATA_FORMAT, Transaction } from 'web3-types';
import { format, toBigInt, toHex } from 'web3-utils';
import { ethRpcMethods } from 'web3-rpc-methods';
import type { Address, Eip712TxData, Eip712Meta, TransactionRequest } from './types';
import { DEFAULT_GAS_PER_PUBDATA_LIMIT, EIP712_TX_TYPE, ZERO_ADDRESS } from './constants';
import { EIP712 } from './utils';
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
		super(providerOrContext as web3Types.SupportedProviders<any>);

		this._contractAddresses = {};
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

	// /**
	//  * Returns `tx` as a normalized JSON-RPC transaction request, which has all values `hexlified` and any numeric
	//  * values converted to Quantity values.
	//  * @param tx The transaction request that should be normalized.
	//  */
	prepareTransaction(
		transaction: Eip712TxData,
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): web3Types.FormatType<Eip712TxData, typeof returnFormat> {
		const tx = format(transactionSchema, transaction, returnFormat);

		if (!transaction.customData) {
			return tx;
		}
		tx.type = web3Utils.toHex(EIP712_TX_TYPE);
		const { customData } = transaction;
		tx.eip712Meta = {
			gasPerPubdata: web3Utils.toHex(customData?.gasPerPubdata ?? 0),
		} as Eip712Meta;
		if (customData?.factoryDeps) {
			const factoryDeps = customData.factoryDeps.map(
				dep =>
					// TODO (SMA-1605): we arraify instead of hexlifying because server expects Vec<u8>.
					//  We should change deserialization there.
					Array.from(toUint8Array(dep)) as unknown as Bytes,
			);
			(tx.eip712Meta as Eip712Meta).factoryDeps = factoryDeps;
		}
		if (customData?.paymasterParams) {
			tx.eip712Meta.paymasterParams = {
				paymaster: toHex(customData.paymasterParams.paymaster),
				paymasterInput: Array.from(
					toUint8Array(customData.paymasterParams.paymasterInput),
				) as unknown as Bytes,
			};
		}
		return tx;
	}

	async estimateGas(transaction: TransactionRequest) {
		// if `to` is not set, when `eth_estimateGas` was called, the connected node returns the error: "Failed to serialize transaction: toAddressIsNull".
		// for this pass the zero address as the `to` parameter, in-case if `to` was not provided if it is a contract deployment transaction.
		const tx = { ...transaction, to: transaction.to ?? ZERO_ADDRESS };
		const dataToSend = this.prepareTransaction(tx as Eip712TxData, ETH_DATA_FORMAT);
		const gas = await this.requestManager.send({
			method: 'eth_estimateGas',
			params: [dataToSend],
		});

		return web3Utils.toBigInt(gas);
	}

	private async populateTransactionAndGasPrice(
		transaction: TransactionRequest,
	): Promise<TransactionRequest> {
		transaction.nonce =
			transaction.nonce ?? (await this.eth.getTransactionCount(transaction.from!, 'pending'));

		const txForBuilder = { ...transaction };

		if (txForBuilder.type && toHex(txForBuilder.type) === toHex(EIP712_TX_TYPE)) {
			delete txForBuilder.type;
		}
		const populated = await transactionBuilder<TransactionRequest>({
			transaction: txForBuilder as Transaction,
			web3Context: this,
		});
		if ((transaction as Eip712TxData).customData) {
			(populated as Eip712TxData).customData = (transaction as Eip712TxData).customData;
			populated.type = toHex(EIP712_TX_TYPE);
		} else {
			populated.type = toHex(transaction.type === undefined ? 2n : transaction.type);
		}

		const formatted = web3Utils.format(
			EIP712TransactionSchema,
			populated,
		) as TransactionRequest;

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
		if (toBigInt(formatted.type) === 0n) {
			formatted.gasPrice =
				formatted.gasPrice ?? (await getGasPrice(this, DEFAULT_RETURN_FORMAT));
			return formatted;
		}
		if (toBigInt(formatted.type) === 2n && formatted.gasPrice) {
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
			if (toBigInt(formatted.type) !== BigInt(EIP712_TX_TYPE)) {
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

	async populateTransaction(transaction: TransactionRequest) {
		if (
			(!transaction.type ||
				(transaction.type && toHex(transaction.type) !== toHex(EIP712_TX_TYPE))) &&
			!(transaction as Eip712TxData).customData
		) {
			return this.populateTransactionAndGasPrice(transaction);
		}

		const populated = await this.populateTransactionAndGasPrice(transaction);
		populated.value ??= 0n;
		populated.data ??= '0x';

		populated.customData = this.fillCustomData(transaction.customData as Eip712Meta);
		return populated;
	}

	async signTransaction(tx: TransactionRequest): Promise<string> {
		if (tx.type && toHex(tx.type) === toHex(EIP712_TX_TYPE)) {
			const signer = new utils.EIP712Signer(
				this.eth.accounts.wallet.get(tx.from!) as Web3Account,
				Number(tx.chainId),
			);
			tx.customData = {
				...(tx.customData || {}),
				customSignature: await signer.sign(tx as Eip712TxData),
			};
			return EIP712.serialize(tx);
		}
		const account = this.eth.accounts.wallet.get(tx.from!);

		if (!account) {
			throw new Error('Account not found');
		}

		const res = await this.eth.accounts.signTransaction(tx as Transaction, account?.privateKey);
		return res.rawTransaction;
	}
	async sendRawTransaction(signedTx: string) {
		return ethRpcMethods.sendRawTransaction(this.requestManager, signedTx);
	}
}
