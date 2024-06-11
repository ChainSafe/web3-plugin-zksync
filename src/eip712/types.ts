import type { Bytes, Numbers } from 'web3-types';
import type { Address } from 'web3';
import type { FeeMarketEIP1559TxData } from 'web3-eth-accounts';

export interface TypedDataDomain {
	/**
	 *  The human-readable name of the signing domain.
	 */
	name?: null | string;

	/**
	 *  The major version of the signing domain.
	 */
	version?: null | string;

	/**
	 *  The chain ID of the signing domain.
	 */
	chainId?: null | Numbers;

	/**
	 *  The the address of the contract that will verify the signature.
	 */
	verifyingContract?: null | string;

	/**
	 *  A salt used for purposes decided by the specific domain.
	 */
	salt?: null | Bytes;
}

/**
 *  A specific field of a structured [[link-eip-712]] type.
 */
export interface TypedDataField {
	/**
	 *  The field name.
	 */
	name: string;

	/**
	 *  The type of the field.
	 */
	type: string;
}

export type PaymasterParams = {
	/** The address of the paymaster. */
	paymaster: Address;
	/** The bytestream input for the paymaster. */
	paymasterInput: Bytes;
};

export type Eip712Meta = {
	/** The maximum amount of gas the user is willing to pay for a single byte of pubdata. */
	gasPerPubdata?: Numbers;
	/** An array of bytes containing the bytecode of the contract being deployed and any related contracts it can deploy. */
	factoryDeps?: Bytes[];
	/** Custom signature used for cases where the signer's account is not an EOA. */
	customSignature?: Bytes;
	/** Parameters for configuring the custom paymaster for the transaction. */
	paymasterParams?: PaymasterParams;
};

export type Eip712TxData = FeeMarketEIP1559TxData & {
	/** The custom data for EIP712 transaction metadata. */
	customData?: null | Eip712Meta;
	from?: Address;
	hash?: string;
	signature?: string;
};

export const EIP712_TYPES = {
	Transaction: [
		{ name: 'txType', type: 'uint256' },
		{ name: 'from', type: 'uint256' },
		{ name: 'to', type: 'uint256' },
		{ name: 'gasLimit', type: 'uint256' },
		{ name: 'gasPerPubdataByteLimit', type: 'uint256' },
		{ name: 'maxFeePerGas', type: 'uint256' },
		{ name: 'maxPriorityFeePerGas', type: 'uint256' },
		{ name: 'paymaster', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'value', type: 'uint256' },
		{ name: 'data', type: 'bytes' },
		{ name: 'factoryDeps', type: 'bytes32[]' },
		{ name: 'paymasterInput', type: 'bytes' },
	],
};
