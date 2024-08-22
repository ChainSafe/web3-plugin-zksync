export const ADDRESS1 = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049';
export const ADDRESS2 = '0x7ed0e85b8e1e925600b4373e6d108f34ab38a401';
export const ADDRESS3 = '0xe4beef667408b99053dc147ed19592ada0d77f59';

export const PRIVATE_KEY1 = '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';
export const MNEMONIC1 =
	'stuff slice staff easily soup parent arm payment cotton trade scatter struggle';
export const PRIVATE_KEY2 = '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3';
export const DAI_L1 = '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6';
export const USDC_L1 = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const ERC20_CROWN = '0x927488F48ffbc32112F1fF721759649A89721F8F';
export const APPROVAL_TOKEN = ERC20_CROWN; // Crown token
export const PAYMASTER = '0x13D0D8550769f59aa241a41897D4859c87f7Dd46'; // Crown token paymaster

export const IS_ETH_BASED = true;

const stringify = (value: any) =>
	JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v) as unknown);
const convert = (value: any) => {
	if (typeof value === 'bigint') {
		return value.toString();
	}
	return typeof value === 'object' ? JSON.parse(stringify(value)) : value;
};

export const L2_CHAIN_URL = IS_ETH_BASED
	? 'http://127.0.0.1:3050' // probably need to use the port 15100 after some investigation (change and run the tests to see the error)
	: 'http://127.0.0.1:15200';
export const L1_CHAIN_URL = 'http://127.0.0.1:15045';

export function deepEqualExcluding(
	obj1: Record<string, any>,
	expected: Record<string, any>,
	excludeFields: string[],
) {
	for (const key in obj1) {
		if (!excludeFields.includes(key)) {
			expect(convert(obj1[key])).toEqual(convert(expected[key]));
		}
	}
}
