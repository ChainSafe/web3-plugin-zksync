import * as web3Utils from 'web3-utils';
import { Web3Eth } from 'web3-eth';
import { Web3ZkSyncL2, constants, types, ZKSyncWallet } from '../../src';

const provider = Web3ZkSyncL2.initWithDefaultProvider(types.Network.Sepolia);
const web3Context = new Web3Eth('https://sepolia.infura.io/v3/84842078b09946638c03157f83405213');
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const wallet = new ZKSyncWallet(PRIVATE_KEY, provider, web3Context);

describe('utils', () => {
	describe('#isTypedDataSignatureCorrect()', () => {
		it('should return true if correct', async () => {
			console.log(`L2 balance before deposit: ${await wallet.getBalance()}`);
			console.log(`L1 balance before deposit: ${await wallet.getBalanceL1()}`);

			const tx = await wallet.deposit({
				token: constants.ETH_ADDRESS,
				to: await wallet.getAddress(),
				amount: web3Utils.toWei('0.00020', 'ether'),
				refundRecipient: await wallet.getAddress(),
			});
			const receipt = await tx.wait();
			console.log(`Tx: ${receipt.hash}`);

			console.log(`L2 balance after deposit: ${await wallet.getBalance()}`);
			console.log(`L1 balance after deposit: ${await wallet.getBalanceL1()}`);
			expect().toBe();
		});
	});
});
