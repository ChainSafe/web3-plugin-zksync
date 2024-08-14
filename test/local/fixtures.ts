import { Web3ZKsyncL1, Web3ZKsyncL2, ZKsyncWallet } from '../../src';

export const ERC20_CROWN = '0x841c43Fa5d8fFfdB9efE3358906f7578d8700Dd4';
export const APPROVAL_TOKEN = ERC20_CROWN;
export const PAYMASTER = '0xa222f0c183AFA73a8Bc1AFb48D34C88c9Bf7A174';
export const DAI_L1 = '0x70a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55';
export const DAI_L2 = '0x48e52ea9d3e96079304D4de005Ec363e2cbd4BA9';

import accountsData from './rich-wallets.json';
import { abi as TokenAbi } from './files/Token.json';
export const getAccounts = () => accountsData;

export const L1Provider = 'http://127.0.0.1:8545';
export const L2Provider = 'http://127.0.0.1:3050';

export const prepareAccount = async (privateKey: string) => {
	const provider = new Web3ZKsyncL2(L2Provider);
	const l1Provider = new Web3ZKsyncL1(L1Provider);
	const wallet = new ZKsyncWallet(privateKey, provider, l1Provider);
	const wallet0 = new ZKsyncWallet(accountsData[0].privateKey, provider, l1Provider);
	const crownContract = new l1Provider.eth.Contract(TokenAbi, ERC20_CROWN);
	await crownContract.methods
		.mint(wallet.getAddress(), 100000000000000000000n)
		.send({ from: wallet.getAddress() });

	const balance = await wallet.getBalance();
	if (balance < 1000n) {
		const tx = await wallet0.transfer({
			to: wallet.getAddress(),
			amount: 1000000_000000_000000n,
		});
		await tx.waitFinalize();
	}
	if (wallet0.address !== wallet.address) {
		// refill _mainAccount with DAI token
		const tx = await wallet0.transfer({
			to: wallet.address,
			token: DAI_L2,
			amount: 100n,
		});
		await tx.waitFinalize();
	}
};

export const getPreparedWallet = async (privateKey: string) => {
	await prepareAccount(privateKey);
	return new ZKsyncWallet(privateKey, new Web3ZKsyncL2(L2Provider), new Web3ZKsyncL1(L1Provider));
};
