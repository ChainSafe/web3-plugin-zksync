import * as web3Types from 'web3-types';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * The address of the L1 `ETH` token.
 * @constant
 */
export const ETH_ADDRESS: web3Types.Address = '0x0000000000000000000000000000000000000000';

/**
 * The address of the L1 `ETH` token.
 * @constant
 */
export const LEGACY_ETH_ADDRESS: web3Types.Address = '0x0000000000000000000000000000000000000000';

/**
 * In the contracts the zero address can not be used, use one instead
 * @constant
 */
export const ETH_ADDRESS_IN_CONTRACTS: web3Types.Address =
	'0x0000000000000000000000000000000000000001';

/**
 * The formal address for the `Bootloader`.
 * @constant
 */
export const BOOTLOADER_FORMAL_ADDRESS: web3Types.Address =
	'0x0000000000000000000000000000000000008001';

/**
 * The address of the Contract deployer.
 * @constant
 */
export const CONTRACT_DEPLOYER_ADDRESS: web3Types.Address =
	'0x0000000000000000000000000000000000008006';

/**
 * The address of the L1 messenger.
 * @constant
 */
export const L1_MESSENGER_ADDRESS: web3Types.Address = '0x0000000000000000000000000000000000008008';

/**
 * The address of the L2 `ETH` token.
 * @constant
 * @deprecated In favor of {@link L2_BASE_TOKEN_ADDRESS}.
 */
export const L2_ETH_TOKEN_ADDRESS: web3Types.Address = '0x000000000000000000000000000000000000800a';

/**
 * The address of the base token.
 * @constant
 */
export const L2_BASE_TOKEN_ADDRESS = '0x000000000000000000000000000000000000800a';

/**
 * The address of the Nonce holder.
 * @constant
 */
export const NONCE_HOLDER_ADDRESS: web3Types.Address = '0x0000000000000000000000000000000000008003';

/**
 * Used for applying and undoing aliases on addresses during bridging from L1 to L2.
 * @constant
 */
export const L1_TO_L2_ALIAS_OFFSET: web3Types.Address =
	'0x1111000000000000000000000000000000001111';

/**
 * The EIP1271 magic value used for signature validation in smart contracts.
 * This predefined constant serves as a standardized indicator to signal successful
 * signature validation by the contract.
 *
 * @constant
 */
export const EIP1271_MAGIC_VALUE = '0x1626ba7e';

/**
 * Represents an EIP712 transaction type.
 *
 * @constant
 */
export const EIP712_TX_TYPE = 0x71;

/**
 * Represents a priority transaction operation on L2.
 *
 * @constant
 */
export const PRIORITY_OPERATION_L2_TX_TYPE = 0xff;

/**
 * The maximum bytecode length in bytes that can be deployed.
 *
 * @constant
 */
export const MAX_BYTECODE_LEN_BYTES: number = ((1 << 16) - 1) * 32;

/**
 * Numerator used in scaling the gas limit to ensure acceptance of `L1->L2` transactions.
 *
 * This constant is part of a coefficient calculation to adjust the gas limit to account for variations
 * in the SDK estimation, ensuring the transaction will be accepted.
 *
 * @constant
 */
export const L1_FEE_ESTIMATION_COEF_NUMERATOR = 12;

/**
 * Denominator used in scaling the gas limit to ensure acceptance of `L1->L2` transactions.
 *
 * This constant is part of a coefficient calculation to adjust the gas limit to account for variations
 * in the SDK estimation, ensuring the transaction will be accepted.
 *
 * @constant
 */
export const L1_FEE_ESTIMATION_COEF_DENOMINATOR = 10;

/**
 * Gas limit used for displaying the error messages when the
 * users do not have enough fee when depositing ERC20 token from L1 to L2.
 *
 * @constant
 */
export const L1_RECOMMENDED_MIN_ERC20_DEPOSIT_GAS_LIMIT = 400_000;

/**
 * Gas limit used for displaying the error messages when the
 * users do not have enough fee when depositing `ETH` token from L1 to L2.
 *
 * @constant
 */
export const L1_RECOMMENDED_MIN_ETH_DEPOSIT_GAS_LIMIT = 200_000;

/**
 * Default gas per pubdata byte for L2 transactions.
 * This value is utilized when inserting a default value for type 2
 * and EIP712 type transactions.
 *
 * @constant
 */
// It is a realistic value, but it is large enough to fill into any batch regardless of the pubdata price.
export const DEFAULT_GAS_PER_PUBDATA_LIMIT = 50_000;

/**
 * The `L1->L2` transactions are required to have the following gas per pubdata byte.
 *
 * @constant
 */
export const REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT = 800;

/**
 * All typed data conforming to the EIP712 standard within zkSync Era.
 */
export const EIP712_TYPES = {
	EIP712Domain: [
		{ name: 'name', type: 'string' },
		{ name: 'version', type: 'string' },
		{ name: 'chainId', type: 'uint256' },
	],
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