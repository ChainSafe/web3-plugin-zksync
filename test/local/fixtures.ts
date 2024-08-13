export const ERC20_CROWN = '0x841c43Fa5d8fFfdB9efE3358906f7578d8700Dd4';
export const APPROVAL_TOKEN = ERC20_CROWN;
export const PAYMASTER = '0xa222f0c183AFA73a8Bc1AFb48D34C88c9Bf7A174';
export const DAI_L1 = '0x70a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55';
export const DAI_L2 = '0x48e52ea9d3e96079304D4de005Ec363e2cbd4BA9';

import accountsData from './rich-wallets.json';
export const getAccounts = () => accountsData;

export const L1Provider = 'http://127.0.0.1:8545';
export const L2Provider = 'http://127.0.0.1:3050';
