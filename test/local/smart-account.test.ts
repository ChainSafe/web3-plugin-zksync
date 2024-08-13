import { IS_ETH_BASED, ADDRESS3, deepEqualExcluding } from '../utils';

import { PAYMASTER, ERC20_CROWN, DAI_L1, getAccounts, L2Provider } from './fixtures';

const APPROVAL_TOKEN = ERC20_CROWN;

import { EIP712_TX_TYPE, ETH_ADDRESS } from '../../src/constants';
import { toBigInt, toWei } from 'web3-utils';
import { privateKeyToAccount } from 'web3-eth-accounts';
import { SmartAccount, types, Web3ZKsyncL2, getPaymasterParams } from '../../src';

// const aaFactoryAddress = '0x111C3E89Ce80e62EE88318C2804920D4c96f92bb';
// const multisigAddress = '0x24de09D4C252D1b2413B8192F6A44f5f16D6eb66';

const accounts = getAccounts();
const PRIVATE_KEY = accounts[0].privateKey;
const mainAccount = privateKeyToAccount(PRIVATE_KEY);
jest.setTimeout(50000);
describe('SmartAccount', () => {
	const provider = new Web3ZKsyncL2(L2Provider);
	// const ethProvider = new Web3ZKsyncL1(L1Provider);
	const account = new SmartAccount(
		{ address: mainAccount.address, secret: mainAccount.privateKey },
		provider,
	);

	describe('#constructor()', () => {
		it('`SmartAccount(address, {address, secret}, provider)` should return a `SmartAccount` with signer and provider', () => {
			const account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBe(provider);
		});

		it('`SmartAccount(address, {address, secret})` should return a `SmartAccount` with signer', () => {
			const account = new SmartAccount({
				address: mainAccount.address,
				secret: mainAccount.privateKey,
			});
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBeUndefined();
		});

		it('`SmartWallet(address, {address, secret, payloadSigner, transactionBuilder}, provider)` should return a `SmartAccount` with custom payload signing method', async () => {
			const account = new SmartAccount(
				{
					address: mainAccount.address,
					secret: mainAccount.privateKey,
					payloadSigner: () => {
						return '0x';
					},
					transactionBuilder: async () => {
						return {};
					},
				},
				provider,
			);

			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBe(provider);
		});
	});

	describe('#connect()', () => {
		it('should return a `SmartAccount` with provided `provider` as a provider', async () => {
			const newProvider = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Mainnet);
			let account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			account = account.connect(newProvider);
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBe(newProvider);
		});

		it('should return a `SmartAccount` with no `provider` when `null` is used', async () => {
			let account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			account = account.connect(null);
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBeUndefined();
		});
	});

	describe('#getAddress()', () => {
		it('should return the `SmartAccount` address', async () => {
			const account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			const result = account.getAddress();
			expect(result).toBe(mainAccount.address);
		});
	});

	describe('#getBalance()', () => {
		it('should return a `SmartAccount` balance', async () => {
			const result = await account.getBalance();
			expect(result > 0n).toBeTruthy();
		});
	});

	describe('#getAllBalances()', () => {
		it('should return all balances', async () => {
			const result = await account.getAllBalances();
			const expected = IS_ETH_BASED ? 2 : 3;
			expect(Object.keys(result)).toHaveLength(expected);
		});
	});

	describe('#getDeploymentNonce()', () => {
		it('should return the deployment nonce', async () => {
			const result = await account.getDeploymentNonce();
			expect(result).not.toBeNull();
		});
	});

	describe('#populateTransaction()', () => {
		it('should return a populated transaction', async () => {
			const tx = {
				to: ADDRESS3,
				value: 7_000_000_000n,
				type: toBigInt(EIP712_TX_TYPE),
				from: mainAccount.address,
				nonce: await account.getNonce('pending'),
				gasLimit: 156_726n,
				chainId: 270n,
				data: '0x',
				customData: { gasPerPubdata: 50_000, factoryDeps: [] },
				gasPrice: 100_000_000n,
			};

			const result = await account.populateTransaction({
				type: EIP712_TX_TYPE,
				to: ADDRESS3,
				value: 7_000_000_000,
			});
			deepEqualExcluding(result, tx, [
				'nonce',
				'gasPrice',
				'gasLimit',
				'maxFeePerGas',
				'maxPriorityFeePerGas',
			]);
			expect(toBigInt(result.gasLimit) > 0n).toBeTruthy();
		});

		it('should return a populated transaction with default values if are omitted', async () => {
			const tx = {
				to: ADDRESS3,
				value: 7_000_000n,
				type: toBigInt(EIP712_TX_TYPE),
				from: mainAccount.address,
				nonce: await account.getNonce('pending'),
				chainId: 270n,
				gasPrice: 100_000_000n,
				data: '0x',
				customData: { gasPerPubdata: 50_000, factoryDeps: [] },
			};
			const result = await account.populateTransaction({
				to: ADDRESS3,
				value: 7_000_000,
			});
			deepEqualExcluding(result, tx, [
				'nonce',
				'gasPrice',
				'gasLimit',
				'maxFeePerGas',
				'maxPriorityFeePerGas',
			]);
			expect(toBigInt(result.gasLimit) > 0n).toBeTruthy();
		});
	});

	describe('#signTransaction()', () => {
		it('should return a signed EIP712 transaction', async () => {
			const result = await account.signTransaction({
				to: ADDRESS3,
				value: toWei(1, 'wei'),
			});
			expect(result).not.toBeNull();
		});
	});

	describe('#signMessage()', () => {
		it('should return a signed message', async () => {
			const result = await account.signMessage('Hello World!');
			expect(result).toBe(
				'0x7c15eb760c394b0ca49496e71d841378d8bfd4f9fb67e930eb5531485329ab7c67068d1f8ef4b480ec327214ee6ed203687e3fbe74b92367b259281e340d16fd1c',
			);
		});
	});

	describe('#signTypedData()', () => {
		it('should return a signed typed data', async () => {
			const result = await account.signTypedData(
				{ name: 'Example', version: '1', chainId: 300 },
				{
					Person: [
						{ name: 'name', type: 'string' },
						{ name: 'age', type: 'uint8' },
					],
				},
				{ name: 'John', age: 30 },
			);
			expect(result).toBe(
				'0x16f0b98c2c22b41e1c957bab70d1b7c54ef0b9b0da5600ebd32e41ebfe730e635570b620556f89ff0627ee5b6c516aef3a6d9b295b48a523b5c5efea3f697a321c',
			);
		});
	});

	describe('#transfer()', () => {
		it('should transfer ETH', async () => {
			const amount = 1_000_000_000n;
			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3);

			const tx = await account.transfer({
				token: ETH_ADDRESS,
				to: ADDRESS3,
				amount: amount,
			});
			expect(tx.hash).not.toBeNull();
			const receipt = await tx.wait();
			expect(receipt.transactionHash).not.toBeNull();
			const balanceAfterTransfer = await provider.getBalance(ADDRESS3);
			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
		});

		it.skip('should transfer ETH using paymaster to cover fee', async () => {
			const amount = 7_000_000_000n;
			const minimalAllowance = 1n;

			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceBeforeTransfer = await account.getBalance();
			const senderApprovalTokenBalanceBeforeTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getBalance(ADDRESS3);

			const tx = await account.transfer({
				token: ETH_ADDRESS,
				to: ADDRESS3,
				amount: amount,
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
			const senderBalanceAfterTransfer = await account.getBalance();
			const senderApprovalTokenBalanceAfterTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getBalance(ADDRESS3);

			expect(
				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
			).toBeTruthy();
			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
				minimalAllowance,
			);

			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
			expect(
				senderApprovalTokenBalanceAfterTransfer ===
					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			).toBeTruthy();

			expect(result).not.toBeNull();
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
		});

		it('should transfer DAI', async () => {
			const amount = 5n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);
			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3, 'latest', l2DAI);
			const tx = await account.transfer({
				token: l2DAI,
				to: ADDRESS3,
				amount: amount,
			});
			const result = await tx.wait();
			const balanceAfterTransfer = await provider.getBalance(ADDRESS3, 'latest', l2DAI);
			expect(result).not.toBeNull();
			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
		});

		it.skip('should transfer DAI using paymaster to cover fee', async () => {
			const amount = 5n;
			const minimalAllowance = 1n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);
			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceBeforeTransfer = await account.getBalance(l2DAI);
			const senderApprovalTokenBalanceBeforeTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getBalance(
				ADDRESS3,
				'latest',
				l2DAI,
			);

			const tx = await account.transfer({
				token: l2DAI,
				to: ADDRESS3,
				amount: amount,
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
			const senderBalanceAfterTransfer = await account.getBalance(l2DAI);
			const senderApprovalTokenBalanceAfterTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getBalance(
				ADDRESS3,
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
				senderBalanceBeforeTransfer - senderBalanceAfterTransfer - minimalAllowance,
			).toBe(amount);
			console.log(
				'senderApprovalTokenBalanceAfterTransfer',
				senderApprovalTokenBalanceAfterTransfer,
			);
			console.log(
				'senderApprovalTokenBalanceBeforeTransfer',
				senderApprovalTokenBalanceBeforeTransfer,
			);
			// expect(
			// 	senderApprovalTokenBalanceAfterTransfer ===
			// 		senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			// ).toBeTruthy();

			expect(result).not.toBeNull();
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
		});
	});

	describe('#withdraw()', () => {
		it('should withdraw ETH to the L1 network', async () => {
			const amount = 7_000_000_000n;
			// const l2BalanceBeforeWithdrawal = await account.getBalance();
			const withdrawTx = await account.withdraw({
				token: ETH_ADDRESS,
				to: account.getAddress(),
				amount: amount,
			});
			const receipt = await withdrawTx.wait();
			expect(receipt.transactionHash).not.toBeNull();
			// await withdrawTx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
			// const l2BalanceAfterWithdrawal = await account.getBalance();
			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toBeTruthy();
		});

		it.skip('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
			const amount = 7_000_000n;
			const minimalAllowance = 1n;

			// const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceBeforeWithdrawal = await account.getBalance();
			// const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);

			const withdrawTx = await account.withdraw({
				token: ETH_ADDRESS,
				to: account.getAddress(),
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const tx = await withdrawTx.wait();
			expect(tx.transactionHash).not.toBeNull();
			// await withdrawTx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();

			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);

			// const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceAfterWithdrawal = await account.getBalance();
			// const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);

			// expect(
			// 	paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
			// ).toBeTruthy();
			// expect(
			// 	paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
			// ).toBe(minimalAllowance);
			//
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			// expect(
			// 	l2ApprovalTokenBalanceAfterWithdrawal ===
			// 		l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
			// ).toBeTruthy();
			//
			// expect(result).not.toBeNull();
		});

		it.skip('should withdraw ERC20_CROWN to the L1 network', async () => {
			const amount = 5n;
			// const l2BalanceBeforeWithdrawal = await account.getBalance(L2USDC);
			// const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(USDC_L1);

			const withdrawTx = await account.withdraw({
				token: ERC20_CROWN,
				to: account.getAddress(),
				amount: amount,
			});
			const tx = await withdrawTx.wait();
			expect(tx.transactionHash).not.toBeNull();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
			// const l2BalanceAfterWithdrawal = await account.getBalance(L2USDC);
			// const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
			//
			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			// expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
		});

		// do not work because we need to have CROWN token on L1
		it.skip('should withdraw DAI to the L1 network using paymaster to cover fee', async () => {
			const amount = 5n;
			const minimalAllowance = 1n;
			const l2DAI = await provider.l2TokenAddress(DAI_L1);

			// const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceBeforeWithdrawal = await account.getBalance(l2USDC);
			// const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(USDC_L1);
			// const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);

			const withdrawTx = await account.withdraw({
				token: l2DAI,
				to: account.getAddress(),
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const tx = await withdrawTx.wait();
			expect(tx.transactionHash).not.toBeNull();
			// await withdrawTx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
			//
			// const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceAfterWithdrawal = await account.getBalance(l2USDC);
			// const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(USDC_L1);
			// const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);
			//
			// expect(
			// 	paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
			// ).toBeTruthy();
			// expect(
			// 	paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
			// ).toBe(minimalAllowance);
			// expect(
			// 	l2ApprovalTokenBalanceAfterWithdrawal ===
			// 		l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
			// ).toBeTruthy();
			//
			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			// expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
		});
	});
});

// describe('MultisigECDSASmartAccount', () => {
// 	const provider = Web3ZKsyncL2.initWithDefaultProvider(types.Network.Sepolia);
// 	const ethProvider = new Web3ZKsyncL1(
// 		'https://eth-sepolia.g.alchemy.com/v2/VCOFgnRGJF_vdAY2ZjgSksL6-6pYvRkz',
// 	);
// 	const wallet = new ZKsyncWallet(mainAccount.privateKey, provider, ethProvider);
// 	let account: SmartAccount;
//
// 	beforeAll(async function () {
// 		const deployer = ECDSASmartAccount.create(
// 			mainAccount.address,
// 			mainAccount.privateKey,
// 			provider,
// 		);
//
// 		const multisigAccountAbi = MultisigAccount.abi;
// 		const multisigAccountBytecode: string = MultisigAccount.bytecode;
// 		const factory = new provider.eth.Contract(multisigAccountAbi);
// 		const deploed = await factory
// 			.deploy({
// 				data: multisigAccountBytecode,
// 			})
// 			.send({
// 				from: deployer.address,
// 			});
// 		deploed.methods.createAccount();
// 		const owner1 = new ZKsyncWallet(mainAccount.privateKey);
// 		const owner2 = new ZKsyncWallet(PRIVATE_KEY2);
// 		const multisigContract = await factory.deploy(owner1.address, owner2.address);
// 		const multisigAddress = await multisigContract.methods.getAddress();
//
// 		// send ETH to multisig account
// 		await (
// 			await deployer.sendTransaction({
// 				to: multisigAddress,
// 				value: toWei(1, 'ether'),
// 			})
// 		).wait();
//
// 		// send paymaster approval token to multisig account
// 		const sendApprovalTokenTx = await deployer.transfer({
// 			to: multisigAddress,
// 			token: APPROVAL_TOKEN,
// 			amount: 5,
// 		});
// 		await sendApprovalTokenTx.wait();
//
// 		// send DAI token to multisig account
// 		const sendTokenTx = await deployer.transfer({
// 			to: multisigAddress,
// 			token: await provider.l2TokenAddress(DAI_L1),
// 			amount: 20,
// 		});
// 		await sendTokenTx.wait();
//
// 		account = MultisigECDSASmartAccount.create(
// 			multisigAddress,
// 			[mainAccount.privateKey, PRIVATE_KEY2],
// 			provider,
// 		);
// 	});
//
// 	describe('#transfer()', () => {
// 		it('should transfer ETH', async () => {
// 			const amount = 7_000_000_000n;
// 			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3);
// 			const tx = await account.transfer({
// 				token: ETH_ADDRESS,
// 				to: ADDRESS3,
// 				amount: amount,
// 			});
// 			const result = await tx.wait();
// 			const balanceAfterTransfer = await provider.getBalance(ADDRESS3);
// 			expect(result).not.toBeNull();
// 			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
// 		});
//
// 		it('should transfer ETH using paymaster to cover fee', async () => {
// 			const amount = 7_000_000_000n;
// 			const minimalAllowance = 1n;
//
// 			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceBeforeTransfer = await account.getBalance();
// 			const senderApprovalTokenBalanceBeforeTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceBeforeTransfer = await provider.getBalance(ADDRESS3);
//
// 			const tx = await account.transfer({
// 				token: ETH_ADDRESS,
// 				to: ADDRESS3,
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			const result = await tx.wait();
//
// 			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceAfterTransfer = await account.getBalance();
// 			const senderApprovalTokenBalanceAfterTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceAfterTransfer = await provider.getBalance(ADDRESS3);
//
// 			expect(
// 				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
// 			).toBeTruthy();
// 			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
// 				minimalAllowance,
// 			);
//
// 			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
// 			expect(
// 				senderApprovalTokenBalanceAfterTransfer ===
// 					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
// 		});
//
// 		it('should transfer DAI', async () => {
// 			const amount = 5n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
// 			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3, 'latest', l2DAI);
// 			const tx = await account.transfer({
// 				token: l2DAI,
// 				to: ADDRESS3,
// 				amount: amount,
// 			});
// 			const result = await tx.wait();
// 			const balanceAfterTransfer = await provider.getBalance(ADDRESS3, 'latest', l2DAI);
// 			expect(result).not.toBeNull();
// 			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
// 		});
//
// 		it('should transfer DAI using paymaster to cover fee', async () => {
// 			const amount = 5n;
// 			const minimalAllowance = 1n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
//
// 			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceBeforeTransfer = await account.getBalance(l2DAI);
// 			const senderApprovalTokenBalanceBeforeTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceBeforeTransfer = await provider.getBalance(
// 				ADDRESS3,
// 				'latest',
// 				l2DAI,
// 			);
//
// 			const tx = await account.transfer({
// 				token: l2DAI,
// 				to: ADDRESS3,
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			const result = await tx.wait();
//
// 			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceAfterTransfer = await account.getBalance(l2DAI);
// 			const senderApprovalTokenBalanceAfterTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceAfterTransfer = await provider.getBalance(
// 				ADDRESS3,
// 				'latest',
// 				l2DAI,
// 			);
//
// 			expect(
// 				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
// 			).toBeTruthy();
// 			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
// 				minimalAllowance,
// 			);
//
// 			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
// 			expect(
// 				senderApprovalTokenBalanceAfterTransfer ===
// 					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
// 		});
// 	});
//
// 	describe('#withdraw()', () => {
// 		it('should withdraw ETH to the L1 network', async () => {
// 			const amount = 7_000_000_000n;
// 			const l2BalanceBeforeWithdrawal = await account.getBalance();
// 			const withdrawTx = await account.withdraw({
// 				token: ETH_ADDRESS,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
// 			const l2BalanceAfterWithdrawal = await account.getBalance();
// 			expect(result).not.toBeNull();
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toBeTruthy();
// 		});
//
// 		it('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
// 			const amount = 7_000_000_000n;
// 			const minimalAllowance = 1n;
//
// 			const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceBeforeWithdrawal = await account.getBalance();
// 			const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			const withdrawTx = await account.withdraw({
// 				token: ETH_ADDRESS,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
//
// 			const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceAfterWithdrawal = await account.getBalance();
// 			const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			expect(
// 				paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0,
// 			).toBeTruthy();
// 			expect(
// 				paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
// 			).toBe(minimalAllowance);
//
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
// 			expect(
// 				l2ApprovalTokenBalanceAfterWithdrawal ===
// 					l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 		});
//
// 		it('should withdraw DAI to the L1 network', async () => {
// 			const amount = 5n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
// 			const l2BalanceBeforeWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(DAI_L1);
//
// 			const withdrawTx = await account.withdraw({
// 				token: l2DAI,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
//
// 			const l2BalanceAfterWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
//
// 			expect(result).not.toBeNull();
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
// 			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
// 		});
//
// 		it('should withdraw DAI to the L1 network using paymaster to cover fee', async () => {
// 			const amount = 5n;
// 			const minimalAllowance = 1n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
//
// 			const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceBeforeWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(DAI_L1);
// 			const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			const withdrawTx = await account.withdraw({
// 				token: l2DAI,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
//
// 			const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceAfterWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
// 			const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			expect(
// 				paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
// 			).toBeTruthy();
// 			expect(
// 				paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
// 			).toBe(minimalAllowance);
// 			expect(
// 				l2ApprovalTokenBalanceAfterWithdrawal ===
// 					l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
// 			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
// 		});
// 	});
// });
