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
import { Web3ZKsyncL2 } from './web3zksync-l2';
import type * as web3Types from 'web3-types';
import { AdapterL2 } from './adapters';
import { EIP712, EIP712Signer, getPriorityOpResponse, hashMessage, resolveAddress } from './utils';
import { signMessageWithPrivateKey } from 'web3-eth-accounts';
import { TypedDataEncoder } from './TypedDataEncoder';

function checkProvider(signer: SmartAccount, operation: string): Web3ZKsyncL2 {
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
 */
export class SmartAccount extends AdapterL2 {
	/** Custom method for signing different payloads. */
	protected payloadSigner: PayloadSigner;

	/** Custom method for populating transaction requests. */
	protected transactionBuilder: TransactionBuilder;
	private _account: Web3EthAccounts.Web3Account | Web3EthAccounts.Web3Account[];
	private _address: Address;
	private _provider?: Web3ZKsyncL2;

	/**
	 * Creates a `SmartAccount` instance with provided `signer` and `provider`.
	 * By default, uses {@link signPayloadWithECDSA} and {@link populateTransactionECDSA}.
	 *
	 * @param signer - Contains necessary properties for signing payloads.
	 * @param provider - The provider to connect to. Can be `null` for offline usage.
	 *
	 * @example
	 *
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 */
	constructor(signer: SmartAccountSigner, provider?: Web3ZKsyncL2) {
		super();
		this._provider = provider;

		this._account = Array.isArray(signer.secret)
			? signer.secret.map(secret => Web3EthAccounts.privateKeyToAccount(secret))
			: Web3EthAccounts.privateKeyToAccount(signer.secret);
		this._address = signer.address;
		this.payloadSigner = signer.payloadSigner || signPayloadWithECDSA;
		this.transactionBuilder = signer.transactionBuilder || populateTransactionECDSA;
	}
	_contextL2(): Web3ZKsyncL2 {
		return this._provider!;
	}
	get provider() {
		return this._contextL2();
	}
	get secret() {
		return Array.isArray(this._account)
			? this._account.map(a => a.privateKey)
			: this._account.privateKey;
	}
	get address() {
		return this._address;
	}
	getAddress() {
		return this.address;
	}
	getNonce(blockNumber: web3Types.BlockNumberOrTag = 'latest') {
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const sepoliaProvider = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const sepoliaAccount = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   sepoliaProvider
	 * );
	 *
	 * const mainnetProvider = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Mainnet);
	 * const mainnetAccount = sepoliaAccount.connect(mainnetProvider);
	 */
	connect(provider?: Web3ZKsyncL2 | null): SmartAccount {
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
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
	 * import { constants, SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const populatedTx = await account.populateTransaction({
	 *   type: constants.EIP712_TX_TYPE,
	 *   to: "<RECEIVER>",
	 *   value: 7_000_000_000,
	 * });
	 */
	override async populateTransaction(
		tx: Eip712TxData | web3Types.Transaction,
	): Promise<web3Types.Transaction | Eip712TxData> {
		return this.transactionBuilder(
			{
				...(tx as Eip712TxData),
				from: tx.from ?? this.getAddress(),
			},
			this.secret,
			this.provider,
		);
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const signedTx = await account.signTransaction({
	 *   to: "<RECEIVER>",
	 *   value: 7_000_000_000,
	 * });
	 */
	async signTransaction(tx: web3Types.Transaction | Eip712TxData): Promise<string> {
		const populatedTx = (await this.populateTransaction(tx)) as Eip712TxData;
		const populatedTxHash = EIP712Signer.getSignedDigest(populatedTx);

		populatedTx.customData = {
			...populatedTx.customData,
			customSignature: this.payloadSigner(populatedTxHash, this.secret, this.provider),
		};
		return EIP712.serialize(populatedTx);
	}

	/**
	 * Sends `tx` to the Network. The {@link signTransaction}
	 * is called first to ensure transaction is properly signed.
	 *
	 * @param tx The transaction that needs to be sent.
	 *
	 * @example
	 *
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const signedTx = await account.sendTransaction({
	 *   to: "<RECEIVER>",
	 *   value: 7_000_000_000,
	 * });
	 */
	async sendTransaction(tx: web3Types.Transaction) {
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const signedMessage = await account.signMessage('Hello World!');
	 */
	signMessage(message: string | Uint8Array): string {
		const signature = signMessageWithPrivateKey(
			hashMessage(message),
			Array.isArray(this.secret) ? this.secret[0] : this.secret,
		);
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
	 * import { SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
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
	 * @example <caption>Withdraw ETH.</caption>
	 *
	 * import { constants, SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const withdrawTx = await account.withdraw({
	 *   token: constants.ETH_ADDRESS,
	 *   amount: 10_000_000n,
	 * });
	 *
	 * @example <caption>Withdraw ETH using paymaster to facilitate fee payment with an ERC20 token.</caption>
	 *
	 * import { constants, paymasterUtils, SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const token = "0x927488F48ffbc32112F1fF721759649A89721F8F"; // Crown token which can be minted for free
	 * const paymaster = "0x13D0D8550769f59aa241a41897D4859c87f7Dd46"; // Paymaster for Crown token
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const withdrawTx = await account.withdraw({
	 *   token: constants.ETH_ADDRESS,
	 *   amount: 10_000_000n,
	 *   paymasterParams: paymasterUtils.getPaymasterParams(paymaster, {
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
	 * @example <caption>Transfer ETH.</caption>
	 *
	 * import { constants, SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const transferTx = await account.transfer({
	 *   token: constants.ETH_ADDRESS,
	 *   to: "<RECEIVER>",
	 *   amount: 10_000_000n,
	 * });
	 *
	 * const receipt = await transferTx.wait();
	 *
	 * console.log(`The sum of ${receipt.value} ETH was transferred to ${receipt.to}`);
	 *
	 * @example <caption>Transfer ETH using paymaster to facilitate fee payment with an ERC20 token.</caption>
	 *
	 * import { constants, paymasterUtils, SmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const token = "0x927488F48ffbc32112F1fF721759649A89721F8F"; // Crown token which can be minted for free
	 * const paymaster = "0x13D0D8550769f59aa241a41897D4859c87f7Dd46"; // Paymaster for Crown token
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = new SmartAccount(
	 *   {address: ADDRESS, secret: PRIVATE_KEY},
	 *   l2
	 * );
	 *
	 * const transferTx = await account.transfer({
	 *   to: Wallet.createRandom().address,
	 *   amount: 10_000_000n,
	 *   paymasterParams: paymasterUtils.getPaymasterParams(paymaster, {
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
		return this.sendTransaction(transferTx as web3Types.Transaction);
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
	 * import { ECDSASmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY = "<PRIVATE_KEY>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 * const account = ECDSASmartAccount.create(ADDRESS, PRIVATE_KEY, l2);
	 */
	static create(address: string, secret: string, provider: Web3ZKsyncL2): SmartAccount {
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
	 * import { MultisigECDSASmartAccount, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
	 *
	 * const ADDRESS = "<ADDRESS>";
	 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
	 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
	 *
	 * const l2 = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
	 *
	 * const account = MultisigECDSASmartAccount.create(
	 *   multisigAddress,
	 *   [PRIVATE_KEY1, PRIVATE_KEY2],
	 *   l2
	 * );
	 */
	static create(address: string, secret: string[], provider: Web3ZKsyncL2): SmartAccount {
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
