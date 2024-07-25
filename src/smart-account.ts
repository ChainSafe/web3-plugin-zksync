import {
	Address,
	BlockTag,
	Eip712TxData,
	Numbers,
	PayloadSigner,
	PaymasterParams,
	PriorityOpResponse,
	SmartAccountSigner,
	TransactionBuilder,
	type TransactionOverrides,
	TypedDataDomain,
	TypedDataField,
	type WalletBalances,
} from './types';

import {
	populateTransactionECDSA,
	populateTransactionMultisigECDSA,
	signPayloadWithECDSA,
	signPayloadWithMultipleECDSA,
} from './smart-account-utils';
import * as Web3EthAccounts from 'web3-eth-accounts';
import { Web3ZkSyncL2 } from './web3zksync-l2';
import type * as web3Types from '../../web3.js/packages/web3-types';
import { AdapterL2 } from './adapters';
import { EIP712, EIP712Signer, getPriorityOpResponse, hashMessage, resolveAddress } from './utils';
import type { BlockNumberOrTag, Transaction } from '../../web3.js/packages/web3-types';
import { pureSign } from 'web3-eth-accounts';
import { TypedDataEncoder } from './TypedDataEncoder';

function checkProvider(signer: SmartAccount, operation: string): Web3ZkSyncL2 {
	if (signer._contextL2()) {
		return signer._contextL2();
	}
	throw new Error(`Missing provider: ${operation}`);
}

/**
 * A `SmartAccount` is a signer which can be configured to sign various payloads using a provided secret.
 * The secret can be in any form, allowing for flexibility when working with different account implementations.
 * The `SmartAccount` is bound to a specific address and provides the ability to define custom method for populating transactions
 * and custom signing method used for signing messages, typed data, and transactions.
 * It is compatible with {@link ethers.ContractFactory} for deploying contracts/accounts, as well as with {@link ethers.Contract}
 * for interacting with contracts/accounts using provided ABI along with custom transaction signing logic.
 */
export class SmartAccount extends AdapterL2 {
	/** Custom method for signing different payloads. */
	protected payloadSigner: PayloadSigner;

	/** Custom method for populating transaction requests. */
	protected transactionBuilder: TransactionBuilder;
	private _account: Web3EthAccounts.Web3Account;
	private _provider?: Web3ZkSyncL2;

	/**
	 * Creates a `SmartAccount` instance with provided `signer` and `provider`.
	 * By default, uses {@link signPayloadWithECDSA} and {@link populateTransactionECDSA}.
	 *
	 * @param signer - Contains necessary properties for signing payloads.
	 * @param provider - The provider to connect to. Can be `null` for offline usage.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 */
	constructor(signer: SmartAccountSigner, provider?: Web3ZkSyncL2) {
		super();
		this._provider = provider;

		this._account = Web3EthAccounts.privateKeyToAccount(signer.secret);
		this.payloadSigner = signer.payloadSigner || signPayloadWithECDSA;
		this.transactionBuilder = signer.transactionBuilder || populateTransactionECDSA;
	}
	_contextL2(): Web3ZkSyncL2 {
		return this._provider!;
	}
	get provider() {
		return this._contextL2();
	}
	get secret() {
		return this._account.privateKey;
	}
	get address() {
		return this._account.address;
	}
	getAddress() {
		return this._account.address;
	}
	getNonce(blockNumber: BlockNumberOrTag = 'latest') {
		return this.provider.eth.getTransactionCount(this.getAddress(), blockNumber);
	}
	/**
	 * Creates a new instance of `SmartAccount` connected to a provider or detached
	 * from any provider if `null` is provided.
	 *
	 * @param provider - The provider to connect the `SmartAccount` to.
	 * If `null`, the `SmartAccount` will be detached from any provider.
	 *
	 * @example
	 *
	 * import { Wallet, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const sepoliaProvider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const sepoliaAccount = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   sepoliaProvider
	 * );
	 *
	 * const mainnetProvider = Provider.getDefaultProvider(types.Network.Mainnet);
	 * const mainnetAccount = sepoliaAccount.connect(mainnetProvider);
	 */
	connect(provider?: Web3ZkSyncL2 | null): SmartAccount {
		return new SmartAccount(
			{
				address: this.getAddress(),
				secret: this.secret,
				payloadSigner: this.payloadSigner,
				transactionBuilder: this.transactionBuilder,
			},
			provider ?? undefined,
		);
	}

	/**
	 * Returns the balance of the account.
	 *
	 * @param [token] - The token address to query balance for. Defaults to the native token.
	 * @param [blockTag='committed'] - The block tag to get the balance at.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const balance = await account.getBalance();
	 */
	async getBalance(token?: Address, blockTag: BlockTag = 'committed'): Promise<bigint> {
		checkProvider(this, 'getBalance');
		return super.getBalance(token, blockTag);
	}

	/**
	 * Returns all token balances of the account.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const balances = await account.getAllBalances();
	 */
	async getAllBalances(): Promise<WalletBalances> {
		checkProvider(this, 'getAllAccountBalances');
		return super.getAllBalances();
	}

	/**
	 * Returns the deployment nonce of the account.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const nonce = await account.getDeploymentNonce();
	 */
	async getDeploymentNonce(): Promise<bigint> {
		checkProvider(this, 'getDeploymentNonce');
		return super.getDeploymentNonce();
	}

	/**
	 * Populates the transaction `tx` using the provided {@link TransactionBuilder} function.
	 * If `tx.from` is not set, it sets the value from the {@link getAddress} method which can
	 * be utilized in the {@link TransactionBuilder} function.
	 *
	 * @param tx The transaction that needs to be populated.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types, utils } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const populatedTx = await account.populateTransaction({
	 *   type: utils.EIP712_TX_TYPE,
	 *   to: "<RECEIVER>",
	 *   value: 7_000_000_000,
	 * });
	 */
	override async populateTransaction(
		tx: Eip712TxData | web3Types.Transaction,
	): Promise<web3Types.Transaction | Eip712TxData> {
		return this.transactionBuilder(tx as Eip712TxData, this.secret, this.provider);
	}

	/**
	 * Signs the transaction `tx` using the provided {@link PayloadSigner} function,
	 * returning the fully signed transaction. The {@link populateTransaction} method
	 * is called first to ensure that all necessary properties for the transaction to be valid
	 * have been populated.
	 *
	 * @param tx The transaction that needs to be signed.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const signedTx = await account.signTransaction({
	 *   to: "<RECEIVER>",
	 *   value: ethers.parseEther('1'),
	 * });
	 */
	async signTransaction(tx: Transaction | Eip712TxData): Promise<string> {
		const populatedTx = (await this.populateTransaction(tx)) as Eip712TxData;
		const populatedTxHash = EIP712Signer.getSignedDigest(populatedTx);

		populatedTx.customData = {
			...populatedTx.customData,
			customSignature: this.payloadSigner(populatedTxHash, this.secret, this.provider),
		};
		return EIP712.serialize(populatedTx);

		// return super.signTransaction(populatedTx as Transaction);
	}

	/**
	 * Sends `tx` to the Network. The {@link signTransaction}
	 * is called first to ensure transaction is properly signed.
	 *
	 * @param tx The transaction that needs to be sent.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const signedTx = await account.sendTransaction({
	 *   to: "<RECEIVER>",
	 *   value: ethers.parseEther('1'),
	 * });
	 */
	async sendTransaction(tx: Transaction) {
		checkProvider(this, 'broadcastTransaction');
		const signedTx = await this.signTransaction(tx);
		return getPriorityOpResponse(
			this.provider,
			super.sendRawTransaction(signedTx),
			this._contextL2(),
		);
	}

	/**
	 * Signs a `message` using the provided {@link PayloadSigner} function.
	 *
	 * @param message The message that needs to be signed.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const signedMessage = await account.signMessage('Hello World!');
	 */
	signMessage(message: string | Uint8Array): string {
		const signature = pureSign(hashMessage(message), this.secret);
		return signature.signature;
	}

	/**
	 * Signs a typed data using the provided {@link PayloadSigner} function.
	 *
	 * @param domain The domain data.
	 * @param types A map of records pointing from field name to field type.
	 * @param value A single record value.
	 *
	 * @example
	 *
	 * import { SmartAccount, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const signedTypedData = await account.signTypedData(
	 *   {name: 'Example', version: '1', chainId: 270},
	 *   {
	 *     Person: [
	 *       {name: 'name', type: 'string'},
	 *       {name: 'age', type: 'uint8'},
	 *     ],
	 *   },
	 *   {name: 'John', age: 30}
	 * );
	 */
	async signTypedData(
		domain: TypedDataDomain,
		types: Record<string, TypedDataField[]>,
		value: Record<string, any>,
	): Promise<string> {
		const populated = await TypedDataEncoder.resolveNames(
			domain,
			types,
			value,
			async (name: string) => {
				return resolveAddress(name, {
					resolveName: (name: string) => this.provider.eth.ens.getName(name),
				});
			},
		);

		return this.payloadSigner(
			TypedDataEncoder.hash(populated.domain, types, populated.value),
			this.secret,
			this.provider,
		);
	}

	/**
	 * Initiates the withdrawal process which withdraws ETH or any ERC20 token
	 * from the associated account on L2 network to the target account on L1 network.
	 *
	 * @param transaction - Withdrawal transaction request.
	 * @param transaction.token - The address of the token. ETH by default.
	 * @param transaction.amount - The amount of the token to withdraw.
	 * @param [transaction.to] - The address of the recipient on L1.
	 * @param [transaction.bridgeAddress] - The address of the bridge contract to be used.
	 * @param [transaction.paymasterParams] - Paymaster parameters.
	 * @param [transaction.overrides] - Transaction's overrides which may be used to pass l2 gasLimit, gasPrice, value, etc.
	 *
	 * @returns A Promise resolving to a withdrawal transaction response.
	 *
	 * @example Withdraw ETH.
	 *
	 * import { SmartAccount, Provider, types, utils } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const withdrawTx = await account.withdraw({
	 *   token: utils.ETH_ADDRESS,
	 *   amount: 10_000_000n,
	 * });
	 *
	 * @example Withdraw ETH using paymaster to facilitate fee payment with an ERC20 token.
	 *
	 * import { SmartAccount, Provider, types, utils } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const token = "0x927488F48ffbc32112F1fF721759649A89721F8F"; // Crown token which can be minted for free
	 * const paymaster = "0x13D0D8550769f59aa241a41897D4859c87f7Dd46"; // Paymaster for Crown token
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const withdrawTx = await account.withdraw({
	 *   token: utils.ETH_ADDRESS,
	 *   amount: 10_000_000n,
	 *   paymasterParams: utils.getPaymasterParams(paymaster, {
	 *     type: "ApprovalBased",
	 *     token: token,
	 *     minimalAllowance: 1,
	 *     innerInput: new Uint8Array(),
	 *   }),
	 * });
	 */
	async withdraw(transaction: {
		token: Address;
		amount: Numbers;
		to?: Address;
		bridgeAddress?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		checkProvider(this, 'withdraw');
		return super.withdraw(transaction);
	}

	/**
	 * Transfer ETH or any ERC20 token within the same interface.
	 *
	 * @param transaction - Transfer transaction request.
	 * @param transaction.to - The address of the recipient.
	 * @param transaction.amount - The address of the recipient.
	 * @param [transaction.token] - The address of the recipient.
	 * @param [transaction.paymasterParams] - The address of the recipient.
	 * @param [transaction.overrides] - The address of the recipient.
	 *
	 * @returns A Promise resolving to a transfer transaction response.
	 *
	 * @example Transfer ETH.
	 *
	 * import { SmartAccount, Wallet, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const transferTx = await account.transfer({
	 *   token: utils.ETH_ADDRESS,
	 *   to: Wallet.createRandom().address,
	 *   amount: ethers.parseEther("0.01"),
	 * });
	 *
	 * const receipt = await transferTx.wait();
	 *
	 * console.log(`The sum of ${receipt.value} ETH was transferred to ${receipt.to}`);
	 *
	 * @example Transfer ETH using paymaster to facilitate fee payment with an ERC20 token.
	 *
	 * import { SmartAccount, Wallet, Provider, utils } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const token = "0x927488F48ffbc32112F1fF721759649A89721F8F"; // Crown token which can be minted for free
	 * const paymaster = "0x13D0D8550769f59aa241a41897D4859c87f7Dd46"; // Paymaster for Crown token
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   provider
	 * );
	 *
	 * const transferTx = await account.transfer({
	 *   to: Wallet.createRandom().address,
	 *   amount: ethers.parseEther("0.01"),
	 *   paymasterParams: utils.getPaymasterParams(paymaster, {
	 *     type: "ApprovalBased",
	 *     token: token,
	 *     minimalAllowance: 1,
	 *     innerInput: new Uint8Array(),
	 *   }),
	 * });
	 *
	 * const receipt = await transferTx.wait();
	 *
	 * console.log(`The sum of ${receipt.value} ETH was transferred to ${receipt.to}`);
	 */
	async transfer(transaction: {
		to: Address;
		amount: Numbers;
		token?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}): Promise<PriorityOpResponse> {
		const transferTx = await super.transferTx(transaction);
		return this.sendTransaction(transferTx as Transaction);
	}
}

/**
 * A `ECDSASmartAccount` is a factory which creates a `SmartAccount` instance
 * that uses single ECDSA key for signing payload.
 */
export class ECDSASmartAccount {
	/**
	 * Creates a `SmartAccount` instance that uses a single ECDSA key for signing payload.
	 *
	 * @param address The account address.
	 * @param secret The ECDSA private key.
	 * @param provider The provider to connect to.
	 *
	 * @example
	 *
	 * import { ECDSASmartAccount, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const account = ECDSASmartAccount.create(ADDRESS, PRIVATE_KEY, provider);
	 */
	static create(address: string, secret: string, provider: Web3ZkSyncL2): SmartAccount {
		return new SmartAccount({ address, secret }, provider);
	}
}

/**
 * A `MultisigECDSASmartAccount` is a factory which creates a `SmartAccount` instance
 * that uses multiple ECDSA keys for signing payloads.
 * The signature is generated by concatenating signatures created by signing with each key individually.
 */
export class MultisigECDSASmartAccount {
	/**
	 * Creates a `SmartAccount` instance that uses multiple ECDSA keys for signing payloads.
	 *
	 * @param address The account address.
	 * @param secret The list of the ECDSA private keys.
	 * @param provider The provider to connect to.
	 *
	 * @example
	 *
	 * import { MultisigECDSASmartAccount, Provider, types } from "zksync-ethers";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
	 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 *
	 * const account = MultisigECDSASmartAccount.create(
	 *   multisigAddress,
	 *   [PRIVATE_KEY1, PRIVATE_KEY2],
	 *   provider
	 * );
	 */
	static create(address: string, secret: string[], provider: Web3ZkSyncL2): SmartAccount {
		return new SmartAccount(
			{
				address,
				secret,
				payloadSigner: signPayloadWithMultipleECDSA,
				transactionBuilder: populateTransactionMultisigECDSA,
			},
			provider,
		);
	}
}
