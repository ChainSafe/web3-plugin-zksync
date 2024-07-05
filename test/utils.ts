export const ADDRESS1 = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049';
export const PRIVATE_KEY1 = '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';
export const MNEMONIC1 =
	'stuff slice staff easily soup parent arm payment cotton trade scatter struggle';
export const ADDRESS2 = '0x12b1d9d74d73b1c3a245b19c1c5501c653af1af9';
export const PRIVATE_KEY2 = '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3';
export const DAI_L1 = '0x68194a729C2450ad26072b3D33ADaCbcef39D574';
export const APPROVAL_TOKEN = '0x841c43Fa5d8fFfdB9efE3358906f7578d8700Dd4'; // Crown token
export const PAYMASTER = '0xa222f0c183AFA73a8Bc1AFb48D34C88c9Bf7A174'; // Crown token paymaster

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
