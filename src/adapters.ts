import type * as web3Types from 'web3-types';
import * as web3Utils from 'web3-utils';
import * as Web3EthAbi from 'web3-eth-abi';
import { DEFAULT_RETURN_FORMAT, HexString } from 'web3';
import * as Web3 from 'web3';
import type { PayableMethodObject, PayableTxOptions } from 'web3-eth-contract';
import { format, toBigInt, toHex, toNumber } from 'web3-utils';
import {
	Bytes,
	ETH_DATA_FORMAT,
	Numbers,
	Transaction,
	TransactionHash,
	TransactionReceipt,
} from 'web3-types';
import type { Web3ZKsyncL2 } from './web3zksync-l2';

import type { EIP712Signer } from './utils';
import {
	getPriorityOpResponse,
	checkBaseCost,
	estimateCustomBridgeDepositL2Gas,
	estimateDefaultBridgeDepositL2Gas,
	getERC20DefaultBridgeData,
	isETH,
	layer1TxDefaults,
	scaleGasLimit,
	undoL1ToL2Alias,
	isAddressEq,
	id,
	dataSlice,
	toBytes,
} from './utils';

import {
	BOOTLOADER_FORMAL_ADDRESS,
	L1_MESSENGER_ADDRESS,
	L1_RECOMMENDED_MIN_ERC20_DEPOSIT_GAS_LIMIT,
	L1_RECOMMENDED_MIN_ETH_DEPOSIT_GAS_LIMIT,
	REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
	NONCE_HOLDER_ADDRESS,
	ETH_ADDRESS_IN_CONTRACTS,
	LEGACY_ETH_ADDRESS,
	EIP712_TX_TYPE,
} from './constants';
import {
	Address,
	FinalizeWithdrawalParams,
	FullDepositFee,
	TransactionOverrides,
	PaymasterParams,
	PriorityOpResponse,
	WalletBalances,
	Eip712TxData,
	ZKTransactionReceiptLog,
} from './types';
import { ZeroAddress, ZeroHash } from './types';
import { IZkSyncABI } from './contracts/IZkSyncStateTransition';
import { IBridgehubABI } from './contracts/IBridgehub';
import { IERC20ABI } from './contracts/IERC20';
import { IL1BridgeABI } from './contracts/IL1Bridge';
import { Abi as IL1SharedBridgeABI } from './contracts/IL1SharedBridge';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { INonceHolderABI } from './contracts/INonceHolder';
import type { Web3ZKsyncL1 } from './web3zksync-l1';

interface TxSender {
	getAddress(): Promise<Address>;
}

export class AdapterL1 implements TxSender {
	/**
	 * Returns a provider instance for connecting to an L2 network.
	 */
	protected _contextL2(): Web3ZKsyncL2 {
		throw new Error('Must be implemented by the derived class!');
	}

	/**
	 * Returns a context (provider + Signer) instance for connecting to a L1 network.
	 */
	protected _contextL1(): Web3ZKsyncL1 {
		throw new Error('Must be implemented by the derived class!');
	}

	/**
	 * Returns `Contract` wrapper of the ZKsync Era smart contract.
	 */
	async getMainContract(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Web3.Contract<typeof IZkSyncABI>> {
		const address = await this._contextL2().getMainContract(returnFormat);
		const contract = new Web3.Contract(IZkSyncABI, address, returnFormat);
		contract.setProvider(this._contextL2().provider);
		return contract;
	}

	/**
	 * Returns `Contract` wrapper of the Bridgehub smart contract.
	 */
	async getBridgehubContract(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<Web3.Contract<typeof IBridgehubABI>> {
		const address = await this._contextL2().getBridgehubContractAddress();
		return new (this._contextL1().eth.Contract)(IBridgehubABI, address, returnFormat);
	}

	/**
	 * Returns L1 bridge contracts.
	 *
	 * @remarks There is no separate Ether bridge contract, {@link getBridgehubContractAddress Bridgehub} is used instead.
	 */
	async getL1BridgeContracts(
		returnFormat: web3Types.DataFormat = DEFAULT_RETURN_FORMAT,
	): Promise<{
		erc20: Web3.Contract<typeof IERC20ABI>;
		weth: Web3.Contract<typeof IERC20ABI>;
		shared: Web3.Contract<typeof IL1SharedBridgeABI>;
	}> {
		const addresses = await this._contextL2().getDefaultBridgeAddresses();
		const erc20 = new (this._contextL1().eth.Contract)(
			IERC20ABI,
			addresses.erc20L1,
			returnFormat,
		);
		const weth = new (this._contextL1().eth.Contract)(
			IERC20ABI,
			addresses.wethL1,
			returnFormat,
		);
		const shared = new (this._contextL1().eth.Contract)(
			IL1SharedBridgeABI,
			addresses.sharedL1,
			returnFormat,
		);

		return {
			erc20,
			weth,
			shared,
		};
	}

	/**
	 * Returns the address of the base token on L1.
	 */
	async getBaseToken(): Promise<Address> {
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		return bridgehub.methods.baseToken(chainId).call();
	}

	/**
	 * Returns whether the chain is ETH-based.
	 */
	async isETHBasedChain(): Promise<boolean> {
		return this._contextL2().isEthBasedChain();
	}

	/**
	 * Returns the amount of the token held by the account on the L1 network.
	 *
	 * @param [token] The address of the token. Defaults to ETH if not provided.
	 * @param [blockTag] The block in which the balance should be checked.
	 * Defaults to 'committed', i.e., the latest processed block.
	 */
	async getBalanceL1(token?: Address, blockTag?: web3Types.BlockNumberOrTag): Promise<bigint> {
		token ??= LEGACY_ETH_ADDRESS;
		return await this._contextL1().getBalance(this.getAddress(), blockTag, token);
	}

	/**
	 * Returns the amount of approved tokens for a specific L1 bridge.
	 *
	 * @param token The Ethereum address of the token.
	 * @param [bridgeAddress] The address of the bridge contract to be used.
	 * Defaults to the default ZKsync Era bridge, either `L1EthBridge` or `L1Erc20Bridge`.
	 * @param [blockTag] The block in which an allowance should be checked.
	 * Defaults to 'committed', i.e., the latest processed block.
	 */
	async getAllowanceL1(
		token: Address,
		bridgeAddress?: Address,
		blockTag?: web3Types.BlockNumberOrTag,
	): Promise<bigint> {
		if (!bridgeAddress) {
			const bridgeContracts = await this.getL1BridgeContracts();
			bridgeAddress = bridgeContracts.shared.options.address;
		}

		const erc20 = new (this._contextL1().eth.Contract)(IERC20ABI, token);

		return erc20.methods
			.allowance(this.getAddress(), bridgeAddress, {
				blockTag,
			})
			.call();
	}

	/**
	 * Returns the L2 token address equivalent for a L1 token address as they are not necessarily equal.
	 * The ETH address is set to the zero address.
	 *
	 * @remarks Only works for tokens bridged on default ZKsync Era bridges.
	 *
	 * @param token The address of the token on L1.
	 */
	async l2TokenAddress(token: Address): Promise<string> {
		return this._contextL2().l2TokenAddress(token);
	}

	/**
	 * Bridging ERC20 tokens from L1 requires approving the tokens to the ZKsync Era smart contract.
	 *
	 * @param token The L1 address of the token.
	 * @param amount The amount of the token to be approved.
	 * @param [overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @returns A promise that resolves to the response of the approval transaction.
	 * @throws {Error} If attempting to approve an ETH token.
	 */
	async approveERC20(
		token: Address,
		amount: web3Types.Numbers,
		overrides?: TransactionOverrides & { bridgeAddress?: Address },
	) {
		if (isETH(token)) {
			throw new Error(
				"ETH token can't be approved! The address of the token does not exist on L1.",
			);
		}

		overrides ??= {};
		let bridgeAddress = overrides.bridgeAddress;

		const erc20 = new (this._contextL1().eth.Contract)(IERC20ABI, token);

		if (!bridgeAddress) {
			bridgeAddress = (await this.getL1BridgeContracts()).shared.options.address;
		} else {
			delete overrides.bridgeAddress;
		}

		return erc20.methods.approve(bridgeAddress, amount, overrides).send({
			from: this.getAddress(),
		});
	}

	/**
	 * Returns the base cost for an L2 transaction.
	 *
	 * @param params The parameters for calculating the base cost.
	 * @param params.gasLimit The gasLimit for the L2 contract call.
	 * @param [params.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [params.gasPrice] The L1 gas price of the L1 transaction that will send the request for an execute call.
	 */
	async getBaseCost(params: {
		gasLimit: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		gasPrice?: web3Types.Numbers;
		chainId?: web3Types.Numbers;
	}): Promise<bigint> {
		const bridgehub = await this.getBridgehubContract();
		const parameters = { ...layer1TxDefaults(), ...params };
		parameters.gasPrice ??= (await this._contextL1().eth.calculateFeeData()).gasPrice!;
		parameters.gasPerPubdataByte ??= REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;

		return await bridgehub.methods
			.l2TransactionBaseCost(
				parameters.chainId ?? (await this._contextL2().eth.getChainId()),
				parameters.gasPrice,
				parameters.gasLimit,
				parameters.gasPerPubdataByte,
			)
			.call();
	}

	/**
	 * Returns the parameters for the approval token transaction based on the deposit token and amount.
	 * Some deposit transactions require multiple approvals. Existing allowance for the bridge is not checked;
	 * allowance is calculated solely based on the specified amount.
	 *
	 * @param token The address of the token to deposit.
	 * @param amount The amount of the token to deposit.
	 */
	async getDepositAllowanceParams(
		token: Address,
		amount: web3Types.Numbers,
	): Promise<{ token: Address; allowance: web3Types.Numbers }[]> {
		if (isAddressEq(token, LEGACY_ETH_ADDRESS)) {
			token = ETH_ADDRESS_IN_CONTRACTS;
		}
		const baseTokenAddress = await this.getBaseToken();
		const isETHBasedChain = await this.isETHBasedChain();

		if (isETHBasedChain && isAddressEq(token, ETH_ADDRESS_IN_CONTRACTS)) {
			throw new Error(
				"ETH token can't be approved! The address of the token does not exist on L1.",
			);
		} else if (isAddressEq(baseTokenAddress, ETH_ADDRESS_IN_CONTRACTS)) {
			return [{ token, allowance: amount }];
		} else if (isAddressEq(token, ETH_ADDRESS_IN_CONTRACTS)) {
			return [
				{
					token: baseTokenAddress,
					allowance: (await this._getDepositETHOnNonETHBasedChainTx({ token, amount }))
						.mintValue,
				},
			];
		} else if (isAddressEq(token, baseTokenAddress)) {
			return [
				{
					token: baseTokenAddress,
					allowance: (
						await this._getDepositBaseTokenOnNonETHBasedChainTx({
							token,
							amount,
						})
					).mintValue,
				},
			];
		} else {
			// A deposit of a non-base token to a non-ETH-based chain requires two approvals.
			return [
				{
					token: baseTokenAddress,
					allowance: (
						await this._getDepositNonBaseTokenToNonETHBasedChainTx({
							token,
							amount,
						})
					).mintValue,
				},
				{
					token: token,
					allowance: amount,
				},
			];
		}
	}

	/**
	 * Transfers the specified token from the associated account on the L1 network to the target account on the L2 network.
	 * The token can be either ETH or any ERC20 token. For ERC20 tokens, enough approved tokens must be associated with
	 * the specified L1 bridge (default one or the one defined in `transaction.bridgeAddress`).
	 * In this case, depending on is the chain ETH-based or not `transaction.approveERC20` or `transaction.approveBaseERC20`
	 * can be enabled to perform token approval. If there are already enough approved tokens for the L1 bridge,
	 * token approval will be skipped. To check the amount of approved tokens for a specific bridge,
	 * use the {@link getAllowanceL1} method.
	 *
	 * @param transaction The transaction object containing deposit details.
	 * @param transaction.token The address of the token to deposit. ETH by default.
	 * @param transaction.amount The amount of the token to deposit.
	 * @param [transaction.to] The address that will receive the deposited tokens on L2.
	 * @param [transaction.operatorTip] (currently not used) If the ETH value passed with the transaction is not
	 * explicitly stated in the overrides, this field will be equal to the tip the operator will receive on top of
	 * the base cost of the transaction.
	 * @param [transaction.bridgeAddress] The address of the bridge contract to be used.
	 * Defaults to the default ZKsync Era bridge (either `L1EthBridge` or `L1Erc20Bridge`).
	 * @param [transaction.approveERC20] Whether or not token approval should be performed under the hood.
	 * Set this flag to true if you bridge an ERC20 token and didn't call the {@link approveERC20} function beforehand.
	 * @param [transaction.approveBaseERC20] Whether or not base token approval should be performed under the hood.
	 * Set this flag to true if you bridge a base token and didn't call the {@link approveERC20} function beforehand.
	 * @param [transaction.l2GasLimit] Maximum amount of L2 gas that the transaction can consume during execution on L2.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.refundRecipient] The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 * @param [transaction.overrides] Transaction's overrides for deposit which may be used to pass
	 * L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @param [transaction.approveOverrides] Transaction's overrides for approval of an ERC20 token which may be used
	 * to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @param [transaction.approveBaseOverrides] Transaction's overrides for approval of a base token which may be used
	 * to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @param [transaction.customBridgeData] Additional data that can be sent to a bridge.
	 */
	async deposit(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		approveERC20?: boolean;
		approveBaseERC20?: boolean;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
		approveOverrides?: TransactionOverrides;
		approveBaseOverrides?: TransactionOverrides;
		customBridgeData?: web3Types.Bytes;
	}): Promise<PriorityOpResponse> {
		transaction.amount = format({ format: 'uint' }, transaction.amount, ETH_DATA_FORMAT);
		if (isAddressEq(transaction.token, LEGACY_ETH_ADDRESS)) {
			transaction.token = ETH_ADDRESS_IN_CONTRACTS;
		}
		const baseTokenAddress = await this.getBaseToken();

		const isETHBasedChain = isAddressEq(baseTokenAddress, ETH_ADDRESS_IN_CONTRACTS);

		if (isETHBasedChain && isAddressEq(transaction.token, ETH_ADDRESS_IN_CONTRACTS)) {
			return await this._depositETHToETHBasedChain(transaction);
		} else if (isAddressEq(baseTokenAddress, ETH_ADDRESS_IN_CONTRACTS)) {
			return await this._depositTokenToETHBasedChain(transaction);
		} else if (isAddressEq(transaction.token, ETH_ADDRESS_IN_CONTRACTS)) {
			return await this._depositETHToNonETHBasedChain(transaction);
		} else if (isAddressEq(transaction.token, baseTokenAddress)) {
			return await this._depositBaseTokenToNonETHBasedChain(transaction);
		} else {
			return await this._depositNonBaseTokenToNonETHBasedChain(transaction);
		}
	}

	async _depositNonBaseTokenToNonETHBasedChain(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		approveERC20?: boolean;
		approveBaseERC20?: boolean;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
		approveOverrides?: TransactionOverrides;
		approveBaseOverrides?: TransactionOverrides;
		customBridgeData?: web3Types.Bytes;
	}): Promise<PriorityOpResponse> {
		// Deposit a non-ETH and non-base token to a non-ETH-based chain.
		// Go through the BridgeHub and obtain approval for both tokens.
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const baseTokenAddress = await bridgehub.methods.baseToken(chainId).call();
		const bridgeContracts = await this.getL1BridgeContracts();
		const { tx, mintValue } =
			await this._getDepositNonBaseTokenToNonETHBasedChainTx(transaction);

		if (transaction.approveBaseERC20) {
			// Only request the allowance if the current one is not enough.
			const allowance = await this.getAllowanceL1(
				baseTokenAddress,
				bridgeContracts.shared.options.address,
			);
			if (allowance < mintValue) {
				await this.approveERC20(baseTokenAddress, mintValue, {
					bridgeAddress: bridgeContracts.shared.options.address,
					...transaction.approveBaseOverrides,
				});
			}
		}

		if (transaction.approveERC20) {
			const bridgeAddress = transaction.bridgeAddress
				? transaction.bridgeAddress
				: bridgeContracts.shared.options.address;

			// Only request the allowance if the current one is not enough.
			const allowance = await this.getAllowanceL1(transaction.token, bridgeAddress);
			if (allowance < BigInt(transaction.amount)) {
				await this.approveERC20(transaction.token, transaction.amount, {
					bridgeAddress,
					...transaction.approveOverrides,
				});
			}
		}

		const baseGasLimit = await tx.estimateGas();
		const gasLimit = scaleGasLimit(baseGasLimit);

		return this.signAndSend(tx.populateTransaction({ gasLimit } as PayableTxOptions));
	}

	async _depositBaseTokenToNonETHBasedChain(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		approveERC20?: boolean;
		approveBaseERC20?: boolean;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
		approveOverrides?: TransactionOverrides;
		approveBaseOverrides?: TransactionOverrides;
		customBridgeData?: web3Types.Bytes;
	}): Promise<PriorityOpResponse> {
		// Bridging the base token to a non-ETH-based chain.
		// Go through the BridgeHub, and give approval.
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const baseTokenAddress = await bridgehub.methods.baseToken(chainId).call();
		const sharedBridge = (await this.getL1BridgeContracts()).shared.options.address;
		const { tx, mintValue } = await this._getDepositBaseTokenOnNonETHBasedChainTx(transaction);

		if (transaction.approveERC20 || transaction.approveBaseERC20) {
			const approveOverrides =
				transaction.approveBaseOverrides ?? transaction.approveOverrides!;
			// Only request the allowance if the current one is not enough.
			const allowance = await this.getAllowanceL1(baseTokenAddress, sharedBridge);
			if (allowance < mintValue) {
				await this.approveERC20(baseTokenAddress, mintValue, {
					bridgeAddress: sharedBridge,
					...approveOverrides,
				});
			}
		}
		const baseGasLimit = await this.estimateGasRequestExecute(tx);
		const gasLimit = scaleGasLimit(baseGasLimit);

		tx.overrides ??= {};
		tx.overrides.gasLimit ??= gasLimit;

		return this.requestExecute(tx);
	}

	async _depositETHToNonETHBasedChain(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		approveERC20?: boolean;
		approveBaseERC20?: boolean;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
		approveOverrides?: TransactionOverrides;
		approveBaseOverrides?: TransactionOverrides;
		customBridgeData?: web3Types.Bytes;
	}): Promise<PriorityOpResponse> {
		// Depositing ETH into a non-ETH-based chain.
		// Use requestL2TransactionTwoBridges, secondBridge is the wETH bridge.
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const baseTokenAddress = await bridgehub.methods.baseToken(chainId).call();
		const sharedBridge = (await this.getL1BridgeContracts()).shared.options.address;
		const { tx, overrides, mintValue } =
			await this._getDepositETHOnNonETHBasedChainTx(transaction);

		if (transaction.approveBaseERC20) {
			// Only request the allowance if the current one is not enough.
			const allowance = await this.getAllowanceL1(baseTokenAddress, sharedBridge);
			if (allowance < mintValue) {
				await this.approveERC20(baseTokenAddress, mintValue, {
					bridgeAddress: sharedBridge,
					...transaction.approveBaseOverrides,
				});
			}
		}

		const baseGasLimit = await tx.estimateGas({
			value: overrides.value ? web3Utils.toHex(overrides.value) : undefined,
		});
		const gasLimit = scaleGasLimit(baseGasLimit);

		overrides.gasLimit ??= gasLimit;

		return this.signAndSend(tx.populateTransaction(overrides as PayableTxOptions));
	}

	async _depositTokenToETHBasedChain(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		approveERC20?: boolean;
		approveBaseERC20?: boolean;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
		approveOverrides?: TransactionOverrides;
		approveBaseOverrides?: TransactionOverrides;
		customBridgeData?: web3Types.Bytes;
	}): Promise<PriorityOpResponse> {
		const bridgeContracts = await this.getL1BridgeContracts();
		const { tx, overrides } = await this._getDepositTokenOnETHBasedChainTx(transaction);

		if (transaction.approveERC20) {
			const proposedBridge = bridgeContracts.shared.options.address;
			const bridgeAddress = transaction.bridgeAddress
				? transaction.bridgeAddress
				: proposedBridge;

			// Only request the allowance if the current one is not enough.
			const allowance = await this.getAllowanceL1(transaction.token, bridgeAddress);
			if (allowance < BigInt(transaction.amount)) {
				await this.approveERC20(transaction.token, transaction.amount, {
					bridgeAddress,
					...transaction.approveOverrides,
				});
			}
		}

		const baseGasLimit = await tx.estimateGas(overrides as PayableTxOptions);
		const gasLimit = scaleGasLimit(baseGasLimit);

		overrides.gasLimit ??= gasLimit;

		return this.signAndSend(tx.populateTransaction(overrides as PayableTxOptions));
	}

	async _depositETHToETHBasedChain(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		approveERC20?: boolean;
		approveBaseERC20?: boolean;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
		approveOverrides?: TransactionOverrides;
		approveBaseOverrides?: TransactionOverrides;
		customBridgeData?: web3Types.Bytes;
	}): Promise<PriorityOpResponse> {
		const tx = await this._getDepositETHOnETHBasedChainTx(transaction);
		const baseGasLimit = await this.estimateGasRequestExecute(tx);
		const gasLimit = scaleGasLimit(baseGasLimit);

		tx.overrides ??= {};
		tx.overrides.gasLimit ??= gasLimit;

		return this.requestExecute(tx);
	}

	/**
	 * Estimates the amount of gas required for a deposit transaction on the L1 network.
	 * Gas for approving ERC20 tokens is not included in the estimation.
	 *
	 * In order for estimation to work, enough token allowance is required in the following cases:
	 * - Depositing ERC20 tokens on an ETH-based chain.
	 * - Depositing any token (including ETH) on a non-ETH-based chain.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.token The address of the token to deposit. ETH by default.
	 * @param transaction.amount The amount of the token to deposit.
	 * @param [transaction.to] The address that will receive the deposited tokens on L2.
	 * @param [transaction.operatorTip] (currently not used) If the ETH value passed with the transaction is not
	 * explicitly stated in the overrides, this field will be equal to the tip the operator will receive on top of the
	 * base cost of the transaction.
	 * @param [transaction.bridgeAddress] The address of the bridge contract to be used.
	 * Defaults to the default ZKsync Era bridge (either `L1EthBridge` or `L1Erc20Bridge`).
	 * @param [transaction.l2GasLimit] Maximum amount of L2 gas that the transaction can consume during execution on L2.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.customBridgeData] Additional data that can be sent to a bridge.
	 * @param [transaction.refundRecipient] The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	async estimateGasDeposit(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		customBridgeData?: web3Types.Bytes;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<bigint> {
		if (isAddressEq(transaction.token, LEGACY_ETH_ADDRESS)) {
			transaction.token = ETH_ADDRESS_IN_CONTRACTS;
		}
		const tx = await this.getDepositTx(transaction);

		let baseGasLimit: bigint;
		if (tx.token && isAddressEq(tx.token, await this.getBaseToken())) {
			baseGasLimit = await this.estimateGasRequestExecute(tx);
		} else {
			baseGasLimit = await this._contextL1().eth.estimateGas(tx);
		}

		return scaleGasLimit(baseGasLimit);
	}

	/**
	 * Returns a populated deposit transaction.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.token The address of the token to deposit. ETH by default.
	 * @param transaction.amount The amount of the token to deposit.
	 * @param [transaction.to] The address that will receive the deposited tokens on L2.
	 * @param [transaction.operatorTip] (currently not used) If the ETH value passed with the transaction is not
	 * explicitly stated in the overrides, this field will be equal to the tip the operator will receive on top of the
	 * base cost of the transaction.
	 * @param [transaction.bridgeAddress] The address of the bridge contract to be used. Defaults to the default ZKsync
	 * Era bridge (either `L1EthBridge` or `L1Erc20Bridge`).
	 * @param [transaction.l2GasLimit] Maximum amount of L2 gas that the transaction can consume during execution on L2.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.customBridgeData] Additional data that can be sent to a bridge.
	 * @param [transaction.refundRecipient] The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	async getDepositTx(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<any> {
		if (isAddressEq(transaction.token, LEGACY_ETH_ADDRESS)) {
			transaction.token = ETH_ADDRESS_IN_CONTRACTS;
		}
		const baseTokenAddress = await this.getBaseToken();
		const isETHBasedChain = isAddressEq(baseTokenAddress, ETH_ADDRESS_IN_CONTRACTS);

		if (isETHBasedChain && isAddressEq(transaction.token, ETH_ADDRESS_IN_CONTRACTS)) {
			return await this._getDepositETHOnETHBasedChainTx(transaction);
		} else if (isETHBasedChain) {
			return await this._getDepositTokenOnETHBasedChainTx(transaction);
		} else if (isAddressEq(transaction.token, ETH_ADDRESS_IN_CONTRACTS)) {
			return (await this._getDepositETHOnNonETHBasedChainTx(transaction)).tx;
		} else if (isAddressEq(transaction.token, baseTokenAddress)) {
			return (await this._getDepositBaseTokenOnNonETHBasedChainTx(transaction)).tx;
		} else {
			return (await this._getDepositNonBaseTokenToNonETHBasedChainTx(transaction)).tx;
		}
	}

	async _getDepositNonBaseTokenToNonETHBasedChainTx(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}) {
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const bridgeContracts = await this.getL1BridgeContracts();

		const tx = await this._getDepositTxWithDefaults(transaction);
		const {
			token,
			operatorTip,
			amount,
			overrides,
			l2GasLimit,
			to,
			refundRecipient,
			gasPerPubdataByte,
		} = tx;

		const baseCost = await this.getBaseCost({
			gasPrice: overrides.maxFeePerGas || overrides.gasPrice,
			gasLimit: l2GasLimit,
			gasPerPubdataByte: gasPerPubdataByte,
			chainId,
		});

		const mintValue = web3Utils.toBigInt(baseCost) + web3Utils.toBigInt(operatorTip);
		await checkBaseCost(baseCost, mintValue);
		overrides.value ??= 0;

		return {
			tx: bridgehub.methods.requestL2TransactionTwoBridges({
				chainId: chainId,
				mintValue,
				l2Value: 0,
				l2GasLimit: l2GasLimit,
				l2GasPerPubdataByteLimit: gasPerPubdataByte,
				refundRecipient: refundRecipient ?? ZeroAddress,
				secondBridgeAddress: bridgeContracts.shared.options.address,
				secondBridgeValue: 0,
				secondBridgeCalldata: Web3EthAbi.encodeParameters(
					['address', 'uint256', 'address'],
					[token, amount, to],
				),
			}),
			overrides,
			mintValue: mintValue,
		};
	}

	async _getDepositBaseTokenOnNonETHBasedChainTx(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}) {
		// Depositing the base token to a non-ETH-based chain.
		// Goes through the BridgeHub.
		// Have to give approvals for the sharedBridge.

		const tx = await this._getDepositTxWithDefaults(transaction);
		const { operatorTip, amount, to, overrides, l2GasLimit, gasPerPubdataByte } = tx;

		const baseCost = await this.getBaseCost({
			gasPrice: overrides.maxFeePerGas || overrides.gasPrice,
			gasLimit: l2GasLimit,
			gasPerPubdataByte: gasPerPubdataByte,
		});

		tx.overrides.value = 0;
		return {
			tx: {
				contractAddress: to,
				calldata: '0x',
				mintValue: toBigInt(baseCost) + BigInt(operatorTip) + BigInt(amount),
				l2Value: amount,
				...tx,
			},
			mintValue: toBigInt(baseCost) + BigInt(operatorTip) + BigInt(amount),
		};
	}

	async _getDepositETHOnNonETHBasedChainTx(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}) {
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const sharedBridge = (await this.getL1BridgeContracts()).shared.options.address;

		const tx = await this._getDepositTxWithDefaults(transaction);
		const {
			operatorTip,
			amount,
			overrides,
			l2GasLimit,
			to,
			refundRecipient,
			gasPerPubdataByte,
		} = tx;

		const baseCost = await this.getBaseCost({
			gasPrice: overrides.maxFeePerGas || overrides.gasPrice,
			gasLimit: l2GasLimit,
			chainId: chainId,
			gasPerPubdataByte: gasPerPubdataByte,
		});

		overrides.value ??= amount;
		const mintValue = web3Utils.toBigInt(baseCost) + web3Utils.toBigInt(operatorTip);
		await checkBaseCost(baseCost, mintValue);

		return {
			tx: bridgehub.methods.requestL2TransactionTwoBridges({
				chainId,
				mintValue,
				l2Value: 0,
				l2GasLimit: l2GasLimit,
				l2GasPerPubdataByteLimit: gasPerPubdataByte,
				refundRecipient: refundRecipient ?? ZeroAddress,
				secondBridgeAddress: sharedBridge,
				secondBridgeValue: amount,
				secondBridgeCalldata: Web3EthAbi.encodeParameters(
					['address', 'uint256', 'address'],
					[ETH_ADDRESS_IN_CONTRACTS, 0, to],
				),
			}),
			overrides,
			mintValue: mintValue,
		};
	}

	async _getDepositTokenOnETHBasedChainTx(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<{
		tx: PayableMethodObject;
		overrides: TransactionOverrides;
	}> {
		// Depositing token to an ETH-based chain. Use the ERC20 bridge as done before.
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();

		const tx = await this._getDepositTxWithDefaults(transaction);
		const {
			token,
			operatorTip,
			amount,
			overrides,
			l2GasLimit,
			to,
			refundRecipient,
			gasPerPubdataByte,
		} = tx;

		const baseCost = await this.getBaseCost({
			gasPrice: overrides.maxFeePerGas || overrides.gasPrice,
			gasLimit: l2GasLimit,
			gasPerPubdataByte,
			chainId,
		});

		const mintValue = web3Utils.toBigInt(baseCost) + web3Utils.toBigInt(operatorTip);
		overrides.value ??= mintValue;
		await checkBaseCost(baseCost, mintValue);

		let secondBridgeAddress: Address;
		let secondBridgeCalldata: web3Types.Bytes;
		if (tx.bridgeAddress) {
			secondBridgeAddress = tx.bridgeAddress;
			secondBridgeCalldata = await getERC20DefaultBridgeData(
				transaction.token,
				this._contextL1(),
			);
		} else {
			secondBridgeAddress = (await this.getL1BridgeContracts()).shared.options
				.address as Address;
			secondBridgeCalldata = Web3EthAbi.encodeParameters(
				['address', 'uint256', 'address'],
				[token, amount, to],
			);
		}

		return {
			tx: bridgehub.methods.requestL2TransactionTwoBridges({
				chainId,
				mintValue,
				l2Value: 0,
				l2GasLimit,
				l2GasPerPubdataByteLimit: gasPerPubdataByte,
				refundRecipient: refundRecipient ?? ZeroAddress,
				secondBridgeAddress,
				secondBridgeValue: 0,
				secondBridgeCalldata,
			}),
			overrides,
		};
	}

	async _getDepositETHOnETHBasedChainTx(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}) {
		// Call the BridgeHub directly, like it's done with the DiamondProxy.

		const tx = await this._getDepositTxWithDefaults(transaction);
		const { operatorTip, amount, overrides, l2GasLimit, gasPerPubdataByte, to } = tx;
		const baseCost = await this.getBaseCost({
			gasPrice: overrides.maxFeePerGas || overrides.gasPrice,
			gasLimit: l2GasLimit,
			gasPerPubdataByte,
		});

		overrides.value ??=
			web3Utils.toBigInt(baseCost) +
			web3Utils.toBigInt(operatorTip) +
			web3Utils.toBigInt(amount);

		return {
			contractAddress: to,
			calldata: '0x',
			mintValue: overrides.value,
			l2Value: amount,
			...tx,
		};
	}

	// Creates a shallow copy of a transaction and populates missing fields with defaults.
	async _getDepositTxWithDefaults(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<{
		token: Address;
		amount: web3Types.Numbers;
		to: Address;
		operatorTip: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit: web3Types.Numbers;
		gasPerPubdataByte: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides: TransactionOverrides;
	}> {
		const { ...tx } = transaction;
		tx.to = tx.to ?? this.getAddress();
		tx.operatorTip ??= 0;
		tx.overrides ??= {};
		tx.overrides.from = this.getAddress();
		tx.gasPerPubdataByte ??= REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
		tx.l2GasLimit ??= await this._getL2GasLimit(tx);
		await insertGasPrice(this._contextL1(), tx.overrides);

		return tx as {
			token: Address;
			amount: web3Types.Numbers;
			to: Address;
			operatorTip: web3Types.Numbers;
			bridgeAddress?: Address;
			l2GasLimit: web3Types.Numbers;
			gasPerPubdataByte: web3Types.Numbers;
			customBridgeData?: web3Types.Bytes;
			refundRecipient?: Address;
			overrides: TransactionOverrides;
		};
	}

	// Default behaviour for calculating l2GasLimit of deposit transaction.
	async _getL2GasLimit(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<web3Types.Numbers> {
		if (transaction.bridgeAddress) {
			return await this._getL2GasLimitFromCustomBridge(transaction);
		} else {
			return await estimateDefaultBridgeDepositL2Gas(
				this._contextL1(),
				this._contextL2(),
				transaction.token,
				transaction.amount,
				transaction.to!,
				this.getAddress(),
				transaction.gasPerPubdataByte,
			);
		}
	}

	// Calculates the l2GasLimit of deposit transaction using custom bridge.
	async _getL2GasLimitFromCustomBridge(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		operatorTip?: web3Types.Numbers;
		bridgeAddress?: Address;
		l2GasLimit?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		customBridgeData?: web3Types.Bytes;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<web3Types.Numbers> {
		const customBridgeData =
			transaction.customBridgeData ??
			(await getERC20DefaultBridgeData(transaction.token, this._contextL1()));

		const bridge = new (this._contextL1().eth.Contract)(
			IL1BridgeABI,
			transaction.bridgeAddress,
		);
		const chainId = (await this._contextL2().eth.getChainId()) as web3Types.Numbers;
		const l2Address = await bridge.methods.l2BridgeAddress(chainId).call();
		return await estimateCustomBridgeDepositL2Gas(
			this._contextL2(),
			transaction.bridgeAddress!,
			l2Address,
			transaction.token,
			transaction.amount,
			transaction.to!,
			customBridgeData,
			this.getAddress(),
			transaction.gasPerPubdataByte,
		);
	}

	/**
	 * Retrieves the full needed ETH fee for the deposit. Returns the L1 fee and the L2 fee {@link FullDepositFee}.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.token The address of the token to deposit. ETH by default.
	 * @param [transaction.to] The address that will receive the deposited tokens on L2.
	 * @param [transaction.bridgeAddress] The address of the bridge contract to be used.
	 * Defaults to the default ZKsync Era bridge (either `L1EthBridge` or `L1Erc20Bridge`).
	 * @param [transaction.customBridgeData] Additional data that can be sent to a bridge.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @throws {Error} If:
	 *  - There's not enough balance for the deposit under the provided gas price.
	 *  - There's not enough allowance to cover the deposit.
	 */
	async getFullRequiredDepositFee(transaction: {
		token: Address;
		to?: Address;
		bridgeAddress?: Address;
		customBridgeData?: web3Types.Bytes;
		gasPerPubdataByte?: web3Types.Numbers;
		overrides?: TransactionOverrides;
	}): Promise<FullDepositFee> {
		if (isAddressEq(transaction.token, LEGACY_ETH_ADDRESS)) {
			transaction.token = ETH_ADDRESS_IN_CONTRACTS;
		}
		// It is assumed that the L2 fee for the transaction does not depend on its value.
		const dummyAmount = 1n;
		const bridgehub = await this.getBridgehubContract();

		const chainId = await this._contextL2().eth.getChainId();
		const baseTokenAddress = await this.getBaseToken();

		const isETHBasedChain = isAddressEq(baseTokenAddress, ETH_ADDRESS_IN_CONTRACTS);

		const tx = await this._getDepositTxWithDefaults({
			...transaction,
			amount: dummyAmount,
		});

		const gasPriceForEstimation = tx.overrides.maxFeePerGas || tx.overrides.gasPrice;
		const baseCost = await bridgehub.methods
			.l2TransactionBaseCost(
				chainId as web3Types.Numbers,
				gasPriceForEstimation as web3Types.Numbers,
				tx.l2GasLimit,
				tx.gasPerPubdataByte,
			)
			.call();

		if (isETHBasedChain) {
			// To ensure that L1 gas estimation succeeds when using estimateGasDeposit,
			// the account needs to have a sufficient ETH balance.
			const selfBalanceETH = await this.getBalanceL1();
			if (toBigInt(baseCost) >= toBigInt(selfBalanceETH) + toBigInt(dummyAmount)) {
				const recommendedL1GasLimit = isAddressEq(tx.token, LEGACY_ETH_ADDRESS)
					? L1_RECOMMENDED_MIN_ETH_DEPOSIT_GAS_LIMIT
					: L1_RECOMMENDED_MIN_ERC20_DEPOSIT_GAS_LIMIT;
				const recommendedETHBalance =
					BigInt(recommendedL1GasLimit) * BigInt(gasPriceForEstimation!) +
					toBigInt(baseCost);
				const formattedRecommendedBalance = web3Utils.fromWei(
					recommendedETHBalance,
					'ether',
				);
				throw new Error(
					`Not enough balance for deposit! Under the provided gas price, the recommended balance to perform a deposit is ${formattedRecommendedBalance} ETH`,
				);
			}
			// In case of token deposit, a sufficient token allowance is also required.
			if (
				!isAddressEq(tx.token, ETH_ADDRESS_IN_CONTRACTS) &&
				(await this.getAllowanceL1(tx.token, tx.bridgeAddress)) < dummyAmount
			) {
				throw new Error('Not enough allowance to cover the deposit!');
			}
		} else {
			const mintValue = toBigInt(baseCost) + BigInt(tx.operatorTip);
			if ((await this.getAllowanceL1(baseTokenAddress)) < mintValue) {
				throw new Error('Not enough base token allowance to cover the deposit!');
			}
			if (
				isAddressEq(tx.token, ETH_ADDRESS_IN_CONTRACTS) ||
				isAddressEq(tx.token, baseTokenAddress)
			) {
				tx.overrides.value ??= tx.amount;
			} else {
				tx.overrides.value ??= 0;
				if ((await this.getAllowanceL1(tx.token)) < dummyAmount) {
					throw new Error('Not enough token allowance to cover the deposit!');
				}
			}
		}

		// Deleting the explicit gas limits in the fee estimation
		// in order to prevent the situation where the transaction
		// fails because the user does not have enough balance
		const estimationOverrides = { ...tx.overrides };
		delete estimationOverrides.gasPrice;
		delete estimationOverrides.maxFeePerGas;
		delete estimationOverrides.maxPriorityFeePerGas;

		const l1GasLimit = await this.estimateGasDeposit({
			...tx,
			amount: dummyAmount,
			overrides: estimationOverrides,
			l2GasLimit: tx.l2GasLimit,
		});

		const fullCost: FullDepositFee = {
			baseCost: toBigInt(baseCost),
			l1GasLimit,
			l2GasLimit: BigInt(tx.l2GasLimit),
		};

		if (tx.overrides.gasPrice) {
			fullCost.gasPrice = BigInt(tx.overrides.gasPrice);
		} else {
			fullCost.maxFeePerGas = BigInt(tx.overrides.maxFeePerGas!);
			fullCost.maxPriorityFeePerGas = BigInt(tx.overrides.maxPriorityFeePerGas!);
		}

		return fullCost;
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
		return this._contextL2().getPriorityOpConfirmation(txHash, index);
	}

	async _getWithdrawalLog(
		withdrawalHash: web3Types.Bytes,
		index = 0,
	): Promise<{
		log: ZKTransactionReceiptLog;
		l1BatchTxId: Numbers;
	}> {
		const hash = web3Utils.toHex(withdrawalHash);
		const receipt = await this._contextL2().getZKTransactionReceipt(hash);
		if (!receipt) {
			// @todo: or throw?
			return {
				// @ts-ignore
				log: {},
				l1BatchTxId: 0n,
			};
		}

		const topic = id('L1MessageSent(address,bytes32,bytes)');
		// @ts-ignore
		const log = (receipt?.logs || []).filter(
			// @ts-ignore
			l =>
				isAddressEq(String(l?.address), L1_MESSENGER_ADDRESS) &&
				l?.topics &&
				String(l?.topics[0]) === topic,
		)[index];

		return {
			log,
			l1BatchTxId: receipt.l1BatchTxIndex,
		};
	}

	async _getWithdrawalL2ToL1Log(withdrawalHash: web3Types.Bytes, index = 0) {
		const hash = web3Utils.toHex(withdrawalHash);
		const receipt = await this._contextL2().getZKTransactionReceipt(hash);
		if (!receipt) {
			// @todo: or throw?
			return {};
		}
		const messages = Array.from(receipt.l2ToL1Logs.entries()).filter(([, log]) =>
			isAddressEq(log.sender, L1_MESSENGER_ADDRESS),
		);
		const [l2ToL1LogIndex, l2ToL1Log] = messages[index];

		return {
			l2ToL1LogIndex,
			l2ToL1Log,
		};
	}

	/**
	 * Returns the {@link FinalizeWithdrawalParams parameters} required for finalizing a withdrawal from the
	 * withdrawal transaction's log on the L1 network.
	 *
	 * @param withdrawalHash Hash of the L2 transaction where the withdrawal was initiated.
	 * @param [index=0] In case there were multiple withdrawals in one transaction, you may pass an index of the
	 * withdrawal you want to finalize.
	 * @throws {Error} If log proof can not be found.
	 */
	async finalizeWithdrawalParams(
		withdrawalHash: web3Types.Bytes,
		index = 0,
	): Promise<FinalizeWithdrawalParams> {
		const { log, l1BatchTxId } = await this._getWithdrawalLog(withdrawalHash, index);
		const { l2ToL1LogIndex } = await this._getWithdrawalL2ToL1Log(withdrawalHash, index);
		const sender = log?.topics && dataSlice(toBytes(log?.topics[1]), 12);
		const proof = await this._contextL2().getL2ToL1LogProof(
			toHex(withdrawalHash),
			l2ToL1LogIndex,
		);
		if (!proof) {
			throw new Error('Log proof not found!');
		}
		const message = Web3EthAbi.decodeParameters(['bytes'], log.data as HexString)[0];
		return {
			l1BatchNumber: log.l1BatchNumber,
			l2MessageIndex: Number(toNumber(proof.id)),
			l2TxNumberInBlock: l1BatchTxId !== undefined ? Number(toNumber(l1BatchTxId)) : null,
			message,
			sender: sender as Address,
			proof: proof.proof,
		};
	}

	/**
	 * Proves the inclusion of the `L2->L1` withdrawal message.
	 *
	 * @param withdrawalHash Hash of the L2 transaction where the withdrawal was initiated.
	 * @param [index=0] In case there were multiple withdrawals in one transaction, you may pass an index of the
	 * withdrawal you want to finalize.
	 * @param [overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @returns A promise that resolves to the proof of inclusion of the withdrawal message.
	 * @throws {Error} If log proof can not be found.
	 */
	async finalizeWithdrawal(
		withdrawalHash: web3Types.Bytes,
		index = 0,
		overrides?: TransactionOverrides,
	) {
		const { l1BatchNumber, l2MessageIndex, l2TxNumberInBlock, message, proof } =
			await this.finalizeWithdrawalParams(withdrawalHash, index);

		const l1Contracts = await this.getL1BridgeContracts();
		const contract = new (this._contextL1().eth.Contract)(
			IL1BridgeABI,
			l1Contracts.shared.options.address,
		);
		overrides = overrides ?? {};
		overrides.from ??= this.getAddress();

		return (
			contract.methods
				.finalizeWithdrawal(
					(await this._contextL2().eth.getChainId()) as web3Types.Numbers,
					l1BatchNumber as web3Types.Numbers,
					l2MessageIndex as web3Types.Numbers,
					l2TxNumberInBlock as web3Types.Numbers,
					message,
					proof,
				)
				// @ts-ignore
				.send(overrides ?? {})
		);
	}

	/**
	 * Returns whether the withdrawal transaction is finalized on the L1 network.
	 *
	 * @param withdrawalHash Hash of the L2 transaction where the withdrawal was initiated.
	 * @param [index=0] In case there were multiple withdrawals in one transaction, you may pass an index of the
	 * withdrawal you want to finalize.
	 * @throws {Error} If log proof can not be found.
	 */
	async isWithdrawalFinalized(withdrawalHash: web3Types.Bytes, index = 0): Promise<boolean> {
		const { log } = await this._getWithdrawalLog(withdrawalHash, index);
		const { l2ToL1LogIndex } = await this._getWithdrawalL2ToL1Log(withdrawalHash, index);
		const sender = dataSlice((log && log.topics && log.topics[1]) as unknown as Bytes, 12);
		// `getLogProof` is called not to get proof but
		// to get the index of the corresponding L2->L1 log,
		// which is returned as `proof.id`.
		const proof = await this._contextL2().getL2ToL1LogProof(
			toHex(withdrawalHash),
			l2ToL1LogIndex,
		);
		if (!proof) {
			throw new Error('Log proof not found!');
		}

		const chainId = await this._contextL2().eth.getChainId();

		let l1Bridge: Web3.Contract<typeof IL1BridgeABI> | Web3.Contract<typeof IL1SharedBridgeABI>;

		if (await this._contextL2().isBaseToken(sender)) {
			l1Bridge = (await this.getL1BridgeContracts()).shared;
		} else {
			const l2BridgeContract = new (this._contextL2().eth.Contract)(IL2BridgeABI, sender);
			const l1BridgeAddress = await l2BridgeContract.methods.l1Bridge().call();
			l1Bridge = new (this._contextL1().eth.Contract)(IL1SharedBridgeABI, l1BridgeAddress);
		}

		return await l1Bridge.methods
			.isWithdrawalFinalized(chainId, log!.l1BatchNumber, proof.id)
			.call();
	}

	/**
	 * Withdraws funds from the initiated deposit, which failed when finalizing on L2.
	 * If the deposit L2 transaction has failed, it sends an L1 transaction calling `claimFailedDeposit` method of the
	 * L1 bridge, which results in returning L1 tokens back to the depositor.
	 *
	 * @param depositHash The L2 transaction hash of the failed deposit.
	 * @param [overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 * @returns A promise that resolves to the response of the `claimFailedDeposit` transaction.
	 * @throws {Error} If attempting to claim successful deposit.
	 */
	async claimFailedDeposit(
		depositHash: web3Types.Bytes,
		overrides?: TransactionOverrides,
	): Promise<TransactionReceipt> {
		const receipt = await this._contextL2().getZKTransactionReceipt(
			web3Utils.toHex(depositHash),
		);
		if (!receipt) {
			throw new Error('Transaction not found!');
		}
		const successL2ToL1LogIndex = receipt.l2ToL1Logs.findIndex(
			l2ToL1log =>
				isAddressEq(l2ToL1log.sender, BOOTLOADER_FORMAL_ADDRESS) &&
				l2ToL1log.key === depositHash,
		);
		const successL2ToL1Log = receipt.l2ToL1Logs[successL2ToL1LogIndex];
		if (successL2ToL1Log.value !== ZeroHash) {
			throw new Error('Cannot claim successful deposit!');
		}

		const tx = await this._contextL2().eth.getTransaction(web3Utils.toHex(depositHash));

		// Undo the aliasing, since the Mailbox contract set it as for contract address.
		const l1BridgeAddress = undoL1ToL2Alias(receipt.from);
		const l2BridgeAddress = receipt.to;
		if (!l2BridgeAddress) {
			throw new Error('L2 bridge address not found!');
		}
		const l1Bridge = new (this._contextL1().eth.Contract)(IL1BridgeABI, l1BridgeAddress);

		const l2Bridge = new Web3.Contract(IL2BridgeABI, l1BridgeAddress);
		l2Bridge.setProvider(this._contextL2().provider);

		const m = l2Bridge.methods.finalizeDeposit(tx.from, tx.from, tx.from, 0n, '0x');
		const calldata = m.decodeData(tx.data as HexString);

		const proof = await this._contextL2().getL2ToL1LogProof(
			web3Utils.toHex(depositHash),
			successL2ToL1LogIndex,
		);
		if (!proof) {
			throw new Error('Log proof not found!');
		}
		return (
			l1Bridge.methods
				.claimFailedDeposit(
					(await this._contextL2().eth.getChainId()) as web3Types.Numbers,
					calldata[0], //_l1Sender
					calldata[2], //_l1Token
					calldata[3], //_amount
					depositHash,
					receipt.l1BatchNumber,
					proof.id,
					receipt.l1BatchTxIndex,
					proof.proof,
				)
				// @ts-ignore
				.send({
					from: this.getAddress(),
					...(overrides ?? {}),
				})
		);
	}

	/**
	 * Requests execution of an L2 transaction from L1.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.contractAddress The L2 contract to be called.
	 * @param transaction.calldata The input of the L2 transaction.
	 * @param [transaction.l2GasLimit] Maximum amount of L2 gas that transaction can consume during execution on L2.
	 * @param [transaction.mintValue] The amount of base token that needs to be minted on non-ETH-based L2.
	 * @param [transaction.l2Value] `msg.value` of L2 transaction.
	 * @param [transaction.factoryDeps] An array of L2 bytecodes that will be marked as known on L2.
	 * @param [transaction.operatorTip] (currently not used) If the ETH value passed with the transaction is not
	 * explicitly stated in the overrides, this field will be equal to the tip the operator will receive on top of
	 * the base cost of the transaction.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.refundRecipient] The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 * @returns A promise that resolves to the response of the execution request.
	 */
	async requestExecute(transaction: {
		contractAddress: Address;
		calldata: string;
		l2GasLimit?: web3Types.Numbers;
		mintValue?: web3Types.Numbers;
		l2Value?: web3Types.Numbers;
		factoryDeps?: web3Types.Bytes[];
		operatorTip?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<PriorityOpResponse> {
		const tx = await this.getRequestExecuteTx(transaction);
		return this.signAndSend(tx);
	}
	async signAndSend(tx: Transaction, _context?: Web3ZKsyncL1 | Web3ZKsyncL2) {
		const context = _context || this._contextL1();
		const populated = await context.populateTransaction(tx);
		const signed = await context.signTransaction(populated as Transaction);

		return getPriorityOpResponse(
			context,
			context.sendRawTransaction(signed),
			this._contextL2(),
		);
	}
	async signTransaction(tx: Transaction): Promise<string> {
		return this._contextL1().signTransaction(tx);
	}
	async sendRawTransaction(signedTx: string): Promise<TransactionHash> {
		return this._contextL1().sendRawTransaction(signedTx);
	}
	/**
	 * Estimates the amount of gas required for a request execute transaction.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.contractAddress The L2 contract to be called.
	 * @param transaction.calldata The input of the L2 transaction.
	 * @param [transaction.l2GasLimit] Maximum amount of L2 gas that transaction can consume during execution on L2.
	 * @param [transaction.mintValue] The amount of base token that needs to be minted on non-ETH-based L2.
	 * @param [transaction.l2Value] `msg.value` of L2 transaction.
	 * @param [transaction.factoryDeps] An array of L2 bytecodes that will be marked as known on L2.
	 * @param [transaction.operatorTip] (currently not used) If the ETH value passed with the transaction is not
	 * explicitly stated in the overrides, this field will be equal to the tip the operator will receive on top
	 * of the base cost of the transaction.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.refundRecipient] The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	async estimateGasRequestExecute(transaction: {
		contractAddress: Address;
		calldata: string;
		l2GasLimit?: web3Types.Numbers;
		mintValue?: web3Types.Numbers;
		l2Value?: web3Types.Numbers;
		factoryDeps?: web3Types.Bytes[];
		operatorTip?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<bigint> {
		const { method, overrides } = await this.getRequestExecuteContractMethod(transaction);

		delete overrides.gasPrice;
		delete overrides.maxFeePerGas;
		delete overrides.maxPriorityFeePerGas;

		return method.estimateGas(overrides as PayableTxOptions);
	}

	/**
	 * Returns the parameters for the approval token transaction based on the request execute transaction.
	 * Existing allowance for the bridge is not checked; allowance is calculated solely based on the specified transaction.
	 *
	 * @param transaction The request execute transaction on which approval parameters are calculated.
	 */
	async getRequestExecuteAllowanceParams(transaction: {
		contractAddress: Address;
		calldata: string;
		l2GasLimit?: web3Types.Numbers;
		l2Value?: web3Types.Numbers;
		factoryDeps?: web3Types.Bytes[];
		operatorTip?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}): Promise<{ token: Address; allowance: web3Types.Numbers }> {
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const isETHBaseToken = isAddressEq(
			await bridgehub.methods.baseToken(chainId).call(),
			ETH_ADDRESS_IN_CONTRACTS,
		);

		if (isETHBaseToken) {
			throw new Error(
				"ETH token can't be approved! The address of the token does not exist on L1.",
			);
		}

		const { ...tx } = transaction;
		tx.l2Value ??= 0n;
		tx.operatorTip ??= 0n;
		tx.factoryDeps ??= [];
		tx.overrides ??= {};
		tx.gasPerPubdataByte ??= REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
		tx.refundRecipient ??= this.getAddress();
		tx.l2GasLimit ??= await this._contextL2().estimateL1ToL2Execute(transaction);

		const { l2Value, l2GasLimit, operatorTip, overrides, gasPerPubdataByte } = tx;

		await insertGasPrice(this._contextL1(), overrides);
		const gasPriceForEstimation = overrides.maxFeePerGas || overrides.gasPrice;

		const baseCost = await this.getBaseCost({
			gasPrice: gasPriceForEstimation!,
			gasPerPubdataByte,
			gasLimit: l2GasLimit,
		});

		return {
			token: await this.getBaseToken(),
			allowance: baseCost + BigInt(operatorTip) + BigInt(l2Value),
		};
	}
	async getRequestExecuteContractMethod(transaction: {
		contractAddress: Address;
		calldata: string;
		l2GasLimit?: web3Types.Numbers;
		mintValue?: web3Types.Numbers;
		l2Value?: web3Types.Numbers;
		factoryDeps?: web3Types.Bytes[];
		operatorTip?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}) {
		const bridgehub = await this.getBridgehubContract();
		const chainId = await this._contextL2().eth.getChainId();
		const isETHBaseToken = isAddressEq(
			await bridgehub.methods.baseToken(chainId).call(),
			ETH_ADDRESS_IN_CONTRACTS,
		);

		const { ...tx } = transaction;
		tx.l2Value ??= 0;
		tx.mintValue ??= 0;
		tx.operatorTip ??= 0;
		tx.factoryDeps ??= [];
		tx.overrides ??= {};
		tx.overrides.from ??= this.getAddress();
		tx.gasPerPubdataByte ??= REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
		tx.refundRecipient ??= this.getAddress();
		tx.l2GasLimit ??= await this._contextL2().estimateL1ToL2Execute(transaction);

		const {
			contractAddress,
			mintValue,
			l2Value,
			calldata,
			l2GasLimit,
			factoryDeps,
			operatorTip,
			overrides,
			gasPerPubdataByte,
			refundRecipient,
		} = tx;

		await insertGasPrice(this._contextL1(), overrides);
		const gasPriceForEstimation = overrides.maxFeePerGas || overrides.gasPrice;

		const baseCost = await this.getBaseCost({
			gasPrice: gasPriceForEstimation!,
			gasPerPubdataByte,
			gasLimit: l2GasLimit,
		});

		const l2Costs = baseCost + BigInt(operatorTip) + BigInt(l2Value);
		let providedValue = isETHBaseToken ? overrides.value : mintValue;
		if (providedValue === undefined || providedValue === null || BigInt(providedValue) === 0n) {
			providedValue = l2Costs;
			if (isETHBaseToken) overrides.value = providedValue;
		}
		await checkBaseCost(baseCost, providedValue);

		const method = bridgehub.methods.requestL2TransactionDirect({
			chainId,
			mintValue: providedValue,
			l2Contract: contractAddress,
			l2Value: l2Value,
			l2Calldata: calldata,
			l2GasLimit: l2GasLimit,
			l2GasPerPubdataByteLimit: REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
			factoryDeps: factoryDeps,
			refundRecipient: refundRecipient,
		});
		return { method, overrides };
	}
	/**
	 * Returns a populated request execute transaction.
	 *
	 * @param transaction The transaction details.
	 * @param transaction.contractAddress The L2 contract to be called.
	 * @param transaction.calldata The input of the L2 transaction.
	 * @param [transaction.l2GasLimit] Maximum amount of L2 gas that transaction can consume during execution on L2.
	 * @param [transaction.mintValue] The amount of base token that needs to be minted on non-ETH-based L2.
	 * @param [transaction.l2Value] `msg.value` of L2 transaction.
	 * @param [transaction.factoryDeps] An array of L2 bytecodes that will be marked as known on L2.
	 * @param [transaction.operatorTip] (currently not used) If the ETH value passed with the transaction is not
	 * explicitly stated in the overrides, this field will be equal to the tip the operator will receive on top of the
	 * base cost of the transaction.
	 * @param [transaction.gasPerPubdataByte] The L2 gas price for each published L1 calldata byte.
	 * @param [transaction.refundRecipient] The address on L2 that will receive the refund for the transaction.
	 * If the transaction fails, it will also be the address to receive `l2Value`.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L1 `gasLimit`, `gasPrice`, `value`, etc.
	 */
	async getRequestExecuteTx(transaction: {
		contractAddress: Address;
		calldata: string;
		l2GasLimit?: web3Types.Numbers;
		mintValue?: web3Types.Numbers;
		l2Value?: web3Types.Numbers;
		factoryDeps?: web3Types.Bytes[];
		operatorTip?: web3Types.Numbers;
		gasPerPubdataByte?: web3Types.Numbers;
		refundRecipient?: Address;
		overrides?: TransactionOverrides;
	}) {
		const { method, overrides } = await this.getRequestExecuteContractMethod(transaction);
		return method.populateTransaction(overrides as PayableTxOptions);
	}

	async populateTransaction(tx: Transaction): Promise<Transaction | Eip712TxData> {
		tx.from = this.getAddress();

		if (
			(!tx.type || (tx.type && toHex(tx.type) !== toHex(EIP712_TX_TYPE))) &&
			!(tx as Eip712TxData).customData
		) {
			return this._contextL1().populateTransaction(tx);
		}

		const populated = (await this._contextL1().populateTransaction(tx)) as Eip712TxData;
		populated.type = EIP712_TX_TYPE;
		populated.value ??= 0;
		populated.data ??= '0x';

		return populated;
	}
	// @ts-ignore
	public getAddress(): string {
		throw new Error('Must be implemented by the derived class!');
	}
}

export class AdapterL2 implements TxSender {
	/**
	 * Returns a context (provider + Signer) instance for connecting to an L2 network.
	 */
	_contextL2(): Web3ZKsyncL2 {
		throw new Error('Must be implemented by the derived class!');
	}
	async _eip712Signer(): Promise<EIP712Signer> {
		throw new Error('Must be implemented by the derived class!');
	}

	/**
	 * Returns the balance of the account.
	 *
	 * @param [token] The token address to query balance for. Defaults to the native token.
	 * @param [blockTag='committed'] The block tag to get the balance at.
	 */
	async getBalance(
		token?: Address,
		blockTag: web3Types.BlockNumberOrTag = 'latest',
	): Promise<bigint> {
		return await this._contextL2().getBalance(this.getAddress(), blockTag, token);
	}

	/**
	 * Returns all token balances of the account.
	 */
	async getAllBalances(): Promise<WalletBalances> {
		return this._contextL2().getAllAccountBalances(this.getAddress());
	}

	/**
	 * Returns the deployment nonce of the account.
	 */
	async getDeploymentNonce(): Promise<bigint> {
		const contract = new Web3.Contract(INonceHolderABI, NONCE_HOLDER_ADDRESS);
		contract.setProvider(this._contextL2().provider);
		return contract.methods.getDeploymentNonce(this.getAddress()).call();
	}

	/**
	 * Returns L2 bridge contracts.
	 */
	async getL2BridgeContracts(): Promise<{
		erc20: Web3.Contract<typeof IL2BridgeABI>;
		weth: Web3.Contract<typeof IL2BridgeABI>;
		shared: Web3.Contract<typeof IL2BridgeABI>;
	}> {
		const addresses = await this._contextL2().getDefaultBridgeAddresses();
		const erc20 = new Web3.Contract(IL2BridgeABI, addresses.erc20L2);
		const weth = new Web3.Contract(IL2BridgeABI, addresses.wethL2);
		const shared = new Web3.Contract(IL2BridgeABI, addresses.sharedL2);

		erc20.setProvider(this._contextL2().provider);
		weth.setProvider(this._contextL2().provider);
		shared.setProvider(this._contextL2().provider);

		return {
			erc20,
			weth,
			shared,
		};
	}

	/**
	 * Initiates the withdrawal process which withdraws ETH or any ERC20 token
	 * from the associated account on L2 network to the target account on L1 network.
	 *
	 * @param transaction Withdrawal transaction request.
	 * @param transaction.token The address of the token. Defaults to ETH.
	 * @param transaction.amount The amount of the token to withdraw.
	 * @param [transaction.to] The address of the recipient on L1.
	 * @param [transaction.bridgeAddress] The address of the bridge contract to be used.
	 * @param [transaction.paymasterParams] Paymaster parameters.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 * @returns A Promise resolving to a withdrawal transaction response.
	 */
	async withdraw(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		bridgeAddress?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		const tx = await this._contextL2().getWithdrawTx({
			...transaction,
			from: this.getAddress(),
		});
		const populated = await this.populateTransaction(tx as Transaction);
		const signed = await this.signTransaction(populated as Transaction);
		return getPriorityOpResponse(
			this._contextL2(),
			this.sendRawTransaction(signed),
			this._contextL2(),
		);
	}

	async signTransaction(tx: Transaction): Promise<string> {
		return this._contextL2().signTransaction(tx);
	}
	async sendRawTransaction(signedTx: string): Promise<TransactionHash> {
		return this._contextL2().sendRawTransaction(signedTx);
	}

	/**
	 * Transfer ETH or any ERC20 token within the same interface.
	 *
	 * @param transaction Transfer transaction request.
	 * @param transaction.to The address of the recipient.
	 * @param transaction.amount The amount of the token to transfer.
	 * @param [transaction.token] The address of the token. Defaults to ETH.
	 * @param [transaction.paymasterParams] Paymaster parameters.
	 * @param [transaction.overrides] Transaction's overrides which may be used to pass L2 `gasLimit`, `gasPrice`, `value`, etc.
	 * @returns A Promise resolving to a transfer transaction response.
	 */
	async transferTx(transaction: {
		to: Address;
		amount: web3Types.Numbers;
		token?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}): Promise<Transaction> {
		return this._contextL2().getTransferTx({
			from: this.getAddress(),
			...transaction,
		});
	}
	// @ts-ignore
	public getAddress(): string {
		throw new Error('Must be implemented by the derived class!');
	}

	async populateTransaction(tx: Transaction): Promise<Transaction | Eip712TxData> {
		tx.from = this.getAddress();
		if (
			(!tx.type || (tx.type && toHex(tx.type) !== toHex(EIP712_TX_TYPE))) &&
			!(tx as Eip712TxData).customData
		) {
			return this._contextL2().populateTransaction(tx);
		}

		const populated = (await this._contextL2().populateTransaction(tx)) as Eip712TxData;
		populated.type = EIP712_TX_TYPE;
		populated.value ??= 0;
		populated.data ??= '0x';

		return populated;
	}
}

// This method checks if the overrides contain a gasPrice (or maxFeePerGas),
// if not it will insert the maxFeePerGas
async function insertGasPrice(
	l1Provider: Web3.Web3,
	overrides: TransactionOverrides,
): Promise<void> {
	if (!overrides.gasPrice && !overrides.maxFeePerGas) {
		const l1FeeData = await l1Provider.eth.calculateFeeData();
		// Sometimes baseFeePerGas is not available, so we use gasPrice instead.
		const baseFee = BigInt(
			l1FeeData.maxFeePerGas! ? getBaseCostFromFeeData(l1FeeData) : l1FeeData.gasPrice!,
		);
		if (!baseFee) {
			throw new Error('Failed to calculate base fee!');
		}

		// ethers.js by default uses multiplication by 2, but since the price for the L2 part
		// will depend on the L1 part, doubling base fee is typically too much.
		overrides.maxFeePerGas =
			(baseFee * 3n) / 2n + (BigInt(l1FeeData.maxPriorityFeePerGas!) ?? 0n);
		overrides.maxPriorityFeePerGas =
			l1FeeData.maxPriorityFeePerGas && toHex(l1FeeData.maxPriorityFeePerGas);
	}
}

function getBaseCostFromFeeData(feeData: web3Types.FeeData): bigint {
	const maxFeePerGas = feeData.maxFeePerGas!;
	const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas!;

	return (BigInt(maxFeePerGas) - BigInt(maxPriorityFeePerGas)) / 2n;
}
