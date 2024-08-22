import { Web3ZKsyncL2, ZKsyncWallet, Web3ZKsyncL1, getPaymasterParams } from '../../src';
import { IS_ETH_BASED } from '../utils';
import { ETH_ADDRESS_IN_CONTRACTS, LEGACY_ETH_ADDRESS } from '../../src/constants';
import {
	getAccounts,
	L1Provider,
	L2Provider,
	ERC20_CROWN,
	PAYMASTER,
	DAI_L1,
	APPROVAL_TOKEN,
	prepareAccount,
} from './fixtures';
import { toWei } from 'web3-utils';
jest.setTimeout(600000);

const accounts = getAccounts();
const mainAccount = accounts[0];
const PRIVATE_KEY = mainAccount.privateKey;
const provider = new Web3ZKsyncL2(L2Provider);
const ethProvider = new Web3ZKsyncL1(L1Provider);
const wallet = new ZKsyncWallet(PRIVATE_KEY, provider, ethProvider);

describe('Wallet', () => {
	beforeAll(async () => {
		await prepareAccount(accounts[0].privateKey);
	});

	describe('#withdraw()', () => {
		if (IS_ETH_BASED) {
			it('should withdraw ETH to the L1 network', async () => {
				const amount = toWei('0.0001', 'ether');
				const l2BalanceBeforeWithdrawal = await wallet.getBalance();
				const withdrawTx = await wallet.withdraw({
					token: LEGACY_ETH_ADDRESS,
					to: wallet.getAddress(),
					amount: amount,
				});
				const receipt = await withdrawTx.waitFinalize();
				expect(receipt.transactionHash).toBeDefined();
				const txHash = receipt.transactionHash;
				expect(await wallet.isWithdrawalFinalized(txHash)).toEqual(false);

				const result = await wallet.finalizeWithdrawal(txHash);
				const l2BalanceAfterWithdrawal = await wallet.getBalance();
				expect(result).not.toBeNull();
				expect(
					l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= BigInt(amount),
				).toEqual(true);
			});

			it('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
				const amount = 400n;
				const minimalAllowance = 1n;

				const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceBeforeWithdrawal = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const l2BalanceBeforeWithdrawal = await wallet.getBalance();
				const l2ApprovalTokenBalanceBeforeWithdrawal = await wallet.getBalance(ERC20_CROWN);

				const tx = await wallet.withdraw({
					token: ETH_ADDRESS_IN_CONTRACTS,
					to: wallet.getAddress(),
					amount: amount,
					paymasterParams: getPaymasterParams(PAYMASTER, {
						type: 'ApprovalBased',
						token: APPROVAL_TOKEN,
						minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				});
				const receipt = await tx.wait();

				expect(receipt).toBeDefined();
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);

				const paymasterBalanceAfterWithdrawal = await provider.eth.getBalance(PAYMASTER);
				const paymasterTokenBalanceAfterWithdrawal = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const l2BalanceAfterWithdrawal = await wallet.getBalance();
				const l2ApprovalTokenBalanceAfterWithdrawal =
					await wallet.getBalance(APPROVAL_TOKEN);

				expect(
					paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
				).toEqual(true);
				expect(
					paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
				).toEqual(minimalAllowance);

				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
				expect(
					l2ApprovalTokenBalanceAfterWithdrawal ===
						l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
				).toEqual(true);

				expect(result).not.toBeNull();
			});
		} else {
			it('should withdraw ETH to the L1 network', async () => {
				const amount = 7_000_000_000n;
				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const l2BalanceBeforeWithdrawal = await wallet.getBalance(token);
				const tx = await wallet.withdraw({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
				});
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
				const l2BalanceAfterWithdrawal = await wallet.getBalance(token);
				expect(result).not.toBeNull();
				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toEqual(
					true,
				);
			});

			it('should withdraw base token to the L1 network', async () => {
				const amount = 7_000_000_000n;
				const baseToken = await wallet.getBaseToken();
				const l2BalanceBeforeWithdrawal = await wallet.getBalance();
				const tx = await wallet.withdraw({
					token: baseToken,
					to: wallet.getAddress(),
					amount: amount,
				});
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
				const l2BalanceAfterWithdrawal = await wallet.getBalance();
				expect(result).not.toBeNull();
				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toEqual(
					true,
				);
			});

			it('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
				const amount = 7_000_000_000n;
				const minimalAllowance = 1n;

				const token = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
				const paymasterBalanceBeforeWithdrawal = await provider.eth.getBalance(PAYMASTER);
				const paymasterTokenBalanceBeforeWithdrawal = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const l2BalanceBeforeWithdrawal = await wallet.getBalance(token);
				const l2ApprovalTokenBalanceBeforeWithdrawal =
					await wallet.getBalance(APPROVAL_TOKEN);

				const tx = await wallet.withdraw({
					token: token,
					to: wallet.getAddress(),
					amount: amount,
					paymasterParams: getPaymasterParams(PAYMASTER, {
						type: 'ApprovalBased',
						token: APPROVAL_TOKEN,
						minimalAllowance: minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				});
				const withdrawTx = await tx.waitFinalize();
				expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(
					false,
				);

				const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);

				const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
				const paymasterTokenBalanceAfterWithdrawal = await provider.getTokenBalance(
					APPROVAL_TOKEN,
					PAYMASTER,
				);
				const l2BalanceAfterWithdrawal = await wallet.getBalance(token);
				const l2ApprovalTokenBalanceAfterWithdrawal =
					await wallet.getBalance(APPROVAL_TOKEN);

				expect(
					paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
				).toEqual(true);
				expect(
					paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
				).toEqual(minimalAllowance);

				expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
				expect(
					l2ApprovalTokenBalanceAfterWithdrawal ===
						l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
				).toEqual(true);

				expect(result).not.toBeNull();
			});
		}

		it('should withdraw DAI to the L1 network', async () => {
			const amount = 4n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);
			const l2BalanceBeforeWithdrawal = await wallet.getBalance(l2DAI);
			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(DAI_L1);
			expect(l2BalanceBeforeWithdrawal).toBeGreaterThan(0n);
			expect(l1BalanceBeforeWithdrawal).toBeDefined();
			const tx = await wallet.withdraw({
				token: l2DAI,
				to: wallet.getAddress(),
				amount: amount,
			});
			const receipt = await tx.wait();
			expect(receipt.transactionHash).toBeDefined();
			const withdrawTx = await tx.waitFinalize();
			expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(false);

			const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);
			const l2BalanceAfterWithdrawal = await wallet.getBalance(l2DAI);
			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
			expect(result).not.toBeNull();
			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
		});

		it('should withdraw DAI to the L1 network using paymaster to cover fee', async () => {
			const amount = 4n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);
			const minimalAllowance = 1n;

			const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeWithdrawal = await provider.getTokenBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const l2BalanceBeforeWithdrawal = await wallet.getBalance(l2DAI);
			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(DAI_L1);
			const l2ApprovalTokenBalanceBeforeWithdrawal = await wallet.getBalance(APPROVAL_TOKEN);

			const tx = await wallet.withdraw({
				token: l2DAI,
				to: wallet.getAddress(),
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const withdrawTx = await tx.waitFinalize();
			expect(withdrawTx.transactionHash).toBeDefined();

			expect(await wallet.isWithdrawalFinalized(withdrawTx.transactionHash)).toEqual(false);

			const result = await wallet.finalizeWithdrawal(withdrawTx.transactionHash);

			const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterWithdrawal = await provider.getTokenBalance(
				APPROVAL_TOKEN,
				PAYMASTER,
			);
			const l2BalanceAfterWithdrawal = await wallet.getBalance(l2DAI);
			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
			const l2ApprovalTokenBalanceAfterWithdrawal = await wallet.getBalance(APPROVAL_TOKEN);

			expect(
				paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
			).toEqual(true);
			expect(
				paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
			).toEqual(minimalAllowance);
			expect(
				l2ApprovalTokenBalanceAfterWithdrawal ===
					l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
			).toEqual(true);

			expect(result).not.toBeNull();
			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toEqual(amount);
			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toEqual(amount);
		});
	});
});
