# ZKsync Plugin for Web3.js

#### Web3.js libraries are being sunset on March 4th, 2025. For migration guides and more details please refer to [Chainsafe blog](https://blog.chainsafe.io/web3-js-sunset/)

Use [Web3.js](https://web3js.org/) to interact with the [ZKsync Era](https://zksync.io/) network.

## Documentation

Please refer to the comprehensive
[API documentation](https://chainsafe.github.io/web3-plugin-zksync/) for a complete overview of this
plugin's capabilities. Usage documentation that includes explanations and code samples is available
as part of the [official Web3.js plugin for ZKsync SDK docs](https://sdk.zksync.io/js/web3js).

## Plugin Components

- [RPC methods](https://sdk.zksync.io/js/web3js/rpc):
  The[`RpcMethods` class](https://chainsafe.github.io/web3-plugin-zksync/classes/RpcMethods.html)
  implements the [ZKsync JSON-RPC API](https://docs.zksync.io/build/api-reference/zks-rpc).
- [Constants](https://sdk.zksync.io/js/web3js/constants-types-utilities#constants): The
  [`constants` package](https://chainsafe.github.io/web3-plugin-zksync/modules/constants.html)
  includes well-known addresses, such as the address of the L1 ETH token.
- [Types](https://sdk.zksync.io/js/web3js/constants-types-utilities#types): The
  [`types` package](https://chainsafe.github.io/web3-plugin-zksync/modules/types.html) defines
  enums, interfaces, and types that are used for interacting with the ZKsync Era network.
- [Utilities](https://sdk.zksync.io/js/web3js/constants-types-utilities#utilities): The
  [`utils` package](https://chainsafe.github.io/web3-plugin-zksync/modules/utils.html) exposes
  helpful functions and contract definitions that can be used with the Web3.js plugin for ZKsync.
- [Wallet](https://sdk.zksync.io/js/web3js/wallet): The
  [`ZKSyncWallet` class](https://chainsafe.github.io/web3-plugin-zksync/classes/ZKSyncWallet.html)
  allows developers to create, manage, and use ZKsync accounts.
- [Paymasters](https://sdk.zksync.io/js/web3js/paymasters): The plugin includes a number of
  helpful utilities for working with
  [ZKsync paymasters](https://docs.zksync.io/build/developer-reference/account-abstraction/paymasters),
  including a
  [`getPaymasterParams` function](https://chainsafe.github.io/web3-plugin-zksync/functions/getPaymasterParams.html)
  for generating paymaster parameters to add to a transaction.
- [Smart contracts](https://sdk.zksync.io/js/web3js/contracts): The
  [`ContractFactory` class](https://chainsafe.github.io/web3-plugin-zksync/classes/ContractFactory.html)
  can be used to deploy smart contracts to the ZKsync Era network. The return type of the
  [`ContractFactory.deploy` method](https://chainsafe.github.io/web3-plugin-zksync/classes/ContractFactory.html#deploy)
  is the standard
  [Web3.js Contract class](https://docs.web3js.org/api/web3-eth-contract/class/Contract/).
- [Smart accounts](https://sdk.zksync.io/js/web3js/smart-accounts): The
  [`SmartAccount` class](https://chainsafe.github.io/web3-plugin-zksync/classes/SmartAccount.html)
  can be used to create
  [ZKsync smart accounts](https://docs.zksync.io/build/developer-reference/account-abstraction/)
  with custom logic for building and signing transactions. There are factory functions for
  creating
  [ECDSA smart accounts](https://chainsafe.github.io/web3-plugin-zksync/classes/ECDSASmartAccount.html#create)
  and
  [multi-signature ECDSA smart accounts](https://chainsafe.github.io/web3-plugin-zksync/classes/MultisigECDSASmartAccount.html#create).

## Contributing

Pull requests are welcome. Please make sure to update [tests](test) as appropriate. For major
changes, please [open an Issue](https://github.com/ChainSafe/web3-plugin-zksync/issues/new) first to
discuss what you would like to change.

## Template

This plugin was created using the
[Web3.js Plugin Template](https://github.com/web3/web3.js-plugin-template).

## License

[MIT](https://choosealicense.com/licenses/mit/)
