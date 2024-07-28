import { toBytes, concat } from './utils';
import { TransactionBuilder, PayloadSigner, Eip712TxData } from './types';
import { privateKeyToAccount, pureSign, Web3Account } from 'web3-eth-accounts';
import { EIP712_TX_TYPE } from './constants';
import { Web3ZkSyncL2 } from './web3zksync-l2';
import type * as web3Types from 'web3-types';
import * as utils from './utils';

/**
 * Signs the `payload` using an ECDSA private key.
 *
 * @param payload The payload that needs to be signed.
 * @param secret The ECDSA private key.
 *
 * @example Sign EIP712 transaction hash.
 *
 * import { EIP712Signer, types, utils } from "zksync-ethers";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const tx: types.TransactionRequest = {
 *   chainId: 270,
 *   from: ADDRESS,
 *   to: "<RECEIVER>",
 *   value: 7_000_000_000,
 * };
 *
 * const txHash = EIP712Signer.getSignedDigest(tx);
 * const result = await utils.signPayloadWithECDSA(txHash, PRIVATE_KEY);
 *
 * @example Sign message hash.
 *
 * import { utils } from "zksync-ethers";
 * import { hashMessage } from "ethers";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const message = 'Hello World!';
 * const messageHash = hashMessage(message);
 *
 * const result = await utils.signPayloadWithECDSA(messageHash, PRIVATE_KEY);
 *
 * @example Sign typed data hash.
 *
 * import { utils } from "zksync-ethers";
 * import { TypedDataEncoder } from "ethers";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const typedDataHash = TypedDataEncoder.hash(
 *   {name: 'Example', version: '1', chainId: 270},
 *   {
 *     Person: [
 *       {name: 'name', type: 'string'},
 *       {name: 'age', type: 'uint8'},
 *     ],
 *   },
 *   {name: 'John', age: 30}
 * );
 * const result = await utils.signPayloadWithECDSA(typedDataHash, PRIVATE_KEY);
 */
export const signPayloadWithECDSA: PayloadSigner = (payload, secret: string | Web3Account) => {
	const account = typeof secret === 'string' ? privateKeyToAccount(secret) : secret;

	return pureSign(payload.toString(), account.privateKey).signature;
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
 * @example Sign EIP712 transaction hash.
 *
 * import { EIP712Signer, types, utils } from "zksync-ethers";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const tx: types.TransactionRequest = {
 *   chainId: 270,
 *   from: ADDRESS,
 *   to: "<RECEIVER>",
 *   value: 7_000_000_000,
 * };
 *
 * const txHash = EIP712Signer.getSignedDigest(tx);
 * const result = await utils.signPayloadWithMultipleECDSA(typedDataHash, [PRIVATE_KEY1, PRIVATE_KEY2]);
 *
 * @example Sign message hash.
 *
 * import { utils } from "zksync-ethers";
 * import { hashMessage } from "ethers";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const message = 'Hello World!';
 * const messageHash = hashMessage(message);
 *
 * const result = await utils.signPayloadWithMultipleECDSA(typedDataHash, [PRIVATE_KEY1, PRIVATE_KEY2]);
 *
 * @example Sign typed data hash.
 *
 * import { utils } from "zksync-ethers";
 * import { TypedDataEncoder } from "ethers";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const typedDataHash = TypedDataEncoder.hash(
 *   {name: 'Example', version: '1', chainId: 270},
 *   {
 *     Person: [
 *       {name: 'name', type: 'string'},
 *       {name: 'age', type: 'uint8'},
 *     ],
 *   },
 *   {name: 'John', age: 30}
 * );
 * const result = await utils.signPayloadWithMultipleECDSA(typedDataHash, [PRIVATE_KEY1, PRIVATE_KEY2]);
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
 * import { Provider, types, utils } from "zksync-ethers";
 *
 * const PRIVATE_KEY = "<PRIVATE_KEY>";
 *
 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
 *
 * const populatedTx = await utils.populateTransactionECDSA(
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
	provider?: Web3ZkSyncL2,
) => {
	if (!provider) {
		throw new Error('Provider is required but is not provided!');
	}

	const account =
		typeof secret === 'object' && secret.privateKey
			? (secret as Web3Account)
			: privateKeyToAccount(secret as string);
	provider._eip712Signer = async () => {
		if (!provider.eip712) {
			provider.eip712 = new utils.EIP712Signer(
				account,
				Number(await provider.eth.getChainId()),
			);
		}
		return provider.eip712;
	};
	tx.from = account.address;
	tx.type = EIP712_TX_TYPE;
	return provider.populateTransaction(tx as web3Types.Transaction) as Promise<Eip712TxData>;
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
 * import { Provider, types, utils } from "zksync-ethers";
 *
 * const PRIVATE_KEY1 = "<PRIVATE_KEY1>";
 * const PRIVATE_KEY2 = "<PRIVATE_KEY2>";
 *
 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
 *
 * const populatedTx = await utils.populateTransactionMultisigECDSA(
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
