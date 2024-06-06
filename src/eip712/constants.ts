/**
 * Default gas per pubdata byte for L2 transactions.
 * This value is utilized when inserting a default value for type 2
 * and EIP712 type transactions.
 *
 * @constant
 */
// It is a realistic value, but it is large enough to fill into any batch regardless of the pubdata price.
export const DEFAULT_GAS_PER_PUBDATA_LIMIT = 50_000;
export const MAX_INTEGER = BigInt(
	'0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
);
