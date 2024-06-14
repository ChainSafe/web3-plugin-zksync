import * as web3Accounts from 'web3-eth-accounts';
import { Web3 } from '../../../web3.js/packages/web3';
import * as constants from '../../src/constants';
import * as utils from '../../src/utils';

describe('utils', () => {
	describe('#isTypedDataSignatureCorrect()', () => {
		it('should return true if correct', async () => {
			const PRIVATE_KEY =
				'0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';
			const ADDRESS = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049';
			const tx = {
				type: 113,
				chainId: 270,
				from: ADDRESS,
				to: '0xa61464658AfeAf65CccaaFD3a512b69A83B77618',
				value: 7_000_000n,
			};
			const eip712Signer = new utils.EIP712Signer(
				web3Accounts.privateKeyToAccount(PRIVATE_KEY),
				270,
			);
			const signature = eip712Signer.sign(tx) as utils.SignatureObject;
			const web3 = new Web3('http://localhost:8545');
			expect(signature.serialized).toBe(
				'0x5ea12f3d54a1624d7e7f5161dbf6ab746c3335e643b2966264e740cf8e10e9b64b0251fb79d9a5b11730387085a0d58f105926f72e20242ecb274639991939ca1b',
			);
			const isValidSignature = await utils.isTypedDataSignatureCorrect(
				web3,
				ADDRESS,
				eip712Signer.getDomain(),
				constants.EIP712_TYPES,
				utils.EIP712.getSignInput(tx),
				signature.serialized,
			);
			expect(isValidSignature).toBe(true);
		});
	});
});
