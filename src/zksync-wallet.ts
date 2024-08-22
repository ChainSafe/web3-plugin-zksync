import type { Web3Account } from 'web3-eth-accounts';
import { privateKeyToAccount, create as createAccount } from 'web3-eth-accounts';
import type * as web3Types from 'web3-types';
import type { Transaction } from 'web3-types';
import type { Web3ZKsyncL2 } from './web3zksync-l2';
import type { Web3ZKsyncL1 } from './web3zksync-l1';
import * as utils from './utils';
import { AdapterL1, AdapterL2 } from './adapters';
import type { Address, Eip712TxData, PaymasterParams, TransactionOverrides } from './types';
import type { EIP712Signer } from './utils';
import { getPriorityOpResponse, isAddressEq } from './utils';

class Adapters extends AdapterL1 {
	adapterL2: AdapterL2;
	constructor() {
		super();
		this.adapterL2 = new AdapterL2();
		this.adapterL2.getAddress = this.getAddress.bind(this);
		this.adapterL2._contextL2 = this._contextL2.bind(this);
		this.adapterL2._eip712Signer = this._eip712Signer;
	}
	getBalance(token?: Address, blockTag: web3Types.BlockNumberOrTag = 'latest') {
		return this.adapterL2.getBalance(token, blockTag);
	}
	getAllBalances() {
		return this.adapterL2.getAllBalances();
	}

	async populateTransaction(
		tx: web3Types.Transaction,
	): Promise<web3Types.Transaction | Eip712TxData> {
		return this.adapterL2.populateTransaction(tx);
	}

	getDeploymentNonce() {
		return this.adapterL2.getDeploymentNonce();
	}
	getL2BridgeContracts() {
		return this.adapterL2.getL2BridgeContracts();
	}
	protected async _eip712Signer(): Promise<EIP712Signer> {
		throw new Error('Must be implemented by the derived class!');
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
	 */
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
	async transfer(transaction: {
		to: Address;
		amount: web3Types.Numbers;
		token?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		return this.signAndSend(
			(await this.adapterL2.transferTx(transaction)) as Transaction,
			this._contextL2(),
		);
	}
}

/**
 * Capabilities for integrating, creating, and managing ZKsync wallets.
 */
export class ZKsyncWallet extends Adapters {
	provider?: Web3ZKsyncL2;
	providerL1?: Web3ZKsyncL1;
	protected eip712!: utils.EIP712Signer;
	public account: Web3Account;
	/**
	 *
	 * @param privateKey The private key of the account.
	 * @param providerL2 The provider instance for connecting to a L2 network.
	 * @param providerL1 The provider instance for connecting to a L1 network.
	 *
	 * @example <caption>Create a wallet directly</caption>
	 *
	 * import { Web3ZKsyncL1, Web3ZKsyncL2, ZKsyncWallet } from "web3-plugin-zksync";
	 *
	 * const PRIVATE_KEY = "<WALLET_PRIVATE_KEY>";
	 * const l2Provider = new Web3ZKsyncL2("https://sepolia.era.zksync.dev");
	 * const l1Provider = new Web3ZKsyncL1("https://rpc.sepolia.org");
	 * const wallet = new ZKsyncWallet(PRIVATE_KEY, l2Provider, l1Provider);
	 *
	 * @example <caption>Use the wallet provided by a registered plugin</caption>
	 *
	 * import { Web3 } from "web3";
	 * import { ZkSyncPlugin } from "web3-plugin-zksync";
	 *
	 * const web3 = new Web3("https://rpc.sepolia.org");
	 * web3.registerPlugin(new ZkSyncPlugin("https://sepolia.era.zksync.dev"));
	 *
	 * const PRIVATE_KEY = "<WALLET_PRIVATE_KEY>";
	 * const zkWallet = new web3.ZKsync.ZkWallet(PRIVATE_KEY);
	 *
	 */
	constructor(privateKey: string, providerL2?: Web3ZKsyncL2, providerL1?: Web3ZKsyncL1) {
		super();

		this.account = privateKeyToAccount(privateKey);
		if (providerL2) {
			this.connect(providerL2);
		}
		if (providerL1) {
			this.connectToL1(providerL1);
		}
	}
	public connect(provider: Web3ZKsyncL2) {
		if (!provider.eth.accounts.wallet.get(this.account.address) && this.account.privateKey) {
			provider.eth.accounts.wallet.add(
				provider.eth.accounts.privateKeyToAccount(this.account.privateKey),
			);
		}
		this.provider = provider;
		// TODO: needs to check when used with ports 15100 and 15200 for the error that would happen for every rpc call (like: get chain id):
		// 	 FetchError {
		//     message: 'request to http://127.0.0.1:15100/ failed, reason: connect ECONNREFUSED 127.0.0.1:15100',
		//     type: 'system',
		//     errno: 'ECONNREFUSED',
		//     code: 'ECONNREFUSED'
		//   }
		this.provider._eip712Signer = this._eip712Signer.bind(this);

		return this;
	}
	public connectToL1(provider: Web3ZKsyncL1) {
		if (!provider.eth.accounts.wallet.get(this.account.address)) {
			provider.eth.accounts.wallet.add(
				provider.eth.accounts.privateKeyToAccount(this.account.privateKey),
			);
		}
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
	getBalance(token?: Address, blockTag: web3Types.BlockNumberOrTag = 'latest') {
		return super.getBalance(token, blockTag);
	}
	getAddress(): any {
		return this.account.address;
	}
	get address() {
		return this.getAddress();
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
	getNonce(blockNumber?: web3Types.BlockNumberOrTag) {
		return this.provider?.eth.getTransactionCount(this.account.address, blockNumber);
	}
	static createRandom(provider?: Web3ZKsyncL2, providerL1?: Web3ZKsyncL1) {
		const acc = createAccount();
		return new ZKsyncWallet(acc.privateKey, provider, providerL1);
	}
	async signTransaction(transaction: web3Types.Transaction): Promise<string> {
		const populated = (await this.populateTransaction(transaction)) as Transaction;
		if (!isAddressEq(populated.from!, this.getAddress())) {
			throw new Error('Transaction from mismatch');
		}
		return this._contextL2().signTransaction(populated);
	}
	sendRawTransaction(signedTx: string) {
		return this._contextL2().sendRawTransaction(signedTx);
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
	 * import { Transaction, utils, Web3 } from "web3";
	 * import { types, ZkSyncPlugin, ZKsyncWallet } from "web3-plugin-zksync";
	 *
	 * async function main() {
	 *   const web3: Web3 = new Web3("https://rpc.sepolia.org");
	 *   web3.registerPlugin(new ZkSyncPlugin("https://sepolia.era.zksync.dev"));
	 *
	 *   const zksync: ZkSyncPlugin = web3.zkSync;
	 *   const PRIVATE_KEY: string = "<WALLET_PRIVATE_KEY>";
	 *   const wallet: ZKsyncWallet = new zksync.ZkWallet(PRIVATE_KEY);
	 *
	 *   const EIP712_TX_TYPE = 0x71;
	 *   const TO_ADDRESS = "<TO_ADDRESS>";
	 *   const populatedTx: types.Eip712TxData | Transaction = await wallet.populateTransaction({
	 *     type: utils.toHex(EIP712_TX_TYPE),
	 *     to: TO_ADDRESS,
	 *     value: utils.toHex(7_000_000_000),
	 *   });
	 * }
	 */
	async populateTransaction(tx: web3Types.Transaction) {
		tx.from = tx.from ?? this.getAddress();
		return this._contextL2().populateTransaction(tx);
	}

	async getBridgehubContractAddress() {
		return this._contextL2().getBridgehubContractAddress();
	}

	async sendTransaction(transaction: web3Types.Transaction) {
		const signed = await this.signTransaction(transaction);
		return getPriorityOpResponse(this._contextL2(), this.sendRawTransaction(signed));
	}
}
