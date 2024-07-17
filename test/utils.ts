export const ADDRESS1 = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049';
export const ADDRESS3 = '0xa61464658AfeAf65CccaaFD3a512b69A83B77618';

export const PRIVATE_KEY1 = '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';
export const MNEMONIC1 =
	'stuff slice staff easily soup parent arm payment cotton trade scatter struggle';
export const ADDRESS2 = '0x12b1d9d74d73b1c3a245b19c1c5501c653af1af9';
export const PRIVATE_KEY2 = '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3';
export const DAI_L1 = '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6';
export const USDC_L1 = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const APPROVAL_TOKEN = '0x927488F48ffbc32112F1fF721759649A89721F8F'; // Crown token
export const PAYMASTER = '0x6f72f0d7bDba2E2a923beC09fBEE64cD134680F2'; // Crown token paymaster

export const IS_ETH_BASED = true;

export function deepEqualExcluding(
	obj1: Record<string, any>,
	expected: Record<string, any>,
	excludeFields: string[],
) {
	for (const key in obj1) {
		if (!excludeFields.includes(key)) {
			expect(obj1[key]).toEqual(expected[key]);
		}
	}
}
