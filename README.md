# zkSync Plugin for Web3.js

Use [Web3.js](https://web3js.org/) to interact with [zkSync](https://zksync.io/) networks.

## Plugin Components

The plugin exposes the [zkSync JSON-RPC API](https://docs.zksync.io/build/api.html), implemented in
[src/rpc.methods.ts](src/rpc.methods.ts), as well as the [types](src/types.ts) that are used to send
and receive data using the JSON-RPC API. Smart contract definitions are located in the
[src/contracts](src/contracts) folder. The plugin is implemented in [src/plugin.ts](src/plugin.ts).

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would
like to change.

Please make sure to update [tests](test) as appropriate.

## Template

This plugin was created using the
[Web3.js Plugin Template](https://github.com/web3/web3.js-plugin-template).

## License

[MIT](https://choosealicense.com/licenses/mit/)
