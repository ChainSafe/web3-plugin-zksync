import { Web3ZKsyncL2, ZKsyncWallet, Web3ZKsyncL1, getPaymasterParams } from '../../src';
import { IS_ETH_BASED, ADDRESS2, L1_CHAIN_URL, L2_CHAIN_URL } from '../utils';
import { ETH_ADDRESS_IN_CONTRACTS, LEGACY_ETH_ADDRESS } from '../../src/constants';
import {
	getAccounts,
	PAYMASTER,
	DAI_L1,
	APPROVAL_TOKEN,
	prepareAccount,
	getPreparedWallet,
} from './fixtures';

jest.setTimeout(60000);

const accounts = getAccounts();
const mainAccount = accounts[0];
const PRIVATE_KEY = mainAccount.privateKey;
const provider = new Web3ZKsyncL2(L2_CHAIN_URL);
const ethProvider = new Web3ZKsyncL1(L1_CHAIN_URL);
const wallet = new ZKsyncWallet(PRIVATE_KEY, provider, ethProvider);

describe('Wallet', () => {
	beforeAll(async () => {
		await prepareAccount(accounts[0].privateKey);
	});

	describe('#transfer()', () => {
		it('should transfer ETH or base token depending on chain type', async () => {
			const amount = 4n;
			const balanceBeforeTransfer = await provider.getBalance(ADDRESS2);
			const result = await wallet.transfer({
				token: await wallet.getBaseToken(),
				to: ADDRESS2,
				amount: amount,
			});
			await result.wait();
			const balanceAfterTransfer = await provider.getBalance(ADDRESS2);
			expect(result).not.toBeNull();
			expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
		});

		if (!IS_ETH_BASED) {
			it('should transfer ETH on non eth based chain', async () => {
				const amount = 7_000_000_000n;
				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const balanceBeforeTransfer = await provider.getTokenBalance(token, ADDRESS2);
				const result = await wallet.transfer({
					token: LEGACY_ETH_ADDRESS,
					to: ADDRESS2,
					amount: amount,
				});
				const balanceAfterTransfer = await provider.getTokenBalance(token, ADDRESS2);
				expect(result).not.toBeNull();
				expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
			});

			it('should transfer ETH using paymaster to cover fee', async () => {
				const amount = 7_000_000_000n;
				const minimalAllowance = 1n;

				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceBeforeTransfer = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const senderBalanceBeforeTransfer = await wallet.getBalance(token);
				const senderApprovalTokenBalanceBeforeTransfer =
					await wallet.getBalance(APPROVAL_TOKEN);
				const receiverBalanceBeforeTransfer = await provider.getTokenBalance(
					token,
					ADDRESS2,
				);

				const result = await wallet.transfer({
					token: token,
					to: ADDRESS2,
					amount: amount,
					paymasterParams: getPaymasterParams(PAYMASTER, {
						type: 'ApprovalBased',
						token: APPROVAL_TOKEN,
						minimalAllowance: minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				});

				const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceAfterTransfer = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const senderBalanceAfterTransfer = await wallet.getBalance(token);
				const senderApprovalTokenBalanceAfterTransfer =
					await wallet.getBalance(APPROVAL_TOKEN);
				const receiverBalanceAfterTransfer = await provider.getTokenBalance(
					token,
					ADDRESS2,
				);

				expect(
					paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
				).toEqual(true);
				expect(
					paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer,
				).toEqual(minimalAllowance);

				expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toEqual(amount);
				expect(
					senderApprovalTokenBalanceAfterTransfer ===
						senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
				).toEqual(true);

				expect(result).not.toBeNull();
				expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toEqual(
					amount,
				);
			});
		}

		it('should transfer DAI', async () => {
			const amount = 4n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);
			const balanceBeforeTransfer = await provider.getTokenBalance(l2DAI, ADDRESS2);
			const result = await wallet.transfer({
				token: l2DAI,
				to: ADDRESS2,
				amount: amount,
			});
			const receipt = await result.wait();
			expect(receipt.transactionHash).toBeDefined();
			const balanceAfterTransfer = await provider.getTokenBalance(l2DAI, ADDRESS2);
			expect(result).not.toBeNull();
			expect(balanceAfterTransfer - balanceBeforeTransfer).toEqual(amount);
		});

		it('should transfer DAI using paymaster to cover fee', async () => {
			const wallet = await getPreparedWallet(accounts[0].privateKey);
			const toAddress = accounts[5].address;
			const amount = 4n;
			const minimalAllowance = 1n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);

			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceBeforeTransfer = await wallet.getBalance(l2DAI);
			const senderApprovalTokenBalanceBeforeTransfer =
				await wallet.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getBalance(
				toAddress,
				'latest',
				l2DAI,
			);
			const tx = await wallet.transfer({
				token: l2DAI,
				to: toAddress,
				amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const result = await tx.wait();

			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceAfterTransfer = await wallet.getBalance(l2DAI);
			const senderApprovalTokenBalanceAfterTransfer = await wallet.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getBalance(
				toAddress,
				'latest',
				l2DAI,
			);

			expect(
				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
			).toBeTruthy();
			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
				minimalAllowance,
			);

			expect(
				senderApprovalTokenBalanceAfterTransfer ===
					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			).toBeTruthy();

			expect(result).not.toBeNull();
			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toEqual(amount);
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
		});

		if (!IS_ETH_BASED) {
			it('should transfer base token', async () => {
				const amount = 7_000_000_000n;
				const balanceBeforeTransfer = await provider.getBalance(ADDRESS2);
				const tx = await wallet.transfer({
					token: await wallet.getBaseToken(),
					to: ADDRESS2,
					amount: amount,
				});
				const result = await tx.wait();
				const balanceAfterTransfer = await provider.getBalance(ADDRESS2);
				expect(result).not.toBeNull();
				expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
			});
		}
	});
});
