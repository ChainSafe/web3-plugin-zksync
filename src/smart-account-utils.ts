import { toBytes, concat } from './utils';
import { TransactionBuilder, PayloadSigner, TransactionRequest } from './types';
import { privateKeyToAccount, signMessageWithPrivateKey, Web3Account } from 'web3-eth-accounts';
import { Web3ZKsyncL2 } from './web3zksync-l2';
import { DEFAULT_GAS_PER_PUBDATA_LIMIT, EIP712_TX_TYPE } from './constants';
import { Address } from 'web3';
import { format } from 'web3-utils';

/**
 * Signs the `payload` using an ECDSA private key.
 *
 * @param payload The payload that needs to be signed.
 * @param secret The ECDSA private key.
 *
 * @example <caption>Sign EIP712 transaction hash.</caption>
 *
 * import { EIP712Signer, signPayloadWithECDSA, types } from "web3-plugin-zksync";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const tx: types.Eip712TxData = {
 *   chainId: 270,
 *   from: "<ADDRESS>",
 *   to: "<RECEIVER>",
 *   value: 7_000_000_000,
 * };
 *
 * const txHash = EIP712Signer.getSignedDigest(tx);
 * const result = signPayloadWithECDSA(txHash, PRIVATE_KEY);
 *
 * @example <caption>Sign message hash.</caption>
 *
 * import { signPayloadWithECDSA } from "web3-plugin-zksync";
 * import { hashMessage } from "web3-eth-accounts";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const message = 'Hello World!';
 * const messageHash = hashMessage(message);
 *
 * const result = signPayloadWithECDSA(messageHash, PRIVATE_KEY);
 */
export const signPayloadWithECDSA: PayloadSigner = (payload, secret: string | Web3Account) => {
	const account = typeof secret === 'string' ? privateKeyToAccount(secret) : secret;

	return signMessageWithPrivateKey(payload.toString(), account.privateKey).signature;
};

/**
 * Signs the `payload` using multiple ECDSA private keys.
 * The signature is generated by concatenating signatures created by signing with each key individually.
 * The length of the resulting signature should be `secrets.length * 65 + 2`.
 *
 * @param payload The payload that needs to be signed.
 * @param secret The list of the ECDSA private keys.
 *
 * @throws {Error} If the `secret` is not an array of at least two elements.
 *
 * @example <caption>Sign EIP712 transaction hash.</caption>
 *
 * import { EIP712Signer, signPayloadWithMultipleECDSA, types } from "web3-plugin-zksync";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const tx: types.Eip712TxData = {
 *   chainId: 270,
 *   from: "<ADDRESS>",
 *   to: "<RECEIVER>",
 *   value: 7_000_000_000,
 * };
 *
 * const txHash = EIP712Signer.getSignedDigest(tx);
 * const result = signPayloadWithMultipleECDSA(typedDataHash, [PRIVATE_KEY1, PRIVATE_KEY2]);
 *
 * @example <caption>Sign message hash.</caption>
 *
 * import { signPayloadWithMultipleECDSA } from "web3-plugin-zksync";
 * import { hashMessage } from "web3-eth-accounts";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const message = 'Hello World!';
 * const messageHash = hashMessage(message);
 *
 * const result = signPayloadWithMultipleECDSA(typedDataHash, [PRIVATE_KEY1, PRIVATE_KEY2]);
 */
export const signPayloadWithMultipleECDSA: PayloadSigner = (
	payload,
	secret: string[] | Web3Account[],
) => {
	if (!Array.isArray(secret) || secret.length < 2) {
		throw new Error('Multiple keys are required for multisig signing!');
	}

	const signatures = secret.map(key =>
		// Note, that `signMessage` wouldn't work here, since we don't want
		// the signed hash to be prefixed with `\x19Ethereum Signed Message:\n`
		toBytes(signPayloadWithECDSA(payload, key)),
	);

	return concat(signatures);
};

/**
 * Populates missing properties meant for signing using an ECDSA private key:
 *
 * - Populates `from` using the address derived from the ECDSA private key.
 * - Populates `nonce` via `provider.getTransactionCount(tx.from, "pending")`.
 * - Populates `gasLimit` via `provider.estimateGas(tx)`. If `tx.from` is not EOA, the estimation is done with address
 * derived from the ECDSA private key.
 * - Populates `chainId` via `provider.getNetwork()`.
 * - Populates `type` with `utils.EIP712_TX_TYPE`.
 * - Populates `value` by converting to `bigint` if set, otherwise to `0n`.
 * - Populates `data` with `0x`.
 * - Populates `customData` with `{factoryDeps=[], gasPerPubdata=utils.DEFAULT_GAS_PER_PUBDATA_LIMIT}`.
 *
 * @param tx The transaction that needs to be populated.
 * @param [secret] The ECDSA private key used for populating the transaction.
 * @param [provider] The provider is used to fetch data from the network if it is required for signing.
 *
 * @throws {Error} Requires `provider` to be set.
 *
 * @example
 *
 * import { populateTransactionECDSA, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const provider = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
 *
 * const populatedTx = populateTransactionECDSA(
 *   {
 *     chainId: 270,
 *     to: "<RECEIVER>",
 *     value: 7_000_000_000,
 *   },
 *   PRIVATE_KEY,
 *   provider
 * );
 */
export const populateTransactionECDSA: TransactionBuilder = async (
	tx,
	secret: string | Web3Account,
	provider?: Web3ZKsyncL2,
) => {
	if (!provider) {
		throw new Error('Provider is required but is not provided!');
	}

	const account =
		typeof secret === 'object' && secret.privateKey
			? (secret as Web3Account)
			: privateKeyToAccount(secret as string);

	if (!provider.eth.accounts.wallet.get(account.address)) {
		provider.eth.accounts.wallet.add(account);
	}

	tx.chainId = format({ format: 'uint' }, tx.chainId ?? (await provider.eth.getChainId()));
	tx.value = format({ format: 'uint' }, tx.value ? tx.value : 0n);
	tx.data ??= '0x';
	tx.gasPrice = format({ format: 'uint' }, tx.gasPrice ?? (await provider.eth.getGasPrice()));
	tx.nonce = format(
		{ format: 'uint' },
		tx.nonce ?? (await provider.eth.getTransactionCount(tx.from as Address, 'pending')),
	);
	tx.customData = tx.customData ?? {};
	tx.customData.gasPerPubdata ??= DEFAULT_GAS_PER_PUBDATA_LIMIT;
	tx.customData.factoryDeps ??= [];
	tx.from = tx.from ?? account.address;
	tx.type = format({ format: 'uint' }, EIP712_TX_TYPE);

	tx.customData = tx.customData ?? {};
	tx.customData.gasPerPubdata ??= DEFAULT_GAS_PER_PUBDATA_LIMIT;
	tx.customData.factoryDeps ??= [];

	if (tx.from) {
		const code = await provider.eth.getCode(tx.from);
		const isContractAccount = code !== '0x';
		if (isContractAccount) {
			const web3Account = (
				typeof secret === 'string' ? privateKeyToAccount(secret) : secret
			) as Web3Account;
			// Gas estimation does not work when initiator is contract account (works only with EOA).
			// In order to estimation gas, the transaction's from value is replaced with signer's address.
			tx.gasLimit ??= await provider.estimateGas({
				...tx,
				from: web3Account.address,
			});
		}
	}
	tx.gasLimit ??= await provider.estimateGas(tx as TransactionRequest);

	return tx;
};

/**
 * Populates missing properties meant for signing using multiple ECDSA private keys.
 * It uses {@link populateTransactionECDSA}, where the address of the first ECDSA key is set as the `secret` argument.
 *
 * @param tx The transaction that needs to be populated.
 * @param [secret] The list of the ECDSA private keys used for populating the transaction.
 * @param [provider] The provider is used to fetch data from the network if it is required for signing.
 *
 * @throws {Error} The `secret` must be an array of at least two elements.
 *
 * @example
 *
 *
 * import { populateTransactionMultisigECDSA, types, Web3ZKsyncL2 } from "web3-plugin-zksync";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const provider = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
 *
 * const populatedTx = await populateTransactionMultisigECDSA(
 *   {
 *     chainId: 270,
 *     to: "<RECEIVER>",
 *     value: 7_000_000_000,
 *   },
 *   [PRIVATE_KEY1, PRIVATE_KEY2],
 *   provider
 * );
 */
export const populateTransactionMultisigECDSA: TransactionBuilder = async (
	tx,
	secret: string[] | Web3Account[],
	provider,
) => {
	if (!Array.isArray(secret) || secret.length < 2) {
		throw new Error('Multiple keys are required to build the transaction!');
	}
	// estimates gas accepts only one address, so the first signer is chosen.
	return populateTransactionECDSA(tx, secret[0], provider);
};
