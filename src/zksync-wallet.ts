import type { Web3 } from 'web3';
import { Web3Account, privateKeyToAccount, create as createAccount } from 'web3-eth-accounts';
import type * as web3Types from 'web3-types';
import type { Web3ZkSyncL2 } from './web3zksync-l2';
import * as utils from './utils';
import { AdapterL1, AdapterL2 } from './adapters';
import type {
	Address,
	Eip712Meta,
	PaymasterParams,
	TransactionOverrides,
	TransactionRequest,
} from './types';
import { EIP712, EIP712Signer } from './utils';
import { BlockNumberOrTag, Numbers, Transaction } from 'web3-types';
import { EIP712_TX_TYPE } from './constants';
import { toHex, toNumber } from 'web3-utils';

class Adapters extends AdapterL1 {
	adapterL2: AdapterL2;
	constructor() {
		super();
		this.adapterL2 = new AdapterL2();
		this.adapterL2.getAddress = this.getAddress.bind(this);
		this.adapterL2._contextL2 = this._contextL2.bind(this);
		this.adapterL2._eip712Signer = this._eip712Signer.bind(this);
	}
	getBalance(token?: Address, blockTag: web3Types.BlockNumberOrTag = 'committed') {
		return this.adapterL2.getBalance(token, blockTag);
	}
	getAllBalances() {
		return this.adapterL2.getAllBalances();
	}
	getDeploymentNonce() {
		return this.adapterL2.getDeploymentNonce();
	}
	getL2BridgeContracts() {
		return this.adapterL2.getL2BridgeContracts();
	}
	_fillCustomData(data: Eip712Meta) {
		return this.adapterL2._fillCustomData(data);
	}
	protected async _eip712Signer(): Promise<EIP712Signer> {
		throw new Error('Must be implemented by the derived class!');
	}

	withdraw(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		bridgeAddress?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		return this.adapterL2.withdraw(transaction);
	}
	transfer(transaction: {
		to: Address;
		amount: web3Types.Numbers;
		token?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		return this.adapterL2.transfer(transaction);
	}
}

export class ZKSyncWallet extends Adapters {
	provider?: Web3ZkSyncL2;
	providerL1?: Web3;
	protected eip712!: utils.EIP712Signer;
	public account: Web3Account;

	/**
	 *
	 * @param privateKey The private key of the account.
	 * @param providerL2 The provider instance for connecting to a L2 network.
	 * @param providerL1 The provider instance for connecting to a L1 network.
	 *
	 * @example
	 *
	 * import { Wallet, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const PRIVATE_KEY = "<WALLET_PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const ethProvider = ethers.getDefaultProvider("sepolia");
	 * const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);
	 */
	constructor(privateKey: string, providerL2?: Web3ZkSyncL2, providerL1?: Web3) {
		super();

		this.account = privateKeyToAccount(privateKey);
		if (providerL2) {
			this.connect(providerL2);
		}
		if (providerL1) {
			this.connectToL1(providerL1);
		}
	}
	public connect(provider: Web3ZkSyncL2) {
		provider.eth.accounts.wallet.add(this.account);
		this.provider = provider;
		return this;
	}
	public connectToL1(provider: Web3) {
		provider.eth.accounts.wallet.add(this.account);
		this.providerL1 = provider;
		return this;
	}

	protected async _eip712Signer(): Promise<utils.EIP712Signer> {
		if (!this.eip712) {
			this.eip712 = new utils.EIP712Signer(
				this.account,
				Number(await this.provider!.eth.getChainId()),
			);
		}

		return this.eip712!;
	}
	protected _contextL1() {
		return this.providerL1!;
	}
	protected _contextL2() {
		return this.provider!;
	}

	getBalanceL1(token?: Address, blockTag?: web3Types.BlockNumberOrTag) {
		return super.getBalanceL1(token, blockTag);
	}
	getBalance(token?: Address, blockTag: web3Types.BlockNumberOrTag = 'committed') {
		return super.getBalance(token, blockTag);
	}
	getAddress(): any {
		return this.account.address;
	}
	deposit(transaction: {
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
	}) {
		return super.deposit(transaction);
	}
	getNonce(blockNumber?: BlockNumberOrTag) {
		return this.provider?.eth.getTransactionCount(this.account.address, blockNumber);
	}
	static createRandom(provider?: Web3ZkSyncL2, providerL1?: Web3) {
		const acc = createAccount();
		return new ZKSyncWallet(acc.privateKey, provider, providerL1);
	}
	async signTransaction(transaction: TransactionRequest) {
		const populated = await this.populateTransaction(transaction);
		if (populated.type !== EIP712_TX_TYPE) {
			return this.provider?.eth.signTransaction(populated);
		}

		return EIP712.serialize(populated);
	}

	/**
	 * Designed for users who prefer a simplified approach by providing only the necessary data to create a valid transaction.
	 * The only required fields are `transaction.to` and either `transaction.data` or `transaction.value` (or both, if the method is payable).
	 * Any other fields that are not set will be prepared by this method.
	 *
	 * @param tx The transaction request that needs to be populated.
	 *
	 * @example
	 *
	 * import { Wallet, Provider, types, utils } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const PRIVATE_KEY = "<WALLET_PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const ethProvider = ethers.getDefaultProvider("sepolia");
	 * const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);
	 *
	 * const populatedTx = await wallet.populateTransaction({
	 *   type: utils.EIP712_TX_TYPE,
	 *   to: RECEIVER,
	 *   value: 7_000_000_000n,
	 * });
	 */
	override async populateTransaction(tx: TransactionRequest) {
		if ((!tx.type || toNumber(tx.type) !== EIP712_TX_TYPE) && !tx.customData) {
			this.provider?.eth.po;
			return await super.populateTransaction(tx);
		}

		tx.type = toHex(EIP712_TX_TYPE);
		const populated = await super.populateTransaction(tx);

		populated.type = EIP712_TX_TYPE;
		populated.value ??= 0;
		populated.data ??= '0x';
		populated.customData = this._fillCustomData((tx.customData ?? {}) as Eip712Meta);
		if (!populated.maxFeePerGas && !populated.maxPriorityFeePerGas) {
			populated.gasPrice = await this.provider?.eth.getGasPrice();
		}
		return populated;
	}
}
